import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDuration, formatMoney } from "../../utils/format";
import { laborLine, materialLines } from "../../utils/priceBook";
import { Button } from "../ui/Button";

// For an invoice made from a job (owner only): add what the job used as lines.
// - Add job materials: the materials on the job's list. Price book ones bring their price;
//   typed ones come in without a price to fill in. Tools are left out.
// - Add clocked hours: the time clocked on the job, at an hourly rate from the price book.
// onAdd(lines) adds them and returns how many fitted.
export default function JobLinesPicker({ jobId, onAdd, disabled }) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  // { minutes, rates } while the owner picks which hourly rate to use.
  const [choosing, setChoosing] = useState(null);

  async function run(kind, action) {
    setBusy(kind);
    setError(null);
    setNote(null);
    setChoosing(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  function addMaterials() {
    return run("materials", async () => {
      const lines = materialLines((await api(`/api/jobs/${jobId}/materials`)).items);
      if (!lines.length) {
        setNote("This job has no materials on its list.");
        return;
      }
      const added = onAdd(lines);
      const unpriced = lines.slice(0, added).filter((line) => !line.unit_price).length;
      setNote(
        added === 0
          ? "The invoice is full, so nothing was added."
          : `Added ${added} ${added === 1 ? "line" : "lines"}.` +
              (unpriced ? ` ${unpriced} ${unpriced === 1 ? "has" : "have"} no price yet: type one, or remove the line.` : "") +
              (added < lines.length ? " The rest did not fit." : ""),
      );
    });
  }

  function addHours(rate, minutes) {
    const added = onAdd([laborLine(rate, minutes)]);
    setChoosing(null);
    setNote(added ? `Added ${formatDuration(minutes)} of ${rate.name}.` : "The invoice is full, so nothing was added.");
  }

  function startHours() {
    return run("hours", async () => {
      const [time, rates] = await Promise.all([api(`/api/jobs/${jobId}/time`), api("/api/price_book?kind=labor")]);
      if (!time.total_minutes) {
        setNote("Nobody has clocked time on this job.");
      } else if (!rates.length) {
        setNote("no-rates");
      } else if (rates.length === 1) {
        addHours(rates[0], time.total_minutes);
      } else {
        setChoosing({ minutes: time.total_minutes, rates });
      }
    });
  }

  return (
    <div className="mt-3 w-full min-w-0">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={addMaterials} disabled={disabled || Boolean(busy)}>
          {busy === "materials" ? "Adding…" : "Add job materials"}
        </Button>
        <Button variant="secondary" size="sm" onClick={startHours} disabled={disabled || Boolean(busy)}>
          {busy === "hours" ? "Adding…" : "Add clocked hours"}
        </Button>
      </div>
      {choosing && (
        <div className="mt-2 rounded-xl border border-border bg-surface-2/40 p-3">
          <p className="text-sm text-muted">{formatDuration(choosing.minutes)} clocked on this job. Which rate?</p>
          <ul className="mt-1 divide-y divide-border">
            {choosing.rates.map((rate) => (
              <li key={rate.id}>
                <button
                  type="button"
                  onClick={() => addHours(rate, choosing.minutes)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-fg">{rate.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-fg">
                    {formatMoney(rate.unit_price_cents)}
                    <span className="text-muted"> / {rate.unit || "hour"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note === "no-rates" ? (
        <p className="mt-2 text-xs text-muted" role="status">
          Your price book has no hourly rate yet.{" "}
          <Link to="/price-book" className="link">
            Add a Labor item
          </Link>
          , then try again.
        </p>
      ) : (
        note && (
          <p className="mt-2 text-xs text-muted" role="status">
            {note}
          </p>
        )
      )}
      {error && <p className="mt-2 text-xs font-medium text-danger">{error.message}</p>}
    </div>
  );
}
