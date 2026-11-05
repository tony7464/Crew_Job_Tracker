import { formatDay } from "./format";

export const REQUEST_STATUSES = ["new", "quoted", "won", "lost"];

export const TIME_WINDOWS = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
  ["any", "Any time"],
];
const WINDOW_LABELS = Object.fromEntries(TIME_WINDOWS);
// Same limits as the server.
export const MAX_PREFERRED_WINDOWS = 3;
export const MAX_PHOTOS = 5;
export const MAX_NOTES = 2000;

// "Thu, Nov 5 · Morning".
export function formatWindow(option) {
  return `${formatDay(option.date)} · ${WINDOW_LABELS[option.window] || option.window}`;
}

// "Nov 1, 3:04 PM" in the business time zone; "Today, 3:04 PM" for today.
export function formatReceived(iso, timeZone) {
  if (!iso) return "";
  const date = new Date(iso);
  const day = (value) => value.toLocaleDateString("en-CA", { timeZone });
  const time = date.toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
  if (day(date) === day(new Date())) return `Today, ${time}`;
  const sameYear = date.toLocaleDateString("en-CA", { timeZone, year: "numeric" }) ===
    new Date().toLocaleDateString("en-CA", { timeZone, year: "numeric" });
  const dayLabel = date.toLocaleDateString(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${dayLabel}, ${time}`;
}

// The first message for each field in a 400 response: { name: "Missing data…" }.
// Nested errors (like one preferred date) become one message for the parent field.
export function fieldErrors(error) {
  const errors = error?.data?.errors;
  if (!errors || typeof errors !== "object") return {};
  const first = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.length ? first(value[0]) : "";
    if (value && typeof value === "object") return first(Object.values(value)[0]);
    return "";
  };
  return Object.fromEntries(Object.entries(errors).map(([field, value]) => [field, first(value)]));
}

// Today as "YYYY-MM-DD" on this device, for date inputs.
export function localToday() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Same rules as the server: an optional leading +, then digits, spaces, dashes,
// dots, and parentheses, with 7 to 15 digits.
export function phoneLooksValid(value) {
  const digits = value.replace(/\D/g, "").length;
  return /^\+?[0-9().\-\s]{7,30}$/.test(value) && digits >= 7 && digits <= 15;
}

export function emailLooksValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
