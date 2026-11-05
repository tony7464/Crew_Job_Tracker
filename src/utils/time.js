// Business wall-clock time helpers.
//
// The calendar runs FullCalendar in its "UTC" time zone and treats every UTC field
// as a wall-clock field in the business time zone. A job at 09:00 on 2026-11-02 is
// the Date 2026-11-02T09:00:00Z. That keeps the grid in business time no matter
// where the phone or computer is.

const FALLBACK_ZONE = "America/Chicago";

function partsIn(timeZone, date = new Date()) {
  let format;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return partsIn(FALLBACK_ZONE, date);
  }
  return Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
}

// "Now" in the business time zone, as a wall-clock Date (see above).
export function businessNow(timeZone) {
  const p = partsIn(timeZone);
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second));
}

// Today's date in the business time zone, "YYYY-MM-DD".
export function businessToday(timeZone) {
  const p = partsIn(timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

// "YYYY-MM-DD" and "HH:MM" from a wall-clock Date.
export function wallDate(date) {
  return date.toISOString().slice(0, 10);
}

export function wallTime(date) {
  return date.toISOString().slice(11, 16);
}

// A wall-clock Date from "YYYY-MM-DD" and "HH:MM[:SS]".
export function wallDateTime(day, time) {
  return new Date(`${day}T${time.slice(0, 5)}:00Z`);
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function minutesBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function addDays(day, count) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return wallDate(date);
}

// Sunday of the week that contains day. Weeks run Sunday to Saturday, like the calendar.
export function weekStart(day) {
  return addDays(day, -new Date(`${day}T00:00:00Z`).getUTCDay());
}

// "HH:MM" plus minutes, or null if it would pass midnight.
export function addToTime(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
