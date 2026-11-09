import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { RefreshIcon } from "../components/ui/Icons";
import { useAsync } from "../hooks";

const PATH = "/api/business/quickbooks";

// Where Intuit sends the owner back to, as ?quickbooks=…
const RETURN_MESSAGES = {
  connected: ["success", "QuickBooks is connected. Sent invoices and their payments are copied every hour, or tap Sync now."],
  cancelled: ["info", "Connecting was cancelled. Nothing changed."],
  error: ["danger", "QuickBooks could not be connected. Start again from this page."],
  already_connected: ["info", "QuickBooks was already connected."],
};

function when(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function syncSummary(result) {
  if (!result) return null;
  if (result.error) return ["danger", result.error];
  const parts = [];
  if (result.invoices) parts.push(`${plural(result.invoices, "invoice")} copied`);
  if (result.payments) parts.push(`${plural(result.payments, "payment")} copied`);
  if (result.voided) parts.push(`${plural(result.voided, "invoice")} voided`);
  if (result.failed) return ["warning", `${parts.length ? `${parts.join(", ")}. ` : ""}${plural(result.failed, "item")} could not be copied; see below.`];
  return ["success", parts.length ? `${parts.join(", ")}.` : "Everything was already up to date."];
}

export default function SettingsQuickBooksCard() {
  const { data: books, setData, error: loadError } = useAsync(api, PATH);
  const [searchParams, setSearchParams] = useSearchParams();
  const [returned] = useState(() => searchParams.get("quickbooks"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!searchParams.has("quickbooks")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("quickbooks");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api(`${PATH}/connect`, { method: "POST" });
      window.location.assign(url);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = await api(`${PATH}/sync`, { method: "POST" });
      setResult(body.result);
      setData(body);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await api(PATH, { method: "DELETE" });
    setResult(null);
    setData(await api(PATH));
  }

  if (loadError) return <ErrorMessage error={loadError} />;
  if (!books) return <Loading variant="list" label="Loading QuickBooks…" />;

  const returnMessage = RETURN_MESSAGES[returned];
  const summary = syncSummary(result);
  const badge = books.connected ? (
    books.needs_reconnect ? <Badge tone="warning">Needs reconnecting</Badge> : <Badge tone="success">Connected</Badge>
  ) : books.configured && books.environment !== "production" ? (
    <Badge tone="warning">{books.environment === "mock" ? "Mock mode" : "Sandbox"}</Badge>
  ) : null;

  return (
    <div id="quickbooks" className="scroll-mt-20">
      <Card
        title="QuickBooks"
        description="Copy your sent invoices, customers, and payments to QuickBooks Online, so your books match without typing anything twice."
        actions={badge}
      >
        <div className="space-y-4">
          {returnMessage && <Alert tone={returnMessage[0]}>{returnMessage[1]}</Alert>}
          {!books.configured && <Alert tone="info" title="QuickBooks isn't set up yet">{books.message}</Alert>}

          {books.connected ? (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Company</dt>
                  <dd className="font-medium">{books.company_name || "QuickBooks company"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Invoices copied</dt>
                  <dd className="font-medium">
                    {books.invoices_synced}
                    {books.invoices_waiting > 0 && <span className="text-muted"> · {books.invoices_waiting} waiting</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Last sync</dt>
                  <dd className="font-medium">{when(books.last_sync_at) || "Not yet"}</dd>
                </div>
              </dl>
              {books.needs_reconnect && (
                <Alert tone="warning" title="Connect QuickBooks again">
                  QuickBooks stopped accepting this connection (it expires after 100 days without use, or was
                  disconnected in QuickBooks). Disconnect, then connect again. Nothing already copied is doubled.
                </Alert>
              )}
              {summary && <Alert tone={summary[0]}>{summary[1]}</Alert>}
              {!summary && books.last_error && !books.needs_reconnect && <Alert tone="warning">{books.last_error}</Alert>}
              {books.problems?.length > 0 && (
                <details className="rounded-lg border border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">What could not be copied</summary>
                  <ul className="mt-2 space-y-1 text-muted">
                    {books.problems.map((problem) => (
                      <li key={`${problem.kind}-${problem.id}`}>
                        {problem.kind === "invoice" ? "Invoice" : problem.kind === "payment" ? "Payment" : "Customer"}{" "}
                        #{problem.id}: {problem.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <ErrorMessage error={error} />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={sync} disabled={busy || books.needs_reconnect}>
                  <RefreshIcon className="h-4 w-4" />
                  {busy ? "Syncing…" : "Sync now"}
                </Button>
                <ConfirmButton
                  label="Disconnect"
                  confirmLabel="Yes, disconnect"
                  busyLabel="Disconnecting…"
                  warning="Copying stops. Nothing is deleted in QuickBooks."
                  onConfirm={disconnect}
                />
              </div>
              <p className="text-xs text-muted">
                Copied: invoices once sent (drafts stay here), changes when you send them again, voids, and payments
                (card, cash, or check). Sales tax goes on its own line. Nothing in QuickBooks is changed or deleted
                otherwise.
              </p>
            </>
          ) : (
            <>
              <ErrorMessage error={error} />
              <Button onClick={connect} disabled={busy || !books.configured}>
                {busy ? "Opening QuickBooks…" : "Connect QuickBooks"}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
