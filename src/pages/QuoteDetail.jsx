import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ConfirmDelete from "../components/ConfirmDelete";
import ErrorMessage from "../components/ErrorMessage";
import { Input, Select, TextArea } from "../components/Field";
import CopyLink from "../components/CopyLink";
import CreateInvoiceButton from "../components/CreateInvoiceButton";
import EmailSendResult from "../components/EmailSendResult";
import Loading from "../components/Loading";
import { ItemsEditor, QuoteItems, QuoteTotals } from "../components/QuoteLines";
import { Badge, QuoteStatusBadge, RequestStatusBadge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert, EmptyState, Spinner } from "../components/ui/Feedback";
import { BriefcaseIcon, InboxIcon, MailIcon, MapPinIcon, UsersIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAsync } from "../hooks";
import { formatMoney } from "../utils/format";
import {
  MAX_NOTES,
  MAX_TITLE,
  computeTotals,
  editorItems,
  filledItems,
  formatDate,
  formatMoment,
  formatQuantity,
  itemErrorsFrom,
  itemsBody,
  totalTooLarge,
  validateItems,
  validateTaxRate,
} from "../utils/quotes";
import { emailLooksValid, fieldErrors, localToday } from "../utils/requests";

const BACK = { to: "/quotes", label: "Quotes" };
const FORM_FIELDS = ["title", "customer_name", "customer_email", "customer_address", "notes", "valid_until", "tax_rate"];

export default function QuoteDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (!id) {
    const requestId = params.get("request_id");
    const clientId = params.get("client_id");
    return <NewQuote key={`${requestId}-${clientId}`} requestId={requestId} clientId={clientId} />;
  }
  return <QuoteView key={id} id={id} />;
}

// --- Form state -----------------------------------------------------------------

function formFromQuote(quote) {
  return {
    values: {
      title: quote.title || "",
      customer_name: quote.customer_name || "",
      customer_email: quote.customer_email || "",
      customer_address: quote.customer_address || "",
      notes: quote.notes || "",
      valid_until: quote.valid_until || "",
      tax_rate: quote.tax_rate_bp ? formatQuantity(quote.tax_rate) : "",
    },
    items: editorItems(quote.items),
  };
}

// The JSON for POST or PATCH. Rows left completely empty are dropped.
function bodyFrom(values, items) {
  return {
    title: values.title.trim(),
    customer_name: values.customer_name.trim(),
    customer_email: values.customer_email.trim() || null,
    customer_address: values.customer_address.trim() || null,
    notes: values.notes.trim() || null,
    valid_until: values.valid_until || null,
    tax_rate: values.tax_rate.trim() || "0",
    items: itemsBody(items),
  };
}

function snapshot(values, items) {
  return JSON.stringify(bodyFrom(values, items));
}

// --- Editor ---------------------------------------------------------------------

// Checks done before saving; returns { errors, itemErrors } (empty when fine).
function validate(values, items, { sending }) {
  const errors = {};
  if (!values.title.trim()) errors.title = "Give the quote a title.";
  if (!values.customer_name.trim()) errors.customer_name = "Enter the customer's name.";
  const email = values.customer_email.trim();
  if (email && !emailLooksValid(email)) errors.customer_email = "Enter an email address like name@example.com.";
  const taxError = validateTaxRate(values.tax_rate);
  if (taxError) errors.tax_rate = taxError;
  if (sending && values.valid_until && values.valid_until < localToday()) {
    errors.valid_until = "This date has passed. Pick a later date or clear it.";
  }
  const itemErrors = validateItems(items);
  if (sending && !filledItems(items).length) errors.items = "Add at least one item before sending.";
  return { errors, itemErrors };
}

