// Words for drive times: between a crew's jobs on a day, and from where someone is to a
// job (server/routes/drive.py). Times are without traffic.

// 12 -> "12 min", 65 -> "1 h 5 min", 120 -> "2 h".
export function durationText(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

// "12 min drive · 4.1 mi". A guessed time (the route service could not answer) says "about".
// Two jobs at one address: "Same address".
export function driveText(leg) {
  if (!leg.minutes && !Number(leg.miles)) return "Same address";
  const time = `${leg.estimated ? "about " : ""}${durationText(leg.minutes)} drive`;
  return `${time} · ${Number(leg.miles).toFixed(1)} mi`;
}

// What is wrong with the time between two jobs, or "" when the drive fits.
export function tightText(leg) {
  if (!leg.tight) return "";
  if (leg.gap_minutes < 0) return `These jobs overlap by ${durationText(-leg.gap_minutes)}`;
  if (leg.gap_minutes === 0) return "No time between these jobs";
  return `Only ${durationText(leg.gap_minutes)} between these jobs`;
}

// How many of a day's drives do not fit, across everyone.
export function tightCount(people) {
  return (people || []).reduce((count, person) => count + person.legs.filter((leg) => leg.tight).length, 0);
}

// The "arriving in about" choice for a drive: the first one long enough, or the longest.
export function suggestEta(minutes, choices) {
  const sorted = [...choices].sort((a, b) => a - b);
  return sorted.find((choice) => choice >= minutes) ?? sorted[sorted.length - 1];
}

// Why the device could not say where it is, from a GeolocationPositionError code.
export function locationProblem(code) {
  if (code === 1) return "Location is turned off for this site. Allow it in your browser's settings, or pick a time yourself.";
  if (code === 3) return "Finding your location took too long. Try again, or pick a time yourself.";
  return "Your location could not be found. Try again, or pick a time yourself.";
}
