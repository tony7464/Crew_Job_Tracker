import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { formatPercent } from "../../utils/quotes";
import { rateForInput, sameRate, typedRate, zipFromAddress, zipLabel } from "../../utils/tax";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Feedback";
import TaxSuggestion from "./TaxSuggestion";

function messageOf(error) {
  return error.data?.errors?.ai?.[0] || error.data?.errors?.address?.[0] || error.message;
}

// Under the Tax rate box on a quote or invoice (owner only). It reads the ZIP code out of
// the customer's address and offers the rate the business keeps for it, a lookup when
// there is none, and saving what the owner typed.
// value: what is in the tax rate box. onUse(rate): put this rate in the box.
// autoFill: on a new quote, fill an empty box with the saved rate without being asked.
export default function TaxRateHelper({ address, value, onUse, disabled, autoFill = false }) {
  const zip = zipFromAddress(address);
  // What is known for the ZIP code: { place, saved, ai_configured }, kept with its ZIP code.
  const [known, setKnown] = useState(null);
  const [busy, setBusy] = useState(null);
  // What went wrong, kept with its ZIP code so it goes away when the address changes.
  const [problem, setProblem] = useState(null);
  const filled = useRef(null);

  useEffect(() => {
    if (!zip) return undefined;
    let cancelled = false;
    // The address is being typed: wait for it to settle.
    const timer = setTimeout(() => {
      api(`/api/tax/rate?postal_code=${zip}`)
        .then((data) => !cancelled && setKnown({ ...data, zip }))
        .catch(() => !cancelled && setKnown(null));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [zip]);

  const info = known?.zip === zip ? known : null;
  const saved = info?.saved || null;

  // A new quote starts with the saved rate, once per ZIP code, and only into an empty box.
  useEffect(() => {
    if (!autoFill || !saved?.rate || filled.current === zip) return;
    filled.current = zip;
    if (String(value).trim() === "") onUse(rateForInput(saved.rate));
  }, [autoFill, saved, zip, value, onUse]);

  if (!zip) {
    return String(address || "").trim() ? (
      <p className="mb-3 text-xs text-muted">Add a ZIP code to the address to use or look up its sales tax rate.</p>
    ) : null;
  }
  if (!info) return null;

  async function run(kind, action) {
    setBusy(kind);
    setProblem(null);
    try {
      const row = await action();
      setKnown((current) => (current?.zip === zip ? { ...current, saved: row } : current));
      return row;
    } catch (err) {
      setProblem({ zip, message: messageOf(err) });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const lookUp = (refresh) => run("lookup", () => api("/api/tax/lookup", { method: "POST", body: { address, ...(refresh ? { refresh: true } : {}) } }));
  const save = (rate) => run("save", () => api(`/api/tax/rates/${zip}`, { method: "PUT", body: { rate } }));

  async function accept() {
    const row = await save(saved.suggestion.rate);
    if (row) onUse(rateForInput(row.rate));
  }

  const where = zipLabel(zip, saved?.place || [info.place?.city, info.place?.state].filter(Boolean).join(", "));
  const typed = typedRate(value);
  const suggestion = saved?.suggestion || null;
  const off = disabled || Boolean(busy);
  // Offer the lookup's answer while the owner has no rate of their own, or the lookup found a different one.
  const showSuggestion = suggestion && (!saved.rate || (suggestion.found && suggestion.rate_bp !== saved.rate_bp));

  return (
    <div className="mb-4 space-y-2 text-xs text-muted">
      {saved?.rate ? (
        sameRate(value, saved.rate) ? (
          <p>Your rate for {where}.</p>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            <span>
              Your rate for {where} is {formatPercent(saved.rate)}.
            </span>
            <Button variant="secondary" size="sm" disabled={off} onClick={() => onUse(rateForInput(saved.rate))}>
              Use {formatPercent(saved.rate)}
            </Button>
          </p>
        )
      ) : (
        !suggestion && <p>No sales tax rate saved for {where}.</p>
      )}

      {showSuggestion && (
        <TaxSuggestion suggestion={suggestion} place={saved.place}>
          {suggestion.found && (
            <Button size="sm" disabled={off} onClick={accept}>
              {busy === "save" ? "Saving…" : `Use ${formatPercent(suggestion.rate)} and save it for ${zip}`}
            </Button>
          )}
          {info.ai_configured && (
            <Button variant="secondary" size="sm" disabled={off} onClick={() => lookUp(true)}>
              Look up again
            </Button>
          )}
        </TaxSuggestion>
      )}

      {!suggestion && info.ai_configured && !saved?.rate && (
        <div>
          <Button variant="secondary" size="sm" disabled={off} onClick={() => lookUp(false)}>
            Look up sales tax for {zip}
          </Button>
          <p className="mt-1">AI searches official tax sites for the rate. It can take up to a minute, and you check the answer before using it.</p>
        </div>
      )}

      {busy === "lookup" && (
        <p className="flex items-center gap-2" role="status">
          <Spinner className="h-4 w-4" /> Looking up the rate for {zip}…
        </p>
      )}

      {typed !== null && !sameRate(typed, saved?.rate) && (
        <button type="button" className="link text-xs" disabled={off} onClick={() => save(typed)}>
          {saved?.rate ? `Change your rate for ${zip} to ${formatPercent(typed)}` : `Save ${formatPercent(typed)} as your rate for ${zip}`}
        </button>
      )}
      {problem?.zip === zip && <p className="font-medium text-danger">{problem.message}</p>}
    </div>
  );
}
