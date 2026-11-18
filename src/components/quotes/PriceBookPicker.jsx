import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../context/useAuth";
import { formatMoney } from "../../utils/format";
import { PRICE_BOOK_KINDS, filterPriceBook, kindLabel, kindsIn } from "../../utils/priceBook";
import { priceBookLine } from "../../utils/quotes";
import { isOwner } from "../../utils/roles";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Feedback";
import { PlusIcon, SearchIcon } from "../ui/Icons";
import { cx } from "../ui/styles";

// "From price book" beside Add item: search saved services, materials, and hourly rates,
// and add each as a line.
export default function PriceBookPicker({ onPick, disabled }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
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

  const shown = useMemo(() => filterPriceBook(items, { query, kind }), [items, query, kind]);
  // The type buttons only show when the price book mixes types.
  const kinds = useMemo(() => kindsIn(items), [items]);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)} disabled={disabled}>
        From price book
      </Button>
    );
  }

  return (
    // w-full min-w-0: in the wrapping row of buttons this takes the whole row and no more,
    // however long an item's description is.
    <div className="mt-3 w-full min-w-0 rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Search the price book</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the price book"
            className="field pl-9"
          />
        </label>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
      {kinds.length > 1 && (
        <div role="group" aria-label="Show" className="mt-2 flex flex-wrap gap-1.5">
          {[["all", "All", "All"], ...PRICE_BOOK_KINDS.filter(([value]) => kinds.includes(value))].map(([value, , label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                kind === value ? "border-primary bg-primary text-primary-fg" : "border-border text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
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
                Add what you charge for
              </Link>
            ) : (
              "Ask the owner to add items."
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
                  {(kinds.length > 1 || item.category || item.description) && (
                    <span className="block truncate text-xs text-muted">
                      {[kinds.length > 1 && kindLabel(item.kind), item.category, item.description].filter(Boolean).join(" · ")}
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
