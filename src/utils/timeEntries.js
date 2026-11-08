// Time entries (clocking in and out). The API sends UTC timestamps; these show them in
// the business time zone, and turn them into the wall-clock "YYYY-MM-DDTHH:MM" strings
// that <input type="datetime-local"> uses and the API accepts for owner edits.

const FALLBACK_ZONE = "America/Chicago";

function format(timeZone, options) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, ...options });
  } catch {
    return new Intl.DateTimeFormat(undefined, { timeZone: FALLBACK_ZONE, ...options });
  }
}

// "9:02 AM"
export function formatClockTime(iso, timeZone) {
  return format(timeZone, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

// "Fri, Nov 6"
export function formatEntryDay(iso, timeZone) {
  return format(timeZone, { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

function partsIn(timeZone, date) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return partsIn(FALLBACK_ZONE, date);
  }
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

// A UTC timestamp as "YYYY-MM-DDTHH:MM" in the business time zone.
export function toWallInput(iso, timeZone) {
  const p = partsIn(timeZone, new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// The business-local day ("YYYY-MM-DD") a UTC timestamp falls on.
export function entryDayKey(iso, timeZone) {
  return toWallInput(iso, timeZone).slice(0, 10);
}

// "2 h 5 min", or "0 min".
export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

// Decimal hours for timesheets: 95 minutes is "1.58".
export function formatHours(minutes) {
  return (minutes / 60).toFixed(2);
}

// Minutes on the clock for an open entry, counted from now.
export function liveMinutes(entry, now = Date.now()) {
  if (!entry.open) return entry.minutes;
  return Math.max(0, Math.floor((now - new Date(entry.clock_in_at).getTime()) / 60000));
}

// Monday to Sunday around a "YYYY-MM-DD" day: { start, end }.
export function weekOf(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - offset * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export function shiftDays(day, days) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
}

// Pages tell each other when someone clocks in or out, so the "on the clock" bar catches up.
const CLOCK_CHANGED = "cjt:clock-changed";

export function notifyClockChanged() {
  window.dispatchEvent(new Event(CLOCK_CHANGED));
}

export function onClockChanged(handler) {
  window.addEventListener(CLOCK_CHANGED, handler);
  return () => window.removeEventListener(CLOCK_CHANGED, handler);
}
