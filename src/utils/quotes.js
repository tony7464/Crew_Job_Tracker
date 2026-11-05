// Quote helpers. The totals use the same integer math as server/quote_math.py, so
// the live totals in the editor always match what the server saves:
// - line total = quantity (hundredths) x unit price (cents) / 100, rounded half up
// - subtotal = sum of line totals
// - tax = subtotal x rate (basis points) / 10000, rounded half up, once
// - total = subtotal + tax
// BigInt keeps the products exact even near the limits.

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined"];

// Same limits as the server.
export const MAX_ITEMS = 50;
export const MAX_TITLE = 120;
export const MAX_DESCRIPTION = 200;
export const MAX_NOTES = 2000;
export const MAX_DECLINE_REASON = 500;
const MAX_QUANTITY = 999_999; // 9,999.99 in hundredths
const MAX_PRICE_CENTS = 99_999_999; // $999,999.99
const MAX_TAX_BP = 10_000; // 100%

// A new empty line for the item editor. key is only for React.
let nextKey = 0;
export function blankItem() {
  nextKey += 1;
  return { key: `new-${nextKey}`, description: "", quantity: "1", unit_price: "" };
}

// Saved items as editor lines, or one blank line when there are none.
export function editorItems(items) {
  return items?.length
    ? items.map((item) => ({
        key: `item-${item.id}`,
        description: item.description,
        quantity: formatQuantity(item.quantity),
        unit_price: item.unit_price,
      }))
    : [blankItem()];
}

// Rows left completely empty are dropped before saving.
export function filledItems(items) {
  return items.filter((item) => item.description.trim() || item.unit_price.trim());
}

// The items JSON for POST or PATCH.
export function itemsBody(items) {
  return filledItems(items).map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity.trim(),
    unit_price: item.unit_price.trim(),
  }));
}

// { index: { field: message } } for the lines that do not pass validateItem. Blank lines are skipped.
export function validateItems(items) {
  const itemErrors = {};
  items.forEach((item, index) => {
    if (!item.description.trim() && !item.unit_price.trim()) return;
    const found = validateItem(item);
    if (Object.keys(found).length) itemErrors[index] = found;
  });
  return itemErrors;
}

// "12", "1.5", "0.25", ".5" -> whole hundredths; null if it is not a number with at most 2 decimals.
export function parseHundredths(value) {
  const text = String(value ?? "").trim().replace(/,/g, "");
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(text);
  if (!match || (!match[1] && !match[2])) return null;
  const whole = Number(match[1] || "0");
  const fraction = Number((match[2] || "").padEnd(2, "0"));
  const result = whole * 100 + fraction;
  return Number.isSafeInteger(result) ? result : null;
}

function divideHalfUp(numerator, denominator) {
  return (2n * numerator + denominator) / (2n * denominator);
}

export function lineTotalCents(quantityHundredths, unitPriceCents) {
  return Number(divideHalfUp(BigInt(quantityHundredths) * BigInt(unitPriceCents), 100n));
}

export function taxCents(subtotalCents, taxRateBp) {
  return Number(divideHalfUp(BigInt(subtotalCents) * BigInt(taxRateBp), 10_000n));
}

// lines: [{ quantity, unit_price }] as typed. Lines that do not parse count as 0
// and are reported in invalid, so the totals never show a made-up number.
export function computeTotals(lines, taxRate) {
  let subtotal = 0;
  const lineTotals = lines.map((line) => {
    const quantity = parseHundredths(line.quantity);
    const unit = parseHundredths(line.unit_price);
    if (quantity === null || unit === null) return null;
    const total = lineTotalCents(quantity, unit);
    subtotal += total;
    return total;
  });
  const bp = parseHundredths(taxRate === "" ? "0" : taxRate);
  const tax = bp === null ? 0 : taxCents(subtotal, bp);
  return { lineTotals, subtotal, tax, total: subtotal + tax };
}

// Checks done in the browser before saving. The server repeats every one.
export function validateItem(line) {
  const errors = {};
  if (!line.description.trim()) errors.description = "Describe the work.";
  else if (line.description.trim().length > MAX_DESCRIPTION) errors.description = `At most ${MAX_DESCRIPTION} characters.`;
  const quantity = parseHundredths(line.quantity);
  if (quantity === null) errors.quantity = "A number, up to 2 decimals.";
  else if (quantity < 1 || quantity > MAX_QUANTITY) errors.quantity = "0.01 to 9,999.99.";
  const unit = parseHundredths(line.unit_price);
  if (unit === null) errors.unit_price = "An amount like 25.00.";
  else if (unit > MAX_PRICE_CENTS) errors.unit_price = "At most 999,999.99.";
  return errors;
}

export function validateTaxRate(value) {
  if (String(value).trim() === "") return null;
  const bp = parseHundredths(value);
  if (bp === null) return "A percent like 8.25.";
  if (bp > MAX_TAX_BP) return "0 to 100.";
  return null;
}

export function totalTooLarge(total) {
  return total > MAX_PRICE_CENTS;
}

// "1.50" -> "1.5", "2.00" -> "2", for "1.5 × Gutter cleaning".
export function formatQuantity(value) {
  const text = String(value);
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

// "8.25" -> "8.25%", "0.00" -> "0%".
export function formatPercent(value) {
  return `${formatQuantity(value)}%`;
}

// "Nov 22, 2026" from "YYYY-MM-DD", read as a calendar day (no time zone shift).
export function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// "Nov 2, 2026" from an ISO timestamp, in this device's time zone.
export function formatMoment(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Server errors for items: { items: { "0": { quantity: [...] } } } or { items: ["At most 50 items."] }.
export function itemErrorsFrom(error) {
  const items = error?.data?.errors?.items;
  if (!items || Array.isArray(items) || typeof items !== "object") return {};
  const first = (value) => (Array.isArray(value) ? value[0] : typeof value === "string" ? value : "");
  return Object.fromEntries(
    Object.entries(items).map(([index, fields]) => [
      index,
      Object.fromEntries(
        Object.entries(fields || {}).map(([field, messages]) => [field === "unit_price_cents" ? "unit_price" : field, first(messages)]),
      ),
    ]),
  );
}
