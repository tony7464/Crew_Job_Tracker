import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../context/useAuth";
import { formatMoney } from "../../utils/format";
import { priceBookLine } from "../../utils/quotes";
import { isOwner } from "../../utils/roles";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Feedback";
import { PlusIcon, SearchIcon } from "../ui/Icons";

// "From price book" beside Add item: search saved services and add each as a line.
export default function PriceBookPicker({ onPick, disabled }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (!open || items) return undefined;
    let cancelled = false;
    api("/api/price_book")
      .then((data) => !cancelled && setItems(data))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (items || []).filter((item) => {
      const text = [item.name, item.description, item.category].filter(Boolean).join(" ").toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [items, query]);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)} disabled={disabled}>
        From price book
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Search the price book</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services"
            className="field pl-9"
          />
        </label>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
      {added > 0 && (
        <p className="mt-2 text-xs text-muted" role="status">
          Added {added} {added === 1 ? "line" : "lines"}. Change the quantity in the list above.
        </p>
      )}
      <div className="mt-2 max-h-72 overflow-y-auto">
        {error && <p className="py-3 text-sm text-danger">{error.message}</p>}
        {!items && !error && (
          <p className="flex items-center gap-2 py-3 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Loading…
          </p>
        )}
        {items && items.length === 0 && (
          <p className="py-3 text-sm text-muted">
            Your price book is empty.{" "}
            {isOwner(user) ? (
              <Link to="/price-book" className="link">
                Add your services
              </Link>
            ) : (
              "Ask the owner to add services."
            )}
          </p>
        )}
        {items && items.length > 0 && shown.length === 0 && <p className="py-3 text-sm text-muted">Nothing matches.</p>}
        <ul className="divide-y divide-border">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(priceBookLine(item));
                  setAdded((count) => count + 1);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{item.name}</span>
                  {(item.category || item.description) && (
                    <span className="block truncate text-xs text-muted">
                      {[item.category, item.description].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-fg">
                  {formatMoney(item.unit_price_cents)}
                  {item.unit && <span className="text-muted"> / {item.unit}</span>}
                </span>
                <PlusIcon className="h-4 w-4 shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
