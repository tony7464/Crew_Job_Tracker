import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { BusinessHeading, PublicShell, StatusCard } from "../components/PublicPage";
import { Button } from "../components/ui/Button";
import { Alert, Spinner } from "../components/ui/Feedback";
import { AlertIcon, CheckIcon } from "../components/ui/Icons";
import { formatMoney } from "../utils/format";
import { publicInvoicePath } from "../utils/invoices";

const FOOTER = "Test payment page · STRIPE_MOCK=1 · No card is charged";

// STRIPE_MOCK=1 only: stands in for Stripe Checkout, so the whole payment flow can be
// tried without Stripe. Pay records the payment the same way the webhook would.
export default function MockCheckoutPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  return <MockCheckout key={token} token={token} sessionId={params.get("session_id") || ""} />;
}

function MockCheckout({ token, sessionId }) {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const payPage = `/pay/${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;
    api(publicInvoicePath(token), { skipAuth: true })
      .then((data) => !cancelled && setInvoice(data))
      .catch((err) => !cancelled && setLoadError(err));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    document.title = "Test payment (mock mode)";
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, []);

  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api(publicInvoicePath(token, "/mock-complete"), { method: "POST", skipAuth: true, body: { session_id: sessionId } });
      navigate(payPage, { replace: true });
    } catch (err) {
      setBusy(false);
      if (err.status === 404) setError("Mock checkout is turned off on this server. Go back and pay with Stripe instead.");
      else setError(err.status ? err.message : "Could not reach the server. Check your connection and try again.");
    } finally {
      inFlight.current = false;
    }
  }

  const heading = <BusinessHeading name={invoice?.business_name} fallback="Test payment" subtitle="Test payment (mock mode)" />;

  if (loadError) {
    return (
      <PublicShell title={heading} footer={FOOTER}>
        <StatusCard icon={AlertIcon} tone="warning" title="This invoice is not available">
          {loadError.message}
        </StatusCard>
      </PublicShell>
    );
  }
  if (!invoice) {
    return (
      <PublicShell footer={FOOTER}>
        <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-muted">
          <Spinner />
          Loading…
        </div>
      </PublicShell>
    );
  }

  const open = invoice.status === "sent";
  return (
    <PublicShell title={heading} footer={FOOTER}>
      <section className="rounded-2xl border-2 border-dashed border-warning/60 bg-surface p-5 shadow-card sm:p-6">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-warning-soft-fg">
          <AlertIcon className="h-3.5 w-3.5" />
          Test payment (mock mode)
        </p>
        <h2 className="mt-3 text-lg font-semibold text-fg">
          Invoice <span className="tabular-nums">{invoice.number}</span>: {invoice.title}
        </h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-fg">{formatMoney(invoice.total_cents)}</p>
        <p className="mt-3 text-sm text-muted">
          This server runs with <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">STRIPE_MOCK=1</code>, so this
          page stands in for Stripe Checkout. No card is asked for and no money moves. Pay marks the invoice paid exactly
          as a real payment would.
        </p>
        {!open && (
          <Alert tone="info" className="mt-4">
            {invoice.status === "paid" ? "This invoice is already paid." : "This invoice can no longer be paid."}{" "}
            <Link to={payPage} className="font-medium underline">Back to the invoice</Link>
          </Alert>
        )}
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        {open && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button size="lg" block className="sm:order-2" onClick={pay} disabled={busy || !sessionId}>
              {busy ? <Spinner className="h-5 w-5 text-current" /> : <CheckIcon className="h-5 w-5" />}
              {busy ? "Paying…" : `Pay ${formatMoney(invoice.total_cents)} (test)`}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              block
              className="sm:order-1"
              onClick={() => navigate(`${payPage}?checkout=cancelled`, { replace: true })}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
