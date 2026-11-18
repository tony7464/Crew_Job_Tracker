import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import TaxSuggestion from "../components/tax/TaxSuggestion";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAsync } from "../hooks";
import { formatWhen } from "../utils/admin";
import { formatPercent } from "../utils/quotes";
import { rateForInput, sameRate, typedRate } from "../utils/tax";

function messageOf(error) {
  const errors = error.data?.errors || {};
  return errors.ai?.[0] || errors.rate?.[0] || errors.postal_code?.[0] || error.message;
}

// One ZIP code: its rate (editable), what the last lookup found, and removing it.
function ZipRow({ row, aiConfigured, onChanged, onRemoved }) {
  const [rate, setRate] = useState(rateForInput(row.rate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const typed = typedRate(rate);
  const suggestion = row.suggestion;
  const differs = suggestion?.found && suggestion.rate_bp !== row.rate_bp;

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const save = (value) =>
    run(async () => {
      const next = await api(`/api/tax/rates/${row.postal_code}`, { method: "PUT", body: { rate: value } });
      setRate(rateForInput(next.rate));
      onChanged(next);
    });
  const lookUp = () =>
    run(async () => onChanged(await api("/api/tax/lookup", { method: "POST", body: { postal_code: row.postal_code, refresh: true } })));
  const remove = () =>
    run(async () => {
      await api(`/api/tax/rates/${row.postal_code}`, { method: "DELETE" });
      onRemoved(row.postal_code);
    });

  return (
    <li className="space-y-2 py-3">
      {/* On phones the rate and its buttons sit under the ZIP code; from sm up, beside it. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
            <span className="tabular-nums">{row.postal_code}</span>
            {row.rate === null ? (
              <Badge tone="warning">No rate chosen</Badge>
            ) : (
              <Badge>{row.source === "ai" ? "From a lookup" : "Typed by you"}</Badge>
            )}
          </p>
          <p className="text-sm text-muted [overflow-wrap:anywhere]">
            {[row.place, row.confirmed_at && `set ${formatWhen(row.confirmed_at)}`].filter(Boolean).join(" · ") || "No place name"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="relative block w-24">
            <span className="sr-only">Rate for {row.postal_code}</span>
            <input
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              inputMode="decimal"
              placeholder="0"
              disabled={busy}
              className="field pr-7 text-right tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">%</span>
          </label>
          <Button variant="secondary" size="sm" disabled={busy || typed === null || sameRate(typed, row.rate)} onClick={() => save(typed)}>
            Save
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={remove} aria-label={`Remove ${row.postal_code}`}>
            Remove
          </Button>
        </div>
      </div>
      {suggestion && (differs || row.rate === null) && (
        <TaxSuggestion suggestion={suggestion} place={row.place}>
          {suggestion.found && (
            <Button size="sm" disabled={busy} onClick={() => save(suggestion.rate)}>
              Use {formatPercent(suggestion.rate)}
            </Button>
          )}
        </TaxSuggestion>
      )}
      {aiConfigured && (
        <button type="button" className="link text-xs" disabled={busy} onClick={lookUp}>
          {busy ? "Working…" : suggestion ? `Look up ${row.postal_code} again` : `Look up ${row.postal_code}`}
        </button>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </li>
  );
}

// Settings: the sales tax rate the business uses in each ZIP code.
export default function SettingsTaxCard() {
  const { data, setData, error: loadError } = useAsync(api, "/api/tax/rates");
  const [zip, setZip] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const zipOk = /^\d{5}$/.test(zip.trim());
  const typed = typedRate(rate);

  function put(row) {
    setData((current) => {
      const others = current.items.filter((item) => item.postal_code !== row.postal_code);
      return { ...current, items: [...others, row].sort((a, b) => a.postal_code.localeCompare(b.postal_code)) };
    });
  }

  async function add(kind) {
    setBusy(kind);
    setError(null);
    try {
      const code = zip.trim();
      const row =
        kind === "lookup"
          ? await api("/api/tax/lookup", { method: "POST", body: { postal_code: code } })
          : await api(`/api/tax/rates/${code}`, { method: "PUT", body: { rate: typed } });
      put(row);
      setZip("");
      setRate("");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title="Sales tax by ZIP code"
      description="The rate new quotes and invoices start with for a customer in each ZIP code. You can still change the rate on any quote or invoice. One rate applies to the whole quote or invoice."
    >
      {loadError && <ErrorMessage error={loadError} />}
      {data && (
        <div className="space-y-4">
          {data.items.length === 0 ? (
            <p className="text-sm text-muted">
              No ZIP codes yet. Add one here, or save a rate from the Tax rate line on a quote or invoice.
            </p>
          ) : (
            <ul className="-my-3 divide-y divide-border">
              {data.items.map((row) => (
                <ZipRow
                  key={row.postal_code}
                  row={row}
                  aiConfigured={data.ai_configured}
                  onChanged={put}
                  onRemoved={(code) => setData((current) => ({ ...current, items: current.items.filter((item) => item.postal_code !== code) }))}
                />
              ))}
            </ul>
          )}
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-fg">Add a ZIP code</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block w-28">
                <span className="mb-1 block text-xs font-medium text-muted">ZIP code</span>
                <input value={zip} onChange={(event) => setZip(event.target.value)} inputMode="numeric" maxLength={5} placeholder="68107" disabled={Boolean(busy)} className="field tabular-nums" />
              </label>
              <label className="relative block w-24">
                <span className="mb-1 block text-xs font-medium text-muted">Rate</span>
                <input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" placeholder="0" disabled={Boolean(busy)} className="field pr-7 text-right tabular-nums" />
                <span className="pointer-events-none absolute bottom-2.5 right-3 text-sm text-subtle">%</span>
              </label>
              <Button variant="secondary" disabled={Boolean(busy) || !zipOk || typed === null} onClick={() => add("save")}>
                {busy === "save" ? "Saving…" : "Save rate"}
              </Button>
              {data.ai_configured && (
                <Button variant="secondary" disabled={Boolean(busy) || !zipOk} onClick={() => add("lookup")}>
                  {busy === "lookup" ? "Looking up…" : "Look it up"}
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {data.ai_configured
                ? "Look it up has AI search official tax sites for the rate. It can take up to a minute, and nothing is used until you accept it."
                : "Type the rate from your state's tax site. Automatic lookup is not set up on this server."}
            </p>
            {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
          </div>
        </div>
      )}
    </Card>
  );
}
