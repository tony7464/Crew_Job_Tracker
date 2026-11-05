import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { BusinessHeading, PublicShell, StatusCard } from "../components/PublicPage";
import { QuoteItems, QuoteTotals } from "../components/QuoteLines";
import { Button } from "../components/ui/Button";
import { Alert, Spinner } from "../components/ui/Feedback";
import { AlertIcon, CheckIcon, ClockIcon, InfoIcon, XIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { cx } from "../components/ui/styles";
import { formatMoney } from "../utils/format";
import { MAX_DECLINE_REASON, formatDate, formatMoment } from "../utils/quotes";

const FALLBACK_NAME = "Your quote";
const FOOTER = "Quote by Crew Job Tracker";

function quotePath(token, action = "") {
  return `/api/public/quotes/${encodeURIComponent(token)}${action}`;
}

function sentence(text) {
  return text.endsWith(".") ? text : `${text}.`;
}

export default function PublicQuotePage() {
  const { token } = useParams();
  return <PublicQuote key={token} token={token} />;
}

// A wide banner above the quote for every state where it cannot be answered.
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
        <div className="mt-0.5 opacity-90">{children}</div>
      </div>
    </div>
  );
}

function StateBanner({ quote }) {
  const business = quote.business_name || "the business";
  if (quote.status === "accepted") {
    return (
      <Banner icon={CheckIcon} tone="success" title="You accepted this quote">
        {quote.decided_at ? `On ${formatMoment(quote.decided_at)}. ` : ""}
        {sentence(`${quote.business_name || "The business"} will be in touch to schedule the work`)}
      </Banner>
    );
  }
  if (quote.status === "declined") {
    return (
      <Banner icon={XIcon} tone="neutral" title="You declined this quote">
        {quote.decline_reason && (
          <p className="mb-1 whitespace-pre-wrap italic">“{quote.decline_reason}”</p>
        )}
        <p>Changed your mind? Contact {business} directly.</p>
      </Banner>
    );
  }
  if (quote.closed_reason === "request_accepted") {
    return (
      <Banner icon={InfoIcon} tone="info" title="This quote is closed">
        This request was already accepted on another quote, so there is nothing more to do here.
      </Banner>
    );
  }
  if (quote.closed_reason === "expired") {
    return (
      <Banner icon={ClockIcon} tone="warning" title={`This quote expired on ${formatDate(quote.valid_until)}`}>
        It can no longer be accepted. Contact {business} for an updated quote.
      </Banner>
    );
  }
  return null;
}

