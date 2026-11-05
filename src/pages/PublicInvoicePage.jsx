import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { BusinessHeading, PublicShell, StatusCard } from "../components/PublicPage";
import { QuoteItems, QuoteTotals } from "../components/QuoteLines";
import { Button } from "../components/ui/Button";
import { Alert, Spinner } from "../components/ui/Feedback";
import { AlertIcon, CheckIcon, ClockIcon, DollarIcon, InfoIcon, XIcon } from "../components/ui/Icons";
import { cx } from "../components/ui/styles";
import { formatMoney } from "../utils/format";
import { publicInvoicePath } from "../utils/invoices";
import { formatDate, formatMoment } from "../utils/quotes";

const FALLBACK_NAME = "Your invoice";
const FOOTER = "Invoice by Crew Job Tracker · Payments by Stripe";
// After Stripe sends the client back, check every 2 seconds for up to a minute.
const POLL_MS = 2000;
const POLL_TRIES = 30;

// Adds a period unless the text already ends with one (business names like "Co.").
function sentence(text) {
  return text.endsWith(".") ? text : `${text}.`;
}

export default function PublicInvoicePage() {
  const { token } = useParams();
  return <PublicInvoice key={token} token={token} />;
}

// A wide banner above the invoice, for every state other than "ready to pay".
function Banner({ icon: Icon, tone, title, children }) {
  const tones = {
    success: "border-success/30 bg-success-soft text-success-soft-fg",
    warning: "border-warning/30 bg-warning-soft text-warning-soft-fg",
    neutral: "border-border bg-surface-2 text-fg",
    info: "border-primary/25 bg-primary-soft text-primary-soft-fg",
  };
  return (
    <div role="status" className={cx("mb-4 flex gap-3 rounded-2xl border p-4 sm:p-5", tones[tone])}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface/70">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-base font-semibold">{title}</p>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
    </div>
  );
}