function QuoteEditor({ initial, onSave, onSend, saveLabel, sendBlocked, children }) {
  const [values, setValues] = useState(initial.values);
  const [items, setItems] = useState(initial.items);
  const [saved, setSaved] = useState(() => snapshot(initial.values, initial.items));
  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(null);

  const totals = computeTotals(items, values.tax_rate);
  const dirty = snapshot(values, items) !== saved;
  const tooLarge = totalTooLarge(totals.total);
  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  async function run(kind) {
    const sending = kind === "send";
    const found = validate(values, items, { sending });
    const hasErrors = Object.values(found.errors).some(Boolean) || Object.keys(found.itemErrors).length > 0;
    setErrors(found.errors);
    setItemErrors(found.itemErrors);
    setFormError(null);
    if (hasErrors || tooLarge) {
      // On phones the buttons sit far below the fields, so say why nothing happened.
      setFormError(hasErrors ? "Please fix the highlighted fields." : "The total is over $999,999.99, the most one job can cost.");
      return;
    }
    setBusy(kind);
    const body = bodyFrom(values, items);
    try {
      if (sending) await onSend(body, dirty);
      else await onSave(body);
      setSaved(snapshot(values, items));
    } catch (err) {
      const server = fieldErrors(err);
      const known = Object.fromEntries(FORM_FIELDS.filter((key) => server[key]).map((key) => [key, server[key]]));
      if (server.tax_rate_bp) known.tax_rate = server.tax_rate_bp;
      if (Array.isArray(err.data?.errors?.items)) known.items = err.data.errors.items[0];
      setErrors(known);
      setItemErrors(itemErrorsFrom(err));
      setFormError(err.status === 400 && (Object.keys(known).length || err.data?.errors?.items) && !server.total && !server.client_id
        ? "Please fix the highlighted fields."
        : err.message);
    } finally {
      setBusy(null);
    }
  }

  const disabled = Boolean(busy);
  const visibleItems = items.filter((item) => item.description.trim() || item.unit_price.trim()).length;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run("save");
      }}
      className="grid items-start gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        {children}
        <Card title="Line items" description="Quantities can have decimals, like 1.5 hours.">
          <ItemsEditor
            items={items}
            setItems={(next) => {
              setItems(next);
              setErrors((current) => (current.items ? { ...current, items: undefined } : current));
            }}
            itemErrors={itemErrors}
            lineTotals={totals.lineTotals}
            listError={errors.items}
            disabled={disabled}
          />
        </Card>
        <Card title="Details">
          <div className="space-y-4">
            <Input
              label="Title"
              value={values.title}
              onChange={set("title")}
              error={errors.title}
              maxLength={MAX_TITLE}
              placeholder="For example: Gutter cleaning"
              disabled={disabled}
            />
            <TextArea
              label="Notes for the client"
              rows="3"
              value={values.notes}
              onChange={set("notes")}
              error={errors.notes}
              maxLength={MAX_NOTES}
              hint="Shown on the quote. For example: what is included, or when payment is due."
              disabled={disabled}
            />
            <Input
              label="Valid until"
              type="date"
              min={localToday()}
              value={values.valid_until}
              onChange={set("valid_until")}
              error={errors.valid_until}
              hint="Optional. After this day the client can no longer accept."
              disabled={disabled}
              className="sm:max-w-56"
            />
          </div>
        </Card>
        <Card title="Customer" description="Shown on the quote and used for the email.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              value={values.customer_name}
              onChange={set("customer_name")}
              error={errors.customer_name}
              maxLength={120}
              autoComplete="off"
              disabled={disabled}
            />
            <Input
              label="Email"
              type="email"
              inputMode="email"
              value={values.customer_email}
              onChange={set("customer_email")}
              error={errors.customer_email}
              maxLength={254}
              hint={values.customer_email.trim() ? undefined : "Without an email, copy the link and send it yourself."}
              autoComplete="off"
              disabled={disabled}
            />
            <Input
              label="Address"
              value={values.customer_address}
              onChange={set("customer_address")}
              error={errors.customer_address}
              maxLength={300}
              autoComplete="off"
              disabled={disabled}
              className="sm:col-span-2"
            />
          </div>
        </Card>
      </div>
      <div className="lg:sticky lg:top-20">
        <Card title="Total">
          <label className="mb-4 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-fg">Tax rate</span>
            <span className="relative block w-28">
              <input
                value={values.tax_rate}
                onChange={set("tax_rate")}
                inputMode="decimal"
                placeholder="0"
                disabled={disabled}
                aria-invalid={errors.tax_rate ? true : undefined}
                className={cx("field pr-7 text-right tabular-nums", errors.tax_rate && "border-danger")}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">%</span>
            </span>
          </label>
          {errors.tax_rate && <p className="-mt-3 mb-3 text-right text-xs font-medium text-danger">{errors.tax_rate}</p>}
          <QuoteTotals
            subtotal={totals.subtotal}
            tax={totals.tax}
            taxRate={validateTaxRate(values.tax_rate) ? "0" : values.tax_rate || "0"}
            total={totals.total}
          />
          <p className="mt-2 text-xs text-muted">
            {visibleItems} {visibleItems === 1 ? "item" : "items"}. Tax is worked out on the subtotal and rounded to the cent.
          </p>
          {tooLarge && <Alert tone="danger" className="mt-3">The total is over $999,999.99, the most one job can cost.</Alert>}
          {formError && <Alert tone="danger" className="mt-3">{formError}</Alert>}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              size="lg"
              block
              onClick={() => run("send")}
              disabled={disabled || Boolean(sendBlocked)}
              title={sendBlocked || undefined}
            >
              {busy === "send" ? <Spinner className="h-4 w-4 text-current" /> : <MailIcon />}
              {busy === "send" ? "Sending…" : dirty ? "Save and send" : "Send to client"}
            </Button>
            <Button type="submit" variant="secondary" block disabled={disabled || (!dirty && saveLabel !== "Save draft")}>
              {busy === "save" ? "Saving…" : dirty || saveLabel === "Save draft" ? saveLabel : "Saved"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Sending makes the quote's link work and emails it to the customer. Sent quotes cannot be edited; revise one to
            change it.
          </p>
        </Card>
      </div>
    </form>
  );
}

