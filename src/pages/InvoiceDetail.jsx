import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ConfirmDelete from "../components/ConfirmDelete";
import CopyLink from "../components/CopyLink";
import EmailSendResult from "../components/EmailSendResult";
import ErrorMessage from "../components/ErrorMessage";
import { Input, Select, TextArea } from "../components/Field";
import Loading from "../components/Loading";
import { ItemsEditor, QuoteItems, QuoteTotals } from "../components/QuoteLines";
import { Badge, InvoiceStatusBadge, PaidBadge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert, EmptyState, Spinner } from "../components/ui/Feedback";
import { BriefcaseIcon, CheckIcon, DollarIcon, ExternalIcon, MailIcon, MapPinIcon, UsersIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAsync } from "../hooks";
import { formatDay, formatMoney } from "../utils/format";
import {
  MANUAL_METHODS,
  MAX_PAYMENT_NOTE,
  MIN_INVOICE_CENTS,
  PROVIDER_LABELS,
  invoicePath,
  stripePaymentUrl,
} from "../utils/invoices";
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

const BACK = { to: "/invoices", label: "Invoices" };
const FORM_FIELDS = ["title", "customer_name", "customer_email", "customer_address", "notes", "due_date", "tax_rate"];

export default function InvoiceDetail() {
  const { id } = useParams();
  return <InvoiceView key={id} id={id} />;
}

// --- Form state -----------------------------------------------------------------

function formFromInvoice(invoice) {
  return {
    values: {
      title: invoice.title || "",
      customer_name: invoice.customer_name || "",
      customer_email: invoice.customer_email || "",
      customer_address: invoice.customer_address || "",
      notes: invoice.notes || "",
      due_date: invoice.due_date || "",
      tax_rate: invoice.tax_rate_bp ? formatQuantity(invoice.tax_rate) : "",
    },
    items: editorItems(invoice.items),
  };
}

function bodyFrom(values, items) {
  return {
    title: values.title.trim(),
    customer_name: values.customer_name.trim(),
    customer_email: values.customer_email.trim() || null,
    customer_address: values.customer_address.trim() || null,
    notes: values.notes.trim() || null,
    due_date: values.due_date || null,
    tax_rate: values.tax_rate.trim() || "0",
    items: itemsBody(items),
  };
}

function snapshot(values, items) {
  return JSON.stringify(bodyFrom(values, items));
}

function validate(values, items, total, { sending }) {
  const errors = {};
  if (!values.title.trim()) errors.title = "Give the invoice a title.";
  if (!values.customer_name.trim()) errors.customer_name = "Enter the customer's name.";
  const email = values.customer_email.trim();
  if (email && !emailLooksValid(email)) errors.customer_email = "Enter an email address like name@example.com.";
  const taxError = validateTaxRate(values.tax_rate);
  if (taxError) errors.tax_rate = taxError;
  if (sending && values.due_date && values.due_date < localToday()) {
    errors.due_date = "This date has passed. Pick a later date or clear it.";
  }
  const itemErrors = validateItems(items);
  if (sending && !filledItems(items).length) errors.items = "Add at least one item before sending.";
  else if (sending && total < MIN_INVOICE_CENTS) errors.items = "The total must be at least $0.50, the smallest card payment.";
  return { errors, itemErrors };
}

// --- Draft editor ---------------------------------------------------------------

