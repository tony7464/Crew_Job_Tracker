import { formatMoney } from "../utils/format";
import { MAX_DESCRIPTION, MAX_ITEMS, blankItem, formatPercent, formatQuantity } from "../utils/quotes";
import { Button } from "./ui/Button";
import { PlusIcon, XIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

// Line items (of a quote or an invoice), read-only. A table from sm up; stacked rows on phones.
export function QuoteItems({ items }) {
  if (!items.length) return <p className="text-sm text-muted">No items.</p>;
  return (
    <div>
      <table className="hidden w-full text-sm sm:table">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
            <th scope="col" className="pb-2 text-left">Item</th>
            <th scope="col" className="w-20 pb-2 text-right">Qty</th>
            <th scope="col" className="w-28 pb-2 text-right">Unit price</th>
            <th scope="col" className="w-28 pb-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, index) => (
            <tr key={item.id ?? index} className="align-top">
              <td className="py-2.5 pr-3 [overflow-wrap:anywhere]">{item.description}</td>
              <td className="py-2.5 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatMoney(item.unit_price_cents)}</td>
              <td className="py-2.5 text-right font-medium tabular-nums">{formatMoney(item.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border sm:hidden">
        {items.map((item, index) => (
          <li key={item.id ?? index} className="flex items-start justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="text-sm text-fg [overflow-wrap:anywhere]">{item.description}</p>
              <p className="mt-0.5 text-xs tabular-nums text-muted">
                {formatQuantity(item.quantity)} × {formatMoney(item.unit_price_cents)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium tabular-nums text-fg">{formatMoney(item.line_total_cents)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Subtotal, tax, and total. taxRate is the percent string ("8.25"); tax is hidden at 0%.
export function QuoteTotals({ subtotal, tax, taxRate, total, className }) {
  const showTax = Number(taxRate) > 0 || tax > 0;
  return (
    <dl className={cx("space-y-1.5 text-sm", className)}>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Subtotal</dt>
        <dd className="tabular-nums text-fg">{formatMoney(subtotal)}</dd>
      </div>
      {showTax && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Tax ({formatPercent(taxRate)})</dt>
          <dd className="tabular-nums text-fg">{formatMoney(tax)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2.5">
        <dt className="font-semibold text-fg">Total</dt>
        <dd className="text-xl font-semibold tabular-nums tracking-tight text-fg">{formatMoney(total)}</dd>
      </div>
    </dl>
  );
}

function ItemRow({ item, index, errors, lineTotal, onChange, onRemove, canRemove, disabled }) {
  const label = "mb-1 block text-xs font-medium text-muted sm:sr-only";
  const set = (field) => (event) => onChange({ ...item, [field]: event.target.value });
  return (
    <li className="rounded-lg border border-border p-3 sm:rounded-none sm:border-0 sm:p-0 sm:py-2">
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_6.5rem_2.25rem] sm:items-start">
        <label className="col-span-2 block sm:col-span-1">
          <span className={label}>Description {index + 1}</span>
          <input
            value={item.description}
            onChange={set("description")}
            placeholder="What you will do"
            maxLength={MAX_DESCRIPTION}
            disabled={disabled}
            aria-invalid={errors.description ? true : undefined}
            className={cx("field", errors.description && "border-danger")}
          />
          {errors.description && <span className="mt-1 block text-xs font-medium text-danger">{errors.description}</span>}
        </label>
        <label className="block">
          <span className={label}>Qty</span>
          <input
            value={item.quantity}
            onChange={set("quantity")}
            inputMode="decimal"
            disabled={disabled}
            aria-label={`Quantity ${index + 1}`}
            aria-invalid={errors.quantity ? true : undefined}
            className={cx("field text-right tabular-nums", errors.quantity && "border-danger")}
          />
          {errors.quantity && <span className="mt-1 block text-xs font-medium text-danger">{errors.quantity}</span>}
        </label>
        <label className="block">
          <span className={label}>Unit price</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
            <input
              value={item.unit_price}
              onChange={set("unit_price")}
              inputMode="decimal"
              placeholder="0.00"
              disabled={disabled}
              aria-label={`Unit price ${index + 1}`}
              aria-invalid={errors.unit_price ? true : undefined}
              className={cx("field pl-6 text-right tabular-nums", errors.unit_price && "border-danger")}
            />
          </span>
          {errors.unit_price && <span className="mt-1 block text-xs font-medium text-danger">{errors.unit_price}</span>}
        </label>
        {/* On phones, the amount and the remove button share a row; from sm up they are grid cells. */}
        <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
          <p className="text-sm sm:flex sm:h-10 sm:items-center sm:justify-end">
            <span className="text-muted sm:sr-only">Amount </span>
            <span className="font-medium tabular-nums text-fg">
              {lineTotal === null ? "—" : formatMoney(lineTotal)}
            </span>
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={disabled || !canRemove}
            aria-label={`Remove item ${index + 1}`}
            title="Remove item"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

// The line item editor for quotes and invoices: a grid from sm up, stacked cards on phones.
export function ItemsEditor({ items, setItems, itemErrors, lineTotals, listError, disabled }) {
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_6.5rem_2.25rem] gap-x-2 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ul className="space-y-2.5 sm:space-y-0 sm:divide-y sm:divide-border">
        {items.map((item, index) => (
          <ItemRow
            key={item.key}
            item={item}
            index={index}
            errors={itemErrors[index] || {}}
            lineTotal={lineTotals[index]}
            disabled={disabled}
            canRemove={items.length > 1}
            onChange={(next) => setItems(items.map((row, i) => (i === index ? next : row)))}
            onRemove={() => setItems(items.filter((_, i) => i !== index))}
          />
        ))}
      </ul>
      {listError && <p className="mt-2 text-xs font-medium text-danger">{listError}</p>}
      {items.length < MAX_ITEMS && (
        <Button variant="soft" size="sm" className="mt-3" onClick={() => setItems([...items, blankItem()])} disabled={disabled}>
          <PlusIcon />
          Add item
        </Button>
      )}
    </div>
  );
}