// --- New quote ------------------------------------------------------------------

function ClientPicker() {
  const navigate = useNavigate();
  const { data: clients, error } = useAsync(fetchAll, "/api/clients");
  const [clientId, setClientId] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader title="New quote" back={BACK} description="Pick who the quote is for." />
      <ErrorMessage error={error} />
      {!clients && !error && <Loading />}
      {clients && !clients.length && (
        <EmptyState
          icon={UsersIcon}
          title="No clients yet"
          description="Add a client first, or start a quote from a request in your inbox."
          action={<ButtonLink to="/clients">Add a client</ButtonLink>}
        />
      )}
      {clients?.length > 0 && (
        <Card className="max-w-xl">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (clientId) navigate(`/quotes/new?client_id=${clientId}`, { replace: true });
            }}
          >
            <Select label="Client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="" disabled>
                Pick a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </Select>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                To quote a request, open it in{" "}
                <Link to="/requests" className="link">Requests</Link> and choose Create quote.
              </p>
              <Button type="submit" disabled={!clientId}>Continue</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function NewQuote({ requestId, clientId }) {
  if (!requestId && !clientId) return <ClientPicker />;
  return <NewQuoteFrom kind={requestId ? "request" : "client"} sourceId={requestId || clientId} />;
}

function NewQuoteFrom({ kind, sourceId }) {
  const navigate = useNavigate();
  const path = kind === "request" ? `/api/requests/${sourceId}` : `/api/clients/${sourceId}`;
  const { data: source, error } = useAsync(api, path);

  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="New quote" back={BACK} />
        <EmptyState title={`This ${kind} does not exist or was deleted.`} />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!source) return <Loading />;

  const initial = formFromQuote({
    title: kind === "request" ? source.service_type : "",
    customer_name: source.name,
    customer_email: source.email,
    customer_address: source.address,
  });
  const sourceKey = kind === "request" ? { request_id: source.id } : { client_id: source.id };
  const archived = kind === "client" && source.archived;

  async function create(body) {
    return api("/api/quotes", { method: "POST", body: { ...sourceKey, ...body } });
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="New quote"
        back={kind === "request" ? { to: `/requests/${source.id}`, label: source.name } : { to: `/clients/${source.id}`, label: source.name }}
        description={kind === "request" ? `From ${source.name}'s request for ${source.service_type}` : `For ${source.name}`}
      />
      {archived && (
        <Alert tone="warning" title="This client is archived">
          Unarchive them to send them a quote.
        </Alert>
      )}
      <QuoteEditor
        initial={initial}
        saveLabel="Save draft"
        sendBlocked={archived ? "This client is archived." : null}
        onSave={async (body) => {
          const quote = await create(body);
          navigate(`/quotes/${quote.id}`, { replace: true, state: { notice: "Draft saved." } });
        }}
        onSend={async (body) => {
          const quote = await create(body);
          try {
            const sent = await api(`/api/quotes/${quote.id}/send`, { method: "POST" });
            navigate(`/quotes/${quote.id}`, { replace: true, state: { sendResult: sent } });
          } catch (err) {
            // Saved as a draft but not sent: open it so the owner sees why.
            navigate(`/quotes/${quote.id}`, { replace: true, state: { sendError: err.message } });
          }
        }}
      />
    </div>
  );
}

// --- Existing quote -------------------------------------------------------------

