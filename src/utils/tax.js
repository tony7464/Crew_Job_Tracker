// Sales tax by ZIP code: helpers for the tax rate line on quotes and invoices, and the
// Settings card. The server keeps one rate per ZIP code and looks rates up
// (server/routes/tax.py, server/tax_lookup.py).
import { formatPercent, formatQuantity } from "./quotes.js";

// A lookup older than this is worth doing again: rates often change with the quarter.
const STALE_DAYS = 120;

// The ZIP code in an address typed on one line, or null. The same rule as the server:
// the last five-digit number, and not a house number at the very start of the address.
export function zipFromAddress(address) {
  const text = String(address || "").trim().replace(/\s+/g, " ");
  let found = null;
  for (const match of text.matchAll(/\d{5}(?:-\d{4})?/g)) {
    const start = match.index;
    const end = start + match[0].length;
    const insideANumber = /\d/.test(text[start - 1] || "") || /\d/.test(text[end] || "");
    if (insideANumber) continue;
    if (start > 0 || end === text.length) found = match[0].slice(0, 5);
  }
  return found;
}

// "7.50" -> "7.5", for the tax rate box.
export function rateForInput(rate) {
  return rate === null || rate === undefined ? "" : formatQuantity(rate);
}

// Whether what is typed in the tax rate box is this rate: "7.5" and "7.50" are the same.
export function sameRate(typed, rate) {
  const text = String(typed ?? "").trim();
  if (text === "" || rate === null || rate === undefined) return false;
  const a = Number(text);
  const b = Number(rate);
  return Number.isFinite(a) && Number.isFinite(b) && Math.round(a * 100) === Math.round(b * 100);
}

// A rate typed in the box that can be saved: a number from 0 to 100 with at most two decimals.
export function typedRate(typed) {
  const text = String(typed ?? "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  return Number(text) <= 100 ? text : null;
}

// "Nebraska 5.5% + City of Omaha 2%", or "" when the lookup gave no parts.
export function breakdownText(breakdown) {
  return (breakdown || []).map((part) => `${part.name} ${formatPercent(part.rate)}`).join(" + ");
}

// Whether a lookup is old enough to do again. now: milliseconds, for tests.
export function isStale(lookedUpAt, now = Date.now()) {
  if (!lookedUpAt) return false;
  const then = new Date(lookedUpAt).getTime();
  return Number.isFinite(then) && now - then > STALE_DAYS * 86_400_000;
}

// "68107 (Omaha, Nebraska)" or just "68107".
export function zipLabel(postalCode, place) {
  return place ? `${postalCode} (${place})` : postalCode;
}