function InvoiceEditor({ initial, onSave, onSend, onMarkPaid, children }) {
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
    const found = validate(values, items, totals.total, { sending });
    const hasErrors = Object.values(found.errors).some(Boolean) || Object.keys(found.itemErrors).length > 0;
    setErrors(found.errors);
    setItemErrors(found.itemErrors);
    setFormError(null);
    if (hasErrors || tooLarge) {
      setFormError(hasErrors ? "Please fix the highlighted fields." : "The total is over $999,999.99, the most one invoice can be.");
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
      if (server.total) known.items = server.total;
      if (Array.isArray(err.data?.errors?.items)) known.items = err.data.errors.items[0];
      setErrors(known);
      setItemErrors(itemErrorsFrom(err));
      setFormError(err.status === 400 && Object.keys(known).length ? "Please fix the highlighted fields." : err.message);
    } finally {
      setBusy(null);
    }
  }

  const disabled = Boolean(busy);
  const lines = filledItems(items).length;

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
              hint="Shown on the invoice. For example: thank you, or how else they can pay."
              disabled={disabled}
            />
            <Input
              label="Due date"
              type="date"
              min={localToday()}
              value={values.due_date}
              onChange={set("due_date")}
              error={errors.due_date}
              hint="Optional. After this day the invoice shows as overdue; it can still be paid."
              disabled={disabled}
              className="sm:max-w-56"
            />
          </div>
        </Card>
        <Card title="Customer" description="Shown on the invoice and used for the email.">
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
      <div className="space-y-6 lg:sticky lg:top-20">
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
                aria-label="Tax rate"
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
            {lines} {lines === 1 ? "item" : "items"}. Tax is worked out on the subtotal and rounded to the cent.
          </p>
          {tooLarge && <Alert tone="danger" className="mt-3">The total is over $999,999.99, the most one invoice can be.</Alert>}
          {formError && <Alert tone="danger" className="mt-3">{formError}</Alert>}
          <div className="mt-4 flex flex-col gap-2">
            <Button size="lg" block onClick={() => run("send")} disabled={disabled}>
              {busy === "send" ? <Spinner className="h-4 w-4 text-current" /> : <MailIcon />}
              {busy === "send" ? "Sending…" : dirty ? "Save and send" : "Send to client"}
            </Button>
            <Button type="submit" variant="secondary" block disabled={disabled || !dirty}>
              {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Sending makes the pay link work and emails it to the customer. Sent invoices cannot be edited; revise one to
            change it.
          </p>
        </Card>
        <Card title="Paid already?" description="Record cash or a check you received, for the full total.">
          <Button
            variant="secondary"
            block
            onClick={onMarkPaid}
            disabled={disabled || dirty || !lines}
            title={dirty ? "Save your changes first." : undefined}
          >
            <DollarIcon />
            Mark paid
          </Button>
          {dirty && <p className="mt-2 text-xs text-muted">Save your changes first.</p>}
        </Card>
      </div>
    </form>
  );
}

// --- Messages -------------------------------------------------------------------

