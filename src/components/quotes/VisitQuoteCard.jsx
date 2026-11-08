import { useState } from "react";
import { api } from "../../api";
import { useAsync } from "../../hooks";
import {
  computeTotals,
  editorItems,
  filledItems,
  formatQuantity,
  itemErrorsFrom,
  itemsBody,
  totalTooLarge,
  validateItems,
  validateTaxRate,
} from "../../utils/quotes";
import { emailLooksValid, fieldErrors, phoneLooksValid } from "../../utils/requests";
import CopyLink from "../CopyLink";
import ErrorMessage from "../ErrorMessage";
import { Input, TextArea } from "../Field";
import { ItemsEditor, QuoteItems, QuoteTotals } from "../QuoteLines";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Alert } from "../ui/Feedback";
import VisitPhotoPicker from "./VisitPhotoPicker";

const STATUS = {
  draft: ["Draft", "warning"],
  sent: ["Sent", "primary"],
  accepted: ["Accepted", "success"],
  declined: ["Declined", "danger"],
};

// The estimate visit's quote, priced and sent on site by someone who may quote (canQuote).
export default function VisitQuoteCard({ quoteId, visitId, onSent }) {
  const [reloadKey, setReloadKey] = useState(0);
  const { data: quote, setData, error } = useAsync(api, `/api/quotes/${quoteId}`, reloadKey);
  const [sendResult, setSendResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) {
    return (
      <Card title="Quote">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!quote) {
    return (
      <Card title="Quote">
        <p className="text-sm text-muted">Loading the quote…</p>
      </Card>
    );
  }
  const [label, tone] = STATUS[quote.status] || [quote.status, "neutral"];

  async function revise() {
    setBusy(true);
    setActionError(null);
    try {
      setData(await api(`/api/quotes/${quote.id}/revise`, { method: "POST" }));
      setSendResult(null);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Quote <Badge tone={tone}>{label}</Badge>
        </span>
      }
      description={quote.status === "draft" ? "Price the work here and send it to the customer." : quote.title}
    >
      {quote.status === "draft" ? (
        <DraftEditor
          key={`${quote.id}-${reloadKey}`}
          quote={quote}
          visitId={visitId}
          onSaved={setData}
          onSent={(result) => {
            setData(result.quote);
            setSendResult(result);
            onSent?.();
          }}
          onReload={() => setReloadKey((key) => key + 1)}
        />
      ) : (
        <div className="space-y-4">
          <QuoteItems items={quote.items} />
          <QuoteTotals subtotal={quote.subtotal_cents} tax={quote.tax_cents} taxRate={quote.tax_rate} total={quote.total_cents} />
          {sendResult && <SentNote result={sendResult} />}
          {quote.status === "sent" && (
            <>
              <CopyLink url={quote.url} label="Quote link" openLabel="Show the customer" />
              <p className="text-xs text-muted">
                Show the customer opens the quote, where they can accept it on your phone.
              </p>
              <Button variant="ghost" size="sm" disabled={busy} onClick={revise}>
                Change the quote
              </Button>
            </>
          )}
          {quote.status === "accepted" && <Alert tone="success">The customer accepted. The job is on the schedule for the office to set up.</Alert>}
          {quote.status === "declined" && <Alert tone="warning">The customer declined this quote.</Alert>}
          <ErrorMessage error={actionError} />
        </div>
      )}
    </Card>
  );
}

function SentNote({ result }) {
  if (result.email === "queued") return <Alert tone="success">Emailed to {result.quote.customer_email}.</Alert>;
  return (
    <Alert tone="info">
      Sent without an email. Show the customer the quote on your phone, or copy the link and text it to them.
    </Alert>
  );
}

function DraftEditor({ quote, visitId, onSaved, onSent, onReload }) {
  const [items, setItems] = useState(() => editorItems(quote.items));
  const [values, setValues] = useState({
    tax_rate: quote.tax_rate_bp ? formatQuantity(quote.tax_rate) : "",
    customer_email: quote.customer_email || "",
    customer_phone: quote.customer_phone || "",
    notes: quote.notes || "",
  });
  const [version, setVersion] = useState(quote.version);
  const [photos, setPhotos] = useState(quote.photos);
  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(null);
  const totals = computeTotals(items, values.tax_rate);
  const set = (key) => (event) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function check(sending) {
    const found = {};
    const taxError = validateTaxRate(values.tax_rate);
    if (taxError) found.tax_rate = taxError;
    const email = values.customer_email.trim();
    if (email && !emailLooksValid(email)) found.customer_email = "Enter an email address like name@example.com.";
    const phone = values.customer_phone.trim();
    if (phone && !phoneLooksValid(phone)) found.customer_phone = "Enter a phone number like (512) 555-0101.";
    if (sending && !filledItems(items).length) found.items = "Add at least one item before sending.";
    const lineErrors = validateItems(items);
    setErrors(found);
    setItemErrors(lineErrors);
    if (Object.keys(found).length || Object.keys(lineErrors).length) return "Please fix the highlighted fields.";
    if (totalTooLarge(totals.total)) return "The total is over $999,999.99, the most one job can cost.";
    return null;
  }

  async function save() {
    const saved = await api(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      body: {
        version,
        items: itemsBody(items),
        tax_rate: values.tax_rate.trim() || "0",
        customer_email: values.customer_email.trim() || null,
        customer_phone: values.customer_phone.trim() || null,
        notes: values.notes.trim() || null,
      },
    });
    setVersion(saved.version);
    onSaved(saved);
    return saved;
  }

  async function run(sending) {
    const problem = check(sending);
    setFormError(problem);
    if (problem) return;
    setBusy(sending ? "send" : "save");
    try {
      await save();
      if (sending) onSent(await api(`/api/quotes/${quote.id}/send`, { method: "POST" }));
    } catch (err) {
      if (err.status === 409 && err.data?.quote) {
        setConflict(true);
      } else {
        const server = fieldErrors(err);
        setErrors({ ...server, tax_rate: server.tax_rate || server.tax_rate_bp });
        setItemErrors(itemErrorsFrom(err));
        setFormError(err.message);
      }
    } finally {
      setBusy(null);
    }
  }

  if (conflict) {
    return (
      <Alert tone="warning">
        <p>Someone else changed this quote since you opened it.</p>
        <Button className="mt-2" size="sm" variant="secondary" onClick={onReload}>
          Reload their changes
        </Button>
      </Alert>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run(false);
      }}
      className="space-y-5"
    >
      <ItemsEditor
        items={items}
        setItems={(next) => {
          setItems(next);
          setErrors((current) => ({ ...current, items: undefined }));
        }}
        itemErrors={itemErrors}
        lineTotals={totals.lineTotals}
        listError={errors.items}
        disabled={Boolean(busy)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Tax rate (%)"
          inputMode="decimal"
          value={values.tax_rate}
          onChange={set("tax_rate")}
          error={errors.tax_rate}
          placeholder="0"
        />
        <div className="sm:pt-6">
          <QuoteTotals subtotal={totals.subtotal} tax={totals.tax} taxRate={values.tax_rate || "0"} total={totals.total} />
        </div>
        <Input
          label="Customer email"
          type="email"
          inputMode="email"
          value={values.customer_email}
          onChange={set("customer_email")}
          error={errors.customer_email}
          hint={values.customer_email.trim() ? "The quote link is emailed here when you send it." : "Optional. Without one, show them the quote on your phone."}
        />
        <Input
          label="Customer phone"
          type="tel"
          inputMode="tel"
          value={values.customer_phone}
          onChange={set("customer_phone")}
          error={errors.customer_phone}
        />
      </div>
      <TextArea
        label="Notes for the customer"
        value={values.notes}
        onChange={set("notes")}
        error={errors.notes}
        placeholder="What's included, how long it takes, when payment is due…"
      />
      <div>
        <p className="mb-2 text-sm font-medium text-fg">
          Photos on the quote <span className="font-normal text-muted">({photos.length})</span>
        </p>
        <VisitPhotoPicker
          quoteId={quote.id}
          visitId={visitId}
          quotePhotos={photos}
          maxPhotos={quote.max_photos}
          onAdded={setPhotos}
        />
      </div>
      {formError && <p className="text-sm font-medium text-danger">{formError}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" variant="secondary" disabled={Boolean(busy)}>
          {busy === "save" ? "Saving…" : "Save draft"}
        </Button>
        <Button onClick={() => run(true)} disabled={Boolean(busy)}>
          {busy === "send" ? "Sending…" : "Send to the customer"}
        </Button>
      </div>
    </form>
  );
}