function InvoiceCard({ invoice, children }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card print:shadow-none">
      <div className="border-b border-border p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Invoice <span className="tabular-nums">{invoice.number}</span>
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-fg [overflow-wrap:anywhere] sm:text-xl">{invoice.title}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {invoice.status === "paid" ? "Paid" : "Amount due"}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg sm:text-xl">{formatMoney(invoice.total_cents)}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:gap-x-6">
          <div>
            <dt className="text-xs text-muted">Billed to</dt>
            <dd className="text-fg">{invoice.customer_name}</dd>
          </div>
          {invoice.customer_address && (
            <div>
              <dt className="text-xs text-muted">Address</dt>
              <dd className="text-fg [overflow-wrap:anywhere]">{invoice.customer_address}</dd>
            </div>
          )}
          {invoice.sent_at && (
            <div>
              <dt className="text-xs text-muted">Sent</dt>
              <dd className="text-fg">{formatMoment(invoice.sent_at)}</dd>
            </div>
          )}
          {invoice.due_date && (
            <div>
              <dt className="text-xs text-muted">Due</dt>
              <dd className={cx(invoice.overdue ? "font-medium text-warning" : "text-fg")}>
                {formatDate(invoice.due_date)}
                {invoice.overdue && " (overdue)"}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="p-4 sm:p-6">
        <QuoteItems items={invoice.items} />
        <QuoteTotals
          className="mt-4 border-t border-border pt-4 sm:ml-auto sm:max-w-xs"
          subtotal={invoice.subtotal_cents}
          tax={invoice.tax_cents}
          taxRate={invoice.tax_rate}
          total={invoice.total_cents}
        />
      </div>
      {invoice.notes && (
        <div className="border-t border-border p-4 sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">{invoice.notes}</p>
        </div>
      )}
      {children}
    </article>
  );
}

function Receipt({ invoice }) {
  const receipt = invoice.receipt;
  return (
    <section className="mb-4 rounded-2xl border border-success/30 bg-surface p-4 shadow-card print:shadow-none sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-fg">Payment received</h2>
          <p className="text-sm text-muted">
            {sentence(`Thank you. This is your receipt from ${invoice.business_name || "the business"}`)}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Amount paid</dt>
          <dd className="font-semibold tabular-nums text-fg">{formatMoney(receipt?.amount_cents ?? invoice.total_cents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Paid on</dt>
          <dd className="text-fg">{receipt?.paid_at ? formatMoment(receipt.paid_at) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Method</dt>
          <dd className="text-fg">{receipt?.method || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Invoice</dt>
          <dd className="tabular-nums text-fg">{invoice.number}</dd>
        </div>
      </dl>
      <Button variant="secondary" className="mt-4 print:hidden" onClick={() => window.print()}>
        Print receipt
      </Button>
    </section>
  );
}

function PublicInvoice({ token }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // What Stripe (or the mock checkout) sent the client back with. Read once.
  const [returned] = useState(() => ({
    checkout: params.get("checkout"),
    sessionId: params.get("session_id"),
  }));
  // phase: loading | missing | failed | limited | ready
  const [phase, setPhase] = useState("loading");
  const [invoice, setInvoice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // checking: back from Stripe and waiting for the payment to show; slow: gave up polling.
  const [checking, setChecking] = useState(returned.checkout === "success" ? "checking" : null);
  const [paying, setPaying] = useState(null);
  const [payError, setPayError] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const inFlight = useRef(false);

  const fetchInvoice = useCallback(
    (sessionId) => api(publicInvoicePath(token, sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""), { skipAuth: true }),
    [token],
  );

  const applyLoadError = useCallback((err) => {
    setLoadError(err);
    if (err.status === 404) setPhase("missing");
    else if (err.status === 429) setPhase("limited");
    else setPhase("failed");
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchInvoice();
      setInvoice(data);
      setPhase("ready");
      return data;
    } catch (err) {
      applyLoadError(err);
      return null;
    }
  }, [fetchInvoice, applyLoadError]);

  // The first load. Back from Stripe, it asks the server to check the session too.
  useEffect(() => {
    let cancelled = false;
    fetchInvoice(returned.checkout === "success" ? returned.sessionId : null)
      .then((data) => {
        if (cancelled) return;
        setInvoice(data);
        setPhase("ready");
      })
      .catch((err) => {
        if (!cancelled) applyLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchInvoice, applyLoadError, returned]);

  // Clean the address bar once the return is handled, so a reload or a shared link is just the invoice.
  useEffect(() => {
    if (returned.checkout) navigate(`/pay/${encodeURIComponent(token)}`, { replace: true });
  }, [returned.checkout, navigate, token]);

  // Back from Stripe, the webhook may land a moment after the client does: check again for a while.
  const status = invoice?.status;
  useEffect(() => {
    if (checking !== "checking" || status !== "sent") return undefined;
    let tries = 0;
    let cancelled = false;
    let timer;
    const tick = async () => {
      tries += 1;
      try {
        const data = await fetchInvoice(returned.sessionId);
        if (cancelled) return;
        setInvoice(data);
        if (data.status !== "sent") return;
      } catch {
        // A dropped request is fine: try again on the next tick.
      }
      if (cancelled) return;
      if (tries >= POLL_TRIES) setChecking("slow");
      else timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checking, status, fetchInvoice, returned.sessionId]);

  useEffect(() => {
    const name = invoice?.business_name;
    document.title = name ? `${name} · Invoice ${invoice.number}` : "Invoice";
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, [invoice?.business_name, invoice?.number]);

  useEffect(() => {
    if (!blockedUntil) return undefined;
    const id = setTimeout(() => setBlockedUntil(0), Math.max(0, blockedUntil - Date.now()));
    return () => clearTimeout(id);
  }, [blockedUntil]);

  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPaying("starting");
    setPayError(null);
    try {
      const { url } = await api(publicInvoicePath(token, "/checkout"), { method: "POST", skipAuth: true });
      setPaying("redirecting");
      window.location.assign(url);
      return;
    } catch (err) {
      setPaying(null);
      if (err.data?.errors?.payment) {
        // Not available right now (not connected, or Stripe is off): say so, and show the invoice as it is.
        setUnavailable(err.data.errors.payment[0]);
        await load();
      } else if (err.status === 409 || err.status === 404) {
        // Paid or voided meanwhile (maybe in another tab).
        await load();
      } else if (err.status === 429) {
        setBlockedUntil(Date.now() + (err.retryAfter || 60) * 1000);
        setPayError(err.message);
      } else {
        setPayError(err.status ? err.message : "Could not reach the server. Check your connection and try again.");
      }
    } finally {
      inFlight.current = false;
    }
  }

  if (phase === "loading") {
    return (
      <PublicShell footer={FOOTER}>
        <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-muted">
          <Spinner />
          {returned.checkout === "success" ? "Confirming your payment…" : "Loading the invoice…"}
        </div>
      </PublicShell>
    );
  }
  if (phase === "missing") {
    return (
      <PublicShell title={<BusinessHeading name={null} fallback={FALLBACK_NAME} />} footer={FOOTER}>
        <StatusCard title="This invoice is not available">
          The link may be wrong, or the invoice is being updated. Ask the business for the current link.
        </StatusCard>
      </PublicShell>
    );
  }
  if (phase === "failed" || phase === "limited") {
    return (
      <PublicShell title={<BusinessHeading name={null} fallback={FALLBACK_NAME} />} footer={FOOTER}>
        <StatusCard icon={AlertIcon} tone="warning" title={phase === "limited" ? "Too many requests" : "The invoice could not load"}>
          <p>{phase === "limited" ? loadError?.message : "Check your connection and try again."}</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              setPhase("loading");
              load();
            }}
          >
            Try again
          </Button>
        </StatusCard>
      </PublicShell>
    );
  }

  const business = invoice.business_name || "the business";
  // Only while the invoice is still unpaid; once paid (or voided) the receipt or banner shows instead.
  const confirming = invoice.status === "sent" ? checking : null;
  const unavailableMessage = invoice.status === "sent" && !invoice.can_pay ? invoice.payment_unavailable || unavailable : null;
  const blocked = blockedUntil > 0;

  return (
    <PublicShell
      title={
        <BusinessHeading name={invoice.business_name} fallback={FALLBACK_NAME} subtitle={`Invoice ${invoice.number} for ${invoice.customer_name}`} />
      }
      footer={FOOTER}
    >
      {invoice.status === "paid" && <Receipt invoice={invoice} />}
      {invoice.status === "void" && (
        <Banner icon={XIcon} tone="neutral" title="This invoice was voided">
          There is nothing to pay. Contact {business} if you think this is a mistake.
        </Banner>
      )}
      {confirming === "checking" && (
        <Banner icon={ClockIcon} tone="info" title="Confirming your payment…">
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4 text-current" />
            This usually takes a few seconds. You do not need to pay again.
          </span>
        </Banner>
      )}
      {confirming === "slow" && (
        <Banner icon={ClockIcon} tone="warning" title="Your payment is still processing">
          Stripe has not confirmed it yet. Do not pay again: refresh this page in a minute, or contact {business}.
        </Banner>
      )}
      {invoice.status === "sent" && !confirming && returned.checkout === "cancelled" && (
        <Banner icon={InfoIcon} tone="info" title="Payment cancelled">
          You have not been charged. You can pay whenever you are ready.
        </Banner>
      )}
      <InvoiceCard invoice={invoice}>
        {invoice.status === "sent" && !confirming && (
          <div className="border-t border-border bg-surface-2/60 p-4 print:hidden sm:p-6">
            {unavailableMessage ? (
              <Alert tone="warning">{unavailableMessage}</Alert>
            ) : (
              <>
                {payError && <Alert tone="danger" className="mb-3">{payError}</Alert>}
                <Button size="lg" block onClick={pay} disabled={Boolean(paying) || blocked}>
                  {paying ? <Spinner className="h-5 w-5 text-current" /> : <DollarIcon className="h-5 w-5" />}
                  {paying === "redirecting"
                    ? "Opening secure checkout…"
                    : paying
                      ? "Starting checkout…"
                      : `Pay ${formatMoney(invoice.total_cents)}`}
                </Button>
                <p className="mt-3 text-center text-xs text-muted">
                  You pay by card on Stripe&apos;s secure page, then come back here for your receipt.
                </p>
              </>
            )}
          </div>
        )}
      </InvoiceCard>
    </PublicShell>
  );
}
