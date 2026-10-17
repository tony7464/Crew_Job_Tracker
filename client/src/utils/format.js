export const STATUSES = ["scheduled", "completed", "cancelled"];

export function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatDay(value, weekday = "short") {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday,
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value) {
  return value ? value.slice(0, 5) : "";
}

export function formatMoney(value) {
  return `$${Number(value).toFixed(2)}`;
}