function QuoteCard({ quote, children }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="border-b border-border p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quote</p>
            <h2 className="mt-0.5 text-lg font-semibold text-fg [overflow-wrap:anywhere] sm:text-xl">{quote.title}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg sm:text-xl">{formatMoney(quote.total_cents)}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:gap-x-6">
          <div>
            <dt className="text-xs text-muted">Prepared for</dt>
            <dd className="text-fg">{quote.customer_name}</dd>
          </div>
          {quote.customer_address && (
            <div>
              <dt className="text-xs text-muted">Address</dt>
              <dd className="text-fg [overflow-wrap:anywhere]">{quote.customer_address}</dd>
            </div>
          )}
          {quote.sent_at && (
            <div>
              <dt className="text-xs text-muted">Sent</dt>
              <dd className="text-fg">{formatMoment(quote.sent_at)}</dd>
            </div>
          )}
          {quote.valid_until && (
            <div>
              <dt className="text-xs text-muted">Valid until</dt>
              <dd className={cx(quote.expired ? "font-medium text-warning" : "text-fg")}>
                {formatDate(quote.valid_until)}
                {quote.expired && " (expired)"}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="p-4 sm:p-6">
        <QuoteItems items={quote.items} />
        <QuoteTotals
          className="mt-4 border-t border-border pt-4 sm:ml-auto sm:max-w-xs"
          subtotal={quote.subtotal_cents}
          tax={quote.tax_cents}
          taxRate={quote.tax_rate}
          total={quote.total_cents}
        />
      </div>
      {quote.notes && (
        <div className="border-t border-border p-4 sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">{quote.notes}</p>
        </div>
      )}
      {children}
    </article>
  );
}

function PublicQuote({ token }) {
  // phase: loading | missing | failed | limited | ready
  const [phase, setPhase] = useState("loading");
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  // A second click can arrive before React re-renders the disabled button.
  const inFlight = useRef(false);

  const applyLoadError = useCallback((err) => {
    setLoadError(err);
    if (err.status === 404) setPhase("missing");
    else if (err.status === 429) setPhase("limited");
    else setPhase("failed");
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api(quotePath(token), { skipAuth: true });
      setQuote(data);
      setPhase("ready");
      return data;
    } catch (err) {
      applyLoadError(err);
      return null;
    }
  }, [token, applyLoadError]);

  useEffect(() => {
    let cancelled = false;
    api(quotePath(token), { skipAuth: true })
      .then((data) => {
        if (cancelled) return;
        setQuote(data);
        setPhase("ready");
      })
      .catch((err) => {
        if (!cancelled) applyLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [token, applyLoadError]);

  useEffect(() => {
    const name = quote?.business_name;
    document.title = name ? `${name} · Quote` : "Quote";
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, [quote?.business_name]);

  // After a 429, keep the buttons off until the wait is over.
  useEffect(() => {
    if (!blockedUntil) return undefined;
    const id = setTimeout(() => setBlockedUntil(0), Math.max(0, blockedUntil - Date.now()));
    return () => clearTimeout(id);
  }, [blockedUntil]);

  function open(kind) {
    setActionError(null);
    setDialog(kind);
  }

  function close() {
    if (busy) return;
    setDialog(null);
    setActionError(null);
  }

  async function answer(kind) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    setActionError(null);
    try {
      const body = kind === "decline" ? { reason: reason.trim() || null } : undefined;
      const data = await api(quotePath(token, `/${kind}`), { method: "POST", skipAuth: true, body });
      setQuote(data);
      setDialog(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err.status === 409) {
        // Answered already (maybe in another tab), expired, or closed: show the quote as it is now.
        setDialog(null);
        await load();
      } else if (err.status === 404) {
        setDialog(null);
        setPhase("missing");
      } else if (err.status === 429) {
        setBlockedUntil(Date.now() + (err.retryAfter || 60) * 1000);
        setActionError(err.message);
      } else if (err.status === 400) {
        setActionError(err.data?.errors?.reason?.[0] || err.message);
      } else {
        setActionError(err.status ? err.message : "Could not reach the server. Check your connection and try again.");
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  if (phase === "loading") {
    return (
      <PublicShell footer={FOOTER}>
        <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-muted">
          <Spinner />
          Loading the quote…
        </div>
      </PublicShell>
    );
  }
  if (phase === "missing") {
    return (
      <PublicShell title={<BusinessHeading name={quote?.business_name} fallback={FALLBACK_NAME} />} footer={FOOTER}>
        <StatusCard title="This quote is not available">
          The link may be wrong, or the quote is being updated. Ask the business for the current link.
        </StatusCard>
      </PublicShell>
    );
  }
  if (phase === "failed" || phase === "limited") {
    return (
      <PublicShell title={<BusinessHeading name={null} fallback={FALLBACK_NAME} />} footer={FOOTER}>
        <StatusCard icon={AlertIcon} tone="warning" title={phase === "limited" ? "Too many requests" : "The quote could not load"}>
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

  const business = quote.business_name || "the business";
  const blocked = blockedUntil > 0;
  const total = formatMoney(quote.total_cents);

  return (
    <PublicShell
      title={<BusinessHeading name={quote.business_name} fallback={FALLBACK_NAME} subtitle={`A quote for ${quote.customer_name}`} />}
      footer={FOOTER}
    >
      <StateBanner quote={quote} />
      <QuoteCard quote={quote}>
        {quote.can_respond && (
          <div className="border-t border-border bg-surface-2/60 p-4 sm:p-6">
            {actionError && !dialog && <Alert tone="danger" className="mb-3">{actionError}</Alert>}
            {/* Accept first on phones; on wider screens Decline sits left and Accept right. */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" block className="sm:order-2" onClick={() => open("accept")} disabled={Boolean(busy) || blocked}>
                <CheckIcon className="h-5 w-5" />
                Accept quote
              </Button>
              <Button
                size="lg"
                variant="secondary"
                block
                className="sm:order-1"
                onClick={() => open("decline")}
                disabled={Boolean(busy) || blocked}
              >
                Decline
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              {sentence(`Accepting tells ${business} to go ahead. They will contact you to schedule`)}
            </p>
          </div>
        )}
      </QuoteCard>

      {dialog === "accept" && (
        <Modal title="Accept this quote?" onClose={close} size="sm">
          <p className="text-sm text-fg">
            You are accepting <span className="font-medium">{quote.title}</span> for{" "}
            <span className="font-semibold tabular-nums">{total}</span>.
          </p>
          <p className="mt-2 text-sm text-muted">{sentence(`${quote.business_name || "The business"} will be in touch to schedule the work`)}</p>
          {actionError && <Alert tone="danger" className="mt-4">{actionError}</Alert>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={Boolean(busy)}>Cancel</Button>
            <Button onClick={() => answer("accept")} disabled={Boolean(busy) || blocked}>
              {busy === "accept" ? <Spinner className="h-4 w-4 text-current" /> : <CheckIcon />}
              {busy === "accept" ? "Accepting…" : `Accept for ${total}`}
            </Button>
          </div>
        </Modal>
      )}
      {dialog === "decline" && (
        <Modal title="Decline this quote?" onClose={close} size="sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              answer("decline");
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg">
                Reason <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows="3"
                maxLength={MAX_DECLINE_REASON}
                placeholder={`Let ${business} know why, if you like.`}
                className="field min-h-20"
                disabled={Boolean(busy)}
              />
              {reason.length > MAX_DECLINE_REASON - 100 && (
                <span className="mt-1 block text-xs text-muted">{MAX_DECLINE_REASON - reason.length} characters left</span>
              )}
            </label>
            {actionError && <Alert tone="danger" className="mt-4">{actionError}</Alert>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={close} disabled={Boolean(busy)}>Cancel</Button>
              <Button type="submit" variant="danger" disabled={Boolean(busy) || blocked}>
                {busy === "decline" ? <Spinner className="h-4 w-4 text-current" /> : null}
                {busy === "decline" ? "Declining…" : "Decline quote"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </PublicShell>
  );
}