function DecisionAlert({ quote }) {
  if (quote.status === "accepted") {
    return (
      <Alert tone="success" title={`Accepted${quote.decided_at ? ` on ${formatMoment(quote.decided_at)}` : ""}`}>
        <p>
          A job was added for {quote.client?.name || quote.customer_name}, priced at {formatMoney(quote.total_cents)}. It has
          nobody assigned yet; pick the crew and the time.
        </p>
        <div className="mt-2.5 flex flex-wrap items-start gap-2">
          {quote.job_id && (
            <ButtonLink to={`/jobs/${quote.job_id}`} size="sm" variant="secondary">
              <BriefcaseIcon />
              Open the job
            </ButtonLink>
          )}
          <CreateInvoiceButton source={{ quote_id: quote.id }} existing={quote.invoice} size="sm" />
        </div>
      </Alert>
    );
  }
  if (quote.status === "declined") {
    return (
      <Alert tone="danger" title={`Declined${quote.decided_at ? ` on ${formatMoment(quote.decided_at)}` : ""}`}>
        {quote.decline_reason ? (
          <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-current/30 pl-3 italic">{quote.decline_reason}</blockquote>
        ) : (
          "They did not give a reason."
        )}
      </Alert>
    );
  }
  if (quote.closed_reason === "request_accepted") {
    return (
      <Alert tone="info" title="Closed">
        Another quote on this request was accepted, so this one can no longer be accepted, declined, or sent.
      </Alert>
    );
  }
  if (quote.closed_reason === "expired") {
    return (
      <Alert tone="warning" title={`Expired on ${formatDate(quote.valid_until)}`}>
        The client can no longer accept it. Revise it to pick a new date, then send it again.
      </Alert>
    );
  }
  return null;
}

function Linked({ quote }) {
  const rows = [];
  if (quote.request) {
    rows.push(
      <li key="request" className="flex items-center justify-between gap-3">
        <Link to={`/requests/${quote.request.id}`} className="link inline-flex min-w-0 items-center gap-2">
          <InboxIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">Request from {quote.request.name}</span>
        </Link>
        <RequestStatusBadge status={quote.request.status} />
      </li>,
    );
  }
  if (quote.client) {
    rows.push(
      <li key="client" className="flex items-center justify-between gap-3">
        <Link to={`/clients/${quote.client.id}`} className="link inline-flex min-w-0 items-center gap-2">
          <UsersIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{quote.client.name}</span>
        </Link>
        {quote.client.archived && <Badge>Archived</Badge>}
      </li>,
    );
  }
  if (quote.job_id) {
    rows.push(
      <li key="job">
        <Link to={`/jobs/${quote.job_id}`} className="link inline-flex items-center gap-2">
          <BriefcaseIcon className="h-4 w-4" />
          Job #{quote.job_id}
        </Link>
      </li>,
    );
  }
  if (!rows.length) return <p className="text-sm text-muted">Not linked to a request or client yet. Accepting adds the client.</p>;
  return <ul className="space-y-2.5 text-sm">{rows}</ul>;
}

function CustomerDetails({ quote }) {
  return (
    <dl className="space-y-2.5 text-sm">
      <div className="font-medium text-fg">{quote.customer_name}</div>
      <div className="flex gap-2.5">
        <dt className="mt-0.5 text-muted"><MailIcon className="h-4 w-4" /><span className="sr-only">Email</span></dt>
        <dd className="min-w-0 break-all">
          {quote.customer_email ? (
            <a href={`mailto:${quote.customer_email}`} className="link">{quote.customer_email}</a>
          ) : (
            <span className="text-muted">No email</span>
          )}
        </dd>
      </div>
      <div className="flex gap-2.5">
        <dt className="mt-0.5 text-muted"><MapPinIcon className="h-4 w-4" /><span className="sr-only">Address</span></dt>
        <dd className="min-w-0">{quote.customer_address || <span className="text-muted">No address</span>}</dd>
      </div>
    </dl>
  );
}