// Payments that arrived but could not be applied: refund them in Stripe, or sort it out with the client.
function AttentionAlert({ invoice }) {
  const flagged = (invoice.payments || []).filter((payment) => !payment.applied);
  if (!flagged.length) return null;
  return (
    <Alert tone="danger" title={flagged.length === 1 ? "A payment needs attention" : `${flagged.length} payments need attention`}>
      <ul className="mt-1 space-y-1.5">
        {flagged.map((payment) => (
          <li key={payment.id}>
            <span className="font-medium tabular-nums">{formatMoney(payment.amount_cents)}</span> on{" "}
            {formatMoment(payment.created_at)}: {payment.flag_message}
            {payment.provider === "stripe" && payment.payment_intent_id && (
              <>
                {" "}
                <a
                  href={stripePaymentUrl(payment.payment_intent_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  Open in Stripe
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function StatusAlert({ invoice }) {
  if (invoice.status === "paid") {
    return (
      <Alert tone="success" title={`Paid${invoice.paid_at ? ` on ${formatMoment(invoice.paid_at)}` : ""}`}>
        {formatMoney(invoice.amount_paid_cents)} received.
        {invoice.job && " The job is marked paid."}
      </Alert>
    );
  }
  if (invoice.status === "void") {
    return (
      <Alert tone="info" title={`Voided${invoice.voided_at ? ` on ${formatMoment(invoice.voided_at)}` : ""}`}>
        The pay link shows the invoice as voided and it cannot be paid.
        {invoice.job_id && " The job can get a new invoice."}
      </Alert>
    );
  }
  if (invoice.overdue) {
    return (
      <Alert tone="warning" title={`Overdue since ${formatDate(invoice.due_date)}`}>
        The client can still pay it from the link. Email it again as a reminder.
      </Alert>
    );
  }
  return null;
}

// --- Cards ----------------------------------------------------------------------

function PaymentsCard({ invoice }) {
  const payments = invoice.payments || [];
  if (!payments.length) return null;
  return (
    <Card title={invoice.status === "paid" ? "Payment" : "Payments"}>
      <ul className="divide-y divide-border">
        {payments.map((payment) => (
          <li key={payment.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">
                  {payment.method_label} · {PROVIDER_LABELS[payment.provider] || payment.provider}
                </p>
                <p className="text-xs text-muted">{formatMoment(payment.created_at)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-fg">{formatMoney(payment.amount_cents)}</p>
                {payment.applied ? <Badge tone="success">Applied</Badge> : <Badge tone="danger">Not applied</Badge>}
              </div>
            </div>
            {payment.note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">{payment.note}</p>}
            {(payment.payment_intent_id || payment.checkout_session_id) && (
              <dl className="mt-2 space-y-0.5 text-xs text-muted">
                {payment.payment_intent_id && (
                  <div className="flex gap-1.5">
                    <dt>Payment:</dt>
                    <dd className="min-w-0 break-all font-mono">
                      {payment.provider === "stripe" ? (
                        <a href={stripePaymentUrl(payment.payment_intent_id)} target="_blank" rel="noopener noreferrer" className="link">
                          {payment.payment_intent_id}
                        </a>
                      ) : (
                        payment.payment_intent_id
                      )}
                    </dd>
                  </div>
                )}
                {payment.checkout_session_id && (
                  <div className="flex gap-1.5">
                    <dt>Checkout:</dt>
                    <dd className="min-w-0 break-all font-mono">{payment.checkout_session_id}</dd>
                  </div>
                )}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CustomerDetails({ invoice }) {
  return (
    <dl className="space-y-2.5 text-sm">
      <div className="font-medium text-fg">{invoice.customer_name}</div>
      <div className="flex gap-2.5">
        <dt className="mt-0.5 text-muted"><MailIcon className="h-4 w-4" /><span className="sr-only">Email</span></dt>
        <dd className="min-w-0 break-all">
          {invoice.customer_email ? (
            <a href={`mailto:${invoice.customer_email}`} className="link">{invoice.customer_email}</a>
          ) : (
            <span className="text-muted">No email</span>
          )}
        </dd>
      </div>
      <div className="flex gap-2.5">
        <dt className="mt-0.5 text-muted"><MapPinIcon className="h-4 w-4" /><span className="sr-only">Address</span></dt>
        <dd className="min-w-0">{invoice.customer_address || <span className="text-muted">No address</span>}</dd>
      </div>
    </dl>
  );
}

function Linked({ invoice }) {
  const rows = [];
  if (invoice.job) {
    rows.push(
      <li key="job" className="flex items-center justify-between gap-3">
        <Link to={`/jobs/${invoice.job.id}`} className="link inline-flex min-w-0 items-center gap-2">
          <BriefcaseIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {invoice.job.service_type} · {formatDay(invoice.job.date)}
          </span>
        </Link>
        <span className="flex shrink-0 gap-1">
          <StatusBadge status={invoice.job.status} />
          <PaidBadge paid={invoice.job.paid} />
        </span>
      </li>,
    );
  }
  if (invoice.quote_id) {
    rows.push(
      <li key="quote">
        <Link to={`/quotes/${invoice.quote_id}`} className="link inline-flex items-center gap-2">
          <DollarIcon className="h-4 w-4" />
          Quote #{invoice.quote_id}
        </Link>
      </li>,
    );
  }
  if (invoice.client) {
    rows.push(
      <li key="client" className="flex items-center justify-between gap-3">
        <Link to={`/clients/${invoice.client.id}`} className="link inline-flex min-w-0 items-center gap-2">
          <UsersIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{invoice.client.name}</span>
        </Link>
        {invoice.client.archived && <Badge>Archived</Badge>}
      </li>,
    );
  }
  if (!rows.length) return <p className="text-sm text-muted">The job and client were deleted. The invoice keeps its own copy.</p>;
  return <ul className="space-y-2.5 text-sm">{rows}</ul>;
}

// Email again, revise, void, and mark paid, for a sent invoice. Revise and void ask first.
function SentActions({ invoice, onResend, onRevise, onVoid, onMarkPaid, onRemind }) {
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const [reminded, setReminded] = useState(null);

  async function run(kind, action) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      setConfirm(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  if (confirm) {
    const voiding = confirm === "void";
    return (
      <div className="space-y-3">
        <Alert tone="warning">
          {voiding
            ? "Voiding cancels the invoice for good: the link shows it as voided and it cannot be paid. You can make a new invoice for the job afterwards."
            : "The link stops working until you send the invoice again, so the client cannot pay it while you edit."}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={voiding ? "danger" : "primary"}
            onClick={() => run(confirm, voiding ? onVoid : onRevise)}
            disabled={Boolean(busy)}
          >
            {busy ? (voiding ? "Voiding…" : "Moving to draft…") : voiding ? "Void invoice" : "Revise invoice"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={Boolean(busy)}>
            Cancel
          </Button>
        </div>
        <ErrorMessage error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <Button onClick={onMarkPaid} disabled={Boolean(busy)}>
          <DollarIcon />
          Mark paid
        </Button>
        {invoice.customer_email && (
          <Button variant="secondary" onClick={() => run("resend", onResend)} disabled={Boolean(busy)}>
            <MailIcon />
            {busy === "resend" ? "Sending…" : "Email it again"}
          </Button>
        )}
        {invoice.customer_email && invoice.overdue && (
          <Button
            variant="secondary"
            onClick={() => run("remind", async () => setReminded(await onRemind()))}
            disabled={Boolean(busy)}
          >
            <MailIcon />
            {busy === "remind" ? "Sending…" : "Send reminder"}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirm("revise")} disabled={Boolean(busy)}>
            Revise
          </Button>
          <Button variant="danger-outline" onClick={() => setConfirm("void")} disabled={Boolean(busy)}>
            Void
          </Button>
        </div>
      </div>
      {reminded && (
        <p className="text-xs text-muted">
          {reminded.email_delivery === "log"
            ? "Email is not set up yet, so the reminder was only written to the server log."
            : `Reminder sent to ${invoice.customer_email}.`}
        </p>
      )}
      {invoice.last_reminder_at && !reminded && (
        <p className="text-xs text-muted">
          Last reminder {new Date(invoice.last_reminder_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {invoice.reminders_sent ? ` · ${invoice.reminders_sent} sent automatically` : ""}
        </p>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}

function MarkPaidDialog({ invoice, onClose, onConfirm }) {
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ method, note: note.trim() || null });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Mark ${invoice.label} paid?`}
      description="For money you received outside online payment, such as cash or a check."
      onClose={() => !busy && onClose()}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-fg">
          This records <span className="font-semibold tabular-nums">{formatMoney(invoice.total_cents)}</span>, the full
          total, and marks the invoice{invoice.job ? " and its job" : ""} paid. It cannot be undone.
          {invoice.customer_email && ` ${invoice.customer_name} gets a receipt by email.`}
        </p>
        <Select label="Method" value={method} onChange={(event) => setMethod(event.target.value)} disabled={busy}>
          {MANUAL_METHODS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_PAYMENT_NOTE}
          placeholder="Optional, like a check number"
          disabled={busy}
        />
        <ErrorMessage error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4 text-current" /> : <CheckIcon />}
            {busy ? "Recording…" : `Record ${formatMoney(invoice.total_cents)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InvoiceSummary({ invoice, sendResult, onResend, onRevise, onVoid, onMarkPaid, onRemind }) {
  const paid = invoice.status === "paid";
  return (
    <div className="space-y-6">
      <EmailSendResult
        result={sendResult}
        kind="Invoice"
        linkName="pay link"
        to={sendResult?.invoice.customer_email}
        customerName={sendResult?.invoice.customer_name}
      />
      <AttentionAlert invoice={invoice} />
      <StatusAlert invoice={invoice} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Line items">
            <QuoteItems items={invoice.items} />
            <QuoteTotals
              className="mt-4 border-t border-border pt-4 sm:ml-auto sm:max-w-xs"
              subtotal={invoice.subtotal_cents}
              tax={invoice.tax_cents}
              taxRate={invoice.tax_rate}
              total={invoice.total_cents}
            />
          </Card>
          <PaymentsCard invoice={invoice} />
          <Card title="Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Due date</dt>
                <dd className={cx("mt-0.5", invoice.overdue && "font-medium text-warning")}>
                  {invoice.due_date ? formatDate(invoice.due_date) : "No due date"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Notes for the client</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{invoice.notes || <span className="text-muted">No notes.</span>}</dd>
              </div>
              {invoice.sent_at && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Last sent</dt>
                  <dd className="mt-0.5">{formatMoment(invoice.sent_at)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
        <div className="space-y-6">
          <Card
            title={paid ? "Receipt link" : "Pay link"}
            description={
              paid
                ? "The link now shows the client their receipt."
                : invoice.status === "void"
                  ? "The link shows the invoice as voided."
                  : "Anyone with this link can see the invoice and pay it, without logging in."
            }
          >
            <CopyLink url={invoice.url} label="Pay link" openLabel="Open public page" />
            {invoice.status === "sent" && (
              <div className="mt-4 border-t border-border pt-4">
                <SentActions
                  invoice={invoice}
                  onResend={onResend}
                  onRevise={onRevise}
                  onVoid={onVoid}
                  onMarkPaid={onMarkPaid}
                  onRemind={onRemind}
                />
              </div>
            )}
          </Card>
          <Card title="Customer">
            <CustomerDetails invoice={invoice} />
          </Card>
          <Card title="Linked">
            <Linked invoice={invoice} />
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Page -------------------------------------------------------------------------

function InvoiceView({ id }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: invoice, setData, error } = useAsync(api, invoicePath(id));
  const [sendResult, setSendResult] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [markingPaid, setMarkingPaid] = useState(false);

  // Drop the carried-over notice from the history entry, so a reload does not show it again.
  const hasState = Boolean(location.state);
  useEffect(() => {
    if (hasState) navigate(location.pathname, { replace: true, state: null });
  }, [hasState, navigate, location.pathname]);

  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="Invoice not found" back={BACK} />
        <EmptyState title="This invoice does not exist or was deleted." />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!invoice) return <Loading />;

  async function save(body) {
    setData(await api(invoicePath(id), { method: "PATCH", body }));
    setNotice("Draft saved.");
    setSendResult(null);
  }

  async function send(body, dirty) {
    if (dirty) setData(await api(invoicePath(id), { method: "PATCH", body }));
    const result = await api(invoicePath(id, "/send"), { method: "POST" });
    setNotice(null);
    setSendResult(result);
    setData(result.invoice);
    window.scrollTo({ top: 0 });
  }

  async function resend() {
    const result = await api(invoicePath(id, "/send"), { method: "POST" });
    setSendResult(result);
    setData(result.invoice);
  }

  async function remind() {
    const result = await api(invoicePath(id, "/remind"), { method: "POST" });
    setData(result.invoice);
    return result;
  }

  async function revise() {
    setData(await api(invoicePath(id, "/revise"), { method: "POST" }));
    setSendResult(null);
    setNotice("Moved back to draft. The link works again once you send it.");
  }

  async function voidInvoice() {
    setData(await api(invoicePath(id, "/void"), { method: "POST" }));
    setSendResult(null);
    setNotice(null);
  }

  async function markPaid(body) {
    setData(await api(invoicePath(id, "/mark-paid"), { method: "POST", body }));
    setMarkingPaid(false);
    setSendResult(null);
    setNotice(null);
    window.scrollTo({ top: 0 });
  }

  const draft = invoice.status === "draft";

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        back={BACK}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular-nums">{invoice.label}</span>
            <InvoiceStatusBadge invoice={invoice} />
          </span>
        }
        description={`${invoice.title} · ${invoice.customer_name} · ${formatMoney(invoice.total_cents)}`}
        actions={
          invoice.status !== "draft" && (
            <a href={invoice.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5 text-sm">
              <ExternalIcon className="h-4 w-4" />
              Public page
            </a>
          )
        }
      />
      {draft ? (
        <>
          <InvoiceEditor
            key={invoice.updated_at}
            initial={formFromInvoice(invoice)}
            onSave={save}
            onSend={send}
            onMarkPaid={() => setMarkingPaid(true)}
          >
            {notice && <Alert tone="success">{notice}</Alert>}
            <AttentionAlert invoice={invoice} />
            <Card title="Linked">
              <Linked invoice={invoice} />
            </Card>
          </InvoiceEditor>
          {!invoice.payments?.length && (
            <ConfirmDelete
              label="Delete draft"
              description="Permanently deletes this draft. Invoices that were sent cannot be deleted; void them instead."
              onConfirm={async () => {
                await api(invoicePath(id), { method: "DELETE" });
                navigate("/invoices");
              }}
            />
          )}
        </>
      ) : (
        <InvoiceSummary
          invoice={invoice}
          sendResult={sendResult}
          onResend={resend}
          onRevise={revise}
          onVoid={voidInvoice}
          onMarkPaid={() => setMarkingPaid(true)}
          onRemind={remind}
        />
      )}
      {markingPaid && <MarkPaidDialog invoice={invoice} onClose={() => setMarkingPaid(false)} onConfirm={markPaid} />}
    </div>
  );
}
