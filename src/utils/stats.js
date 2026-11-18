// Statistics helpers: how one period compares with the one before, and chart labels.

// How a count or an amount moved. { direction: "up" | "down" | "flat" | "new" | "none", percent }.
// "new": there was nothing before, so there is no percent to give. "none": nothing in either period.
export function trend(current, previous) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (!now && !before) return { direction: "none", percent: null };
  if (!before) return { direction: "new", percent: null };
  const change = (now - before) / before;
  const percent = Math.round(Math.abs(change) * 100);
  if (percent === 0) return { direction: "flat", percent: 0 };
  return { direction: change > 0 ? "up" : "down", percent };
}

// How a rate (a fraction such as 0.25, or null) moved, in percentage points.
// { direction: "up" | "down" | "flat" | "none", points }. "none": one side has no rate.
export function rateTrend(current, previous) {
  if (current == null || previous == null) return { direction: "none", points: null };
  const points = Math.round((Number(current) - Number(previous)) * 100);
  if (points === 0) return { direction: "flat", points: 0 };
  return { direction: points > 0 ? "up" : "down", points: Math.abs(points) };
}

// 0.3333 -> "33%"; null -> "–" (nothing to divide by).
export function formatRate(value) {
  return value == null ? "–" : `${Math.round(Number(value) * 100)}%`;
}

// "the 30 days before", "the 13 weeks before".
export function beforeLabel(days) {
  return days % 7 === 0 && days > 7 ? `the ${days / 7} weeks before` : `the ${days} days before`;
}

// The sentence under a number: "12% more than the 30 days before".
export function trendText(found, days) {
  const before = beforeLabel(days);
  if (found.direction === "none") return "";
  if (found.direction === "new") return `None in ${before}`;
  if (found.direction === "flat") return `Same as ${before}`;
  if (found.points != null) {
    return `${found.points} ${found.points === 1 ? "point" : "points"} ${found.direction === "up" ? "higher" : "lower"} than ${before}`;
  }
  return `${found.percent}% ${found.direction === "up" ? "more" : "less"} than ${before}`;
}

const DAY = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

function dayLabel(iso) {
  return DAY.format(new Date(`${iso}T12:00:00Z`));
}

// "Nov 3" for a day, "Nov 3 – Nov 9" for a week.
export function bucketLabel(bucket) {
  return bucket.start === bucket.end ? dayLabel(bucket.start) : `${dayLabel(bucket.start)} – ${dayLabel(bucket.end)}`;
}

// A round number at or above max for the top of a chart's axis: 1, 2, 2.5, 5, or 10 times a power of ten.
export function axisTop(max) {
  if (!(max > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((multiple) => multiple * power >= max);
  return step * power;
}

// Which bars get a label under them, so labels never crowd: about six, always the first and last.
export function labelledIndexes(count, wanted = 6) {
  if (count <= wanted) return new Set(Array.from({ length: count }, (_, index) => index));
  const every = Math.ceil((count - 1) / (wanted - 1));
  const picked = new Set([0, count - 1]);
  for (let index = every; index < count - 1 - every / 2; index += every) picked.add(index);
  return picked;
}