function SentActions({ quote, onResend, onRevise }) {
  const [busy, setBusy] = useState(null);
  const [confirmRevise, setConfirmRevise] = useState(false);
  const [error, setError] = useState(null);

  async function run(kind, action) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const canResend = quote.customer_email && !quote.closed_reason;
  return (
    <div className="space-y-3">
      {confirmRevise ? (
        <>
          <Alert tone="warning">
            The link stops working until you send the quote again, so the client cannot accept it while you edit.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("revise", onRevise)} disabled={Boolean(busy)}>
              {busy === "revise" ? "Moving to draft…" : "Revise quote"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRevise(false)} disabled={Boolean(busy)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          {canResend && (
            <Button variant="secondary" onClick={() => run("resend", onResend)} disabled={Boolean(busy)}>
              <MailIcon />
              {busy === "resend" ? "Sending…" : "Email it again"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setConfirmRevise(true)} disabled={Boolean(busy)}>
            Revise
          </Button>
        </div>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}

function QuoteSummary({ quote, sendResult, onResend, onRevise }) {
  return (
    <div className="space-y-6">
      <EmailSendResult
        result={sendResult}
        kind="Quote"
        linkName="link"
        to={sendResult?.quote.customer_email}
        customerName={quote.customer_name}
      />
      <DecisionAlert quote={quote} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Line items">
            <QuoteItems items={quote.items} />
            <QuoteTotals
              className="mt-4 border-t border-border pt-4 sm:ml-auto sm:max-w-xs"
              subtotal={quote.subtotal_cents}
              tax={quote.tax_cents}
              taxRate={quote.tax_rate}
              total={quote.total_cents}
            />
          </Card>
          <Card title="Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Valid until</dt>
                <dd className="mt-0.5">{quote.valid_until ? formatDate(quote.valid_until) : "No end date"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Notes for the client</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{quote.notes || <span className="text-muted">No notes.</span>}</dd>
              </div>
              {quote.sent_at && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Last sent</dt>
                  <dd className="mt-0.5">{formatMoment(quote.sent_at)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Client link" description="Anyone with this link can see the quote and answer it, without logging in.">
            <CopyLink url={quote.url} label="Quote link" />
            {quote.status === "sent" && (
              <div className="mt-4 border-t border-border pt-4">
                <SentActions quote={quote} onResend={onResend} onRevise={onRevise} />
              </div>
            )}
          </Card>
          <Card title="Customer">
            <CustomerDetails quote={quote} />
          </Card>
          <Card title="Linked">
            <Linked quote={quote} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuoteView({ id }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: quote, setData, error } = useAsync(api, `/api/quotes/${id}`);
  // Messages carried over from the new-quote page, shown once.
  const [sendResult, setSendResult] = useState(location.state?.sendResult || null);
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [sendError] = useState(location.state?.sendError || null);

  // Drop them from the history entry, so a reload does not show them again.
  const hasState = Boolean(location.state);
  useEffect(() => {
    if (hasState) navigate(location.pathname, { replace: true, state: null });
  }, [hasState, navigate, location.pathname]);

  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="Quote not found" back={BACK} />
        <EmptyState title="This quote does not exist or was deleted." />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!quote) return <Loading />;

  async function save(body) {
    const updated = await api(`/api/quotes/${id}`, { method: "PATCH", body });
    setData(updated);
    setNotice("Draft saved.");
    setSendResult(null);
  }

  async function send(body, dirty) {
    if (dirty) setData(await api(`/api/quotes/${id}`, { method: "PATCH", body }));
    const result = await api(`/api/quotes/${id}/send`, { method: "POST" });
    setNotice(null);
    setSendResult(result);
    setData(result.quote);
    window.scrollTo({ top: 0 });
  }

  async function resend() {
    const result = await api(`/api/quotes/${id}/send`, { method: "POST" });
    setSendResult(result);
    setData(result.quote);
  }

  async function revise() {
    setData(await api(`/api/quotes/${id}/revise`, { method: "POST" }));
    setSendResult(null);
    setNotice("Moved back to draft. The link works again once you send it.");
  }

  const draft = quote.status === "draft";
  const closed = quote.closed_reason === "request_accepted";

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        back={BACK}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="[overflow-wrap:anywhere]">{quote.title}</span>
            <QuoteStatusBadge quote={quote} />
          </span>
        }
        description={`Quote #${quote.id} for ${quote.customer_name} · ${formatMoney(quote.total_cents)}`}
      />
      {draft ? (
        <>
          <QuoteEditor
            key={quote.updated_at}
            initial={formFromQuote(quote)}
            saveLabel="Save changes"
            sendBlocked={closed ? "Another quote on this request was accepted." : null}
            onSave={save}
            onSend={send}
          >
            {notice && <Alert tone="success">{notice}</Alert>}
            {sendError && <Alert tone="danger" title="Saved as a draft, but not sent">{sendError}</Alert>}
            {closed && <DecisionAlert quote={quote} />}
          </QuoteEditor>
          <ConfirmDelete
            label="Delete draft"
            description="Permanently deletes this draft. Quotes that were sent cannot be deleted."
            onConfirm={async () => {
              await api(`/api/quotes/${id}`, { method: "DELETE" });
              navigate("/quotes");
            }}
          />
        </>
      ) : (
        <QuoteSummary quote={quote} sendResult={sendResult} onResend={resend} onRevise={revise} />
      )}
    </div>
  );
}
