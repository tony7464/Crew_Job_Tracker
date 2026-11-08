export const STATUSES = ["scheduled", "completed", "cancelled"];

export const DEFAULT_DURATION = 60;
// Choices for the job form, in minutes.
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];

export function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function parseDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(value, weekday = "short") {
  return parseDay(value).toLocaleDateString(undefined, {
    weekday,
    month: "short",
    day: "numeric",
  });
}

function minutesOf(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function clockLabel(totalMinutes) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "9:00 AM" (or the reader's locale style) from "09:00:00".
export function formatTime(value) {
  return value ? clockLabel(minutesOf(value)) : "";
}

// "09:00" for <input type="time">.
export function inputTime(value) {
  return value ? value.slice(0, 5) : "";
}

// "9:00 AM – 10:30 AM" from a start time and a length in minutes.
export function formatTimeRange(time, minutes = DEFAULT_DURATION) {
  if (!time) return "";
  const start = minutesOf(time);
  return `${clockLabel(start)} – ${clockLabel(start + minutes)}`;
}

// "12:00 PM – 12:30 PM" from two times.
export function formatClockRange(start, end) {
  return start && end ? `${formatTime(start)} – ${formatTime(end)}` : "";
}

// "1 h 30 min", "45 min", "2 h".
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const MONEY = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

// Whole cents (an integer) to an exact "123.45" string, with integer math only.
export function centsToDecimal(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const rest = abs % 100;
  return `${sign}${(abs - rest) / 100}.${String(rest).padStart(2, "0")}`;
}

// "$1,234.50" from whole cents. Intl formats the exact decimal string, so money
// never goes through floating-point division.
export function formatMoney(cents) {
  return MONEY.format(centsToDecimal(Number.isInteger(cents) ? cents : 0));
}

export function sumCents(jobs) {
  return jobs.reduce((total, job) => total + job.price_cents, 0);
}

// Owed money: work that is done (completed) and not paid. Same rule as the server.
// Estimate visits are free, so they are never owed.
export function isOwed(job) {
  return job.kind !== "estimate" && job.status === "completed" && !job.paid;
}

// Whole days from one "YYYY-MM-DD" date to a later one (0 if later is not after).
export function daysBetween(from, to) {
  const utc = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.max(0, Math.round((utc(to) - utc(from)) / 86400000));
}

// "Due today", "1 day overdue", "12 days overdue".
export function overdueLabel(days) {
  if (!days) return "Due today";
  return `${days} ${days === 1 ? "day" : "days"} overdue`;
}

export function prettyTimeZone(zone) {
  return (zone || "").replace(/_/g, " ");
}
