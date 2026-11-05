import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { CheckIcon, XIcon } from "../components/ui/Icons";
import { useAsync } from "../hooks";

const PATH = "/api/business/stripe";

const STATUS = {
  not_connected: { tone: "neutral", label: "Not connected" },
  onboarding_incomplete: { tone: "warning", label: "Onboarding incomplete" },
  charges_enabled: { tone: "primary", label: "Charges enabled" },
  payouts_enabled: { tone: "success", label: "Payouts enabled" },
};

// Where Stripe's return and refresh links send the owner back to, as ?stripe=…
const RETURN_MESSAGES = {
  returned: ["info", "Back from Stripe. The status below is what Stripe reports now."],
  error: ["danger", "Stripe could not be reached. Try again in a minute."],
  not_connected: ["warning", "Stripe is not connected. Connect it below."],
};

function formatChecked(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Check({ done, children }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckIcon className="h-4 w-4 shrink-0 text-success" />
      ) : (
        <XIcon className="h-4 w-4 shrink-0 text-muted" />
      )}
      <span className={done ? "text-fg" : "text-muted"}>{children}</span>
      <span className="sr-only">{done ? "(done)" : "(not yet)"}</span>
    </li>
  );
}

// A failed Stripe call: the server's message, and Stripe's own reason when it gave one
// (stripe_detail, with anything that looks like a key already removed by the server).
function StripeError({ error }) {
  if (!error) return null;
  const messages = error.data?.errors?.stripe;
  if (!messages) return <ErrorMessage error={error} />;
  const detail = error.data?.stripe_detail;
  return (
    <Alert tone="danger" title={[].concat(messages).join(" ")}>
      {detail ? <span className="break-words">Stripe said: {detail}</span> : null}
    </Alert>
  );
}

function hint(stripe) {
  if (stripe.status === "onboarding_incomplete") {
    return stripe.details_submitted
      ? "Your details are in. Stripe is reviewing them, or needs a little more. Continue onboarding to check."
      : "Finish Stripe's form to turn on payments.";
  }
  if (stripe.status === "charges_enabled") return "You can take payments. Stripe has not turned on payouts yet.";
  if (stripe.status === "payouts_enabled") return "You can take payments, and Stripe pays out to your bank.";
  return null;
}

export default function SettingsPaymentsCard() {
  const { data: stripe, setData, error: loadError } = useAsync(api, PATH);
  const [searchParams, setSearchParams] = useSearchParams();
  const [returned] = useState(() => searchParams.get("stripe"));
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const refreshedOnLoad = useRef(false);

  // Drop ?stripe=… from the address so a reload does not show the message again.
  useEffect(() => {
    if (!searchParams.has("stripe")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("stripe");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setData(await api(`${PATH}/refresh`, { method: "POST" }));
    } catch (err) {
      // 502: Stripe failed. The body still has the last known status.
      if (err.data?.stripe) setData(err.data.stripe);
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }

  // The page shows the saved status right away, then asks Stripe for the latest
  // once. Coming back from Stripe already refreshed on the server.
  const autoRefresh = Boolean(stripe?.configured && stripe?.connected && returned !== "returned");
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (!autoRefresh || refreshedOnLoad.current) return;
    refreshedOnLoad.current = true;
    api(`${PATH}/refresh`, { method: "POST" })
      .then(setData)
      .catch((err) => {
        if (err.data?.stripe) setData(err.data.stripe);
        setError(err);
      })
      .finally(() => setAutoDone(true));
  }, [autoRefresh, setData]);
  const checking = refreshing || (autoRefresh && !autoDone);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const result = await api(`${PATH}/connect`, { method: "POST" });
      setData(result.stripe);
      window.location.assign(result.url);
    } catch (err) {
      setError(err);
      setConnecting(false);
    }
  }

  async function disconnect() {
    await api(PATH, { method: "DELETE" });
    setError(null);
    setData(await api(PATH));
  }

  if (loadError) return <ErrorMessage error={loadError} />;
  if (!stripe) return <Loading variant="list" label="Loading payments…" />;

  const status = STATUS[stripe.status] || STATUS.not_connected;
  const checked = formatChecked(stripe.checked_at);
  const returnMessage = RETURN_MESSAGES[returned];
  const modeBadge = stripe.configured && (
    <Badge tone="warning" title="No real money moves">
      {stripe.mode === "mock" ? "Mock mode" : "Test mode"}
    </Badge>
  );

  return (
    <Card
      title="Payments"
      description="Connect a Stripe account so your business can be paid. Stripe runs the sign-up form and holds your bank details."
      actions={modeBadge}
    >
      <div className="space-y-5">
        {returnMessage && <Alert tone={returnMessage[0]}>{returnMessage[1]}</Alert>}

        {!stripe.configured && (
          <Alert tone={stripe.message?.startsWith("Live") ? "danger" : "info"} title="Stripe not configured">
            {stripe.message}
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {stripe.account_id && (
            <span className="min-w-0 break-all font-mono text-xs text-muted">{stripe.account_id}</span>
          )}
        </div>

        {stripe.connected && (
          <>
            <ul className="space-y-1.5" aria-label="Stripe account status">
              <Check done={stripe.details_submitted}>Details submitted</Check>
              <Check done={stripe.charges_enabled}>Charges enabled</Check>
              <Check done={stripe.payouts_enabled}>Payouts enabled</Check>
            </ul>
            {hint(stripe) && <p className="text-sm text-muted">{hint(stripe)}</p>}
            <p className="text-xs text-muted">
              {checking
                ? "Checking with Stripe…"
                : checked
                  ? `Last checked ${checked}.`
                  : "Not checked with Stripe yet."}
            </p>
          </>
        )}

        <StripeError error={error} />

        {stripe.configured && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {stripe.status !== "payouts_enabled" && (
              <Button onClick={connect} disabled={connecting} className="w-full sm:w-auto">
                {connecting
                  ? "Opening Stripe…"
                  : stripe.connected
                    ? "Continue onboarding"
                    : "Connect Stripe"}
              </Button>
            )}
            {stripe.connected && (
              <Button variant="secondary" onClick={refresh} disabled={checking} className="w-full sm:w-auto">
                {checking ? "Refreshing…" : "Refresh status"}
              </Button>
            )}
          </div>
        )}

        {stripe.connected && (
          <div className="border-t border-border pt-4">
            <ConfirmButton
              label="Disconnect Stripe"
              confirmLabel="Disconnect"
              busyLabel="Disconnecting…"
              warning="This app forgets the Stripe account. The account itself stays in Stripe, and connecting again makes a new one."
              onConfirm={disconnect}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
