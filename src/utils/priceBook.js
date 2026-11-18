// Price book helpers: the kinds of item, filtering, and turning a job's materials and
// clocked time into invoice lines.
import { MAX_DESCRIPTION, MAX_ITEMS, blankItem, formatQuantity, isBlankLine, lineDescription } from "./quotes.js";

// [kind, one, many]. The order the kinds are shown in.
export const PRICE_BOOK_KINDS = [
  ["service", "Service", "Services"],
  ["material", "Material", "Materials"],
  ["labor", "Labor", "Labor"],
];

export function kindLabel(kind) {
  return (PRICE_BOOK_KINDS.find(([key]) => key === kind) || PRICE_BOOK_KINDS[0])[1];
}

// The kinds these items use, in display order. An item with no kind counts as a service.
export function kindsIn(items) {
  const used = new Set((items || []).map((item) => item.kind || "service"));
  return PRICE_BOOK_KINDS.map(([kind]) => kind).filter((kind) => used.has(kind));
}

// Items of one kind ("all" for every kind) that match every word typed.
export function filterPriceBook(items, { query = "", kind = "all" } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (items || []).filter((item) => {
    if (kind !== "all" && (item.kind || "service") !== kind) return false;
    const text = [item.name, item.description, item.category, item.unit].filter(Boolean).join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

// The number at the start of a free-text quantity, for an invoice line: "2 gal" -> "2",
// "1.5 boxes" -> "1.5", "10 x 2x4x8" -> "10". Nothing usable ("", "a few", "0") -> "1".
export function billQuantity(text) {
  const match = /^\s*(\d+(?:\.\d{1,2})?|\.\d{1,2})/.exec(String(text ?? ""));
  if (!match) return "1";
  const value = Number(match[1]);
  return value > 0 ? formatQuantity(value.toFixed(2)) : "1";
}

// A job's materials as invoice lines. Tools are left out: they come back with the crew.
// A material picked from the price book brings its price; one typed by hand has none,
// so the owner fills it in. items: the owner's view of a job's list (it has unit_price).
export function materialLines(items) {
  return (items || [])
    .filter((item) => item.kind !== "tool")
    .map((item) => ({
      ...blankItem(),
      description: String(item.name).slice(0, MAX_DESCRIPTION),
      quantity: billQuantity(item.quantity),
      unit_price: item.unit_price || "",
    }));
}

// Minutes as hours for a quantity, to two decimals: 90 -> "1.5", 50 -> "0.83". Never below 0.01.
export function hoursFromMinutes(minutes) {
  const hundredths = Math.max(1, Math.round((Math.max(0, Number(minutes) || 0) / 60) * 100));
  return formatQuantity((hundredths / 100).toFixed(2));
}

// An hourly price book item as a line for the time clocked on a job.
export function laborLine(item, minutes) {
  return { ...blankItem(), description: lineDescription(item), quantity: hoursFromMinutes(minutes), unit_price: item.unit_price };
}

// The editor's lines with more added at the end. An untouched last line is replaced, and
// nothing goes past the limit. Returns { items, added }.
export function appendLines(items, lines) {
  const last = items[items.length - 1];
  const kept = last && isBlankLine(last) ? items.slice(0, -1) : items;
  const room = Math.max(0, MAX_ITEMS - kept.length);
  const fitting = lines.slice(0, room);
  return { items: fitting.length ? [...kept, ...fitting] : items, added: fitting.length };
}
