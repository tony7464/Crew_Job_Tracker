// Words for the admin pages (Crew Job Tracker's own staff) and for the owner's
// Support access card in Settings.
import { formatMoney } from "./format.js";

const PLAN_NAMES = { solo: "Solo", crew: "Crew", pro: "Pro" };

// For the plan picker: [value, label]. "" is no plan.
export const PLAN_OPTIONS = [["", "No plan"], ...Object.entries(PLAN_NAMES)];

export function planName(plan) {
  return PLAN_NAMES[plan] || "No plan";
}

// "Crew · $19.00 a month (list $59.00)", "Pro · $99.00 a month", or "No plan".
// An agreed price replaces the plan's list price.
export function planLabel(business) {
  const name = planName(business.plan);
  const agreed = business.plan_price_cents;
  const list = business.list_price_cents;
  if (agreed !== null && agreed !== undefined) {
    const beside = Number.isInteger(list) && list !== agreed ? ` (list ${formatMoney(list)})` : "";
    return `${name} · ${formatMoney(agreed)} a month${beside}`;
  }
  return Number.isInteger(list) ? `${name} · ${formatMoney(list)} a month` : name;
}

// How many days support access is allowed for, from its hours: 24 -> "1 day", 168 -> "7 days".
export function accessLength(hours) {
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

// A time from the API (UTC, ISO) in this device's time: "Nov 13, 3:05 PM". "" for none.
export function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

// A calendar day from the API ("2026-12-31") with its year: "Dec 31, 2026". "" for none.
export function formatDate(day) {
  const [year, month, date] = String(day || "").split("-").map(Number);
  if (!year || !month || !date) return "";
  return new Date(year, month - 1, date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// How long ago a time from the API was: "Today", "Yesterday", "5 days ago", "3 months ago".
// "Never" for none. now: milliseconds, for tests.
export function ago(iso, now = Date.now()) {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

// Whether what was typed is the business's name, capitals and extra spaces aside. For the
// first step of deleting a business; the server checks the same before it deletes.
export function sameName(typed, name) {
  const plain = (value) => String(value ?? "").trim().split(/\s+/).join(" ").toLowerCase();
  return plain(name) !== "" && plain(typed) === plain(name);
}

// What deleting a business removes, one line each, from the server's count of it.
export function deletedThings(summary) {
  const some = (count, one, many) => (count > 0 ? `${count} ${count === 1 ? one : many}` : null);
  return [
    summary.people === 1 ? "1 person (the owner)" : `${summary.people} people (the owner and the crew)`,
    some(summary.clients, "client", "clients"),
    some(summary.jobs, "job, with its notes and hours", "jobs, with their notes and hours"),
    some(summary.quotes, "quote", "quotes"),
    some(summary.invoices, "invoice, with its payments", "invoices, with their payments"),
    some(summary.photos, "photo", "photos"),
    summary.website ? "Its website" : null,
  ].filter(Boolean);
}

// "For 3 days" -> " for 3 days"; nothing -> "".
function trailing(detail) {
  return detail ? ` ${detail.charAt(0).toLowerCase()}${detail.slice(1)}` : "";
}

// One line of the record, in words. forOwner: as the business's owner reads it in
// Settings, where the admin is only ever "Support".
export function eventText(event, forOwner = false) {
  const who = forOwner ? "Support" : event.admin_name || "An admin";
  const owner = forOwner ? "You" : "The owner";
  const account = forOwner ? "your account" : "this business";
  switch (event.action) {
    case "support_access_on":
      return `${owner} turned on support access${trailing(event.detail)}`;
    case "support_access_off":
      return `${owner} turned off support access`;
    case "support_view_started":
      return `${who} started looking at ${account}`;
    case "support_view_ended":
      return `${who} stopped looking at ${account}`;
    case "password_reset_sent":
      return `${who} sent a password reset email${trailing(event.detail)}`;
    case "plan_changed":
      return `${who} changed the plan${event.detail ? `: ${event.detail.replace(" -> ", " to ")}` : ""}`;
    case "site_unpublished":
      return `${who} took ${forOwner ? "your website" : "the website"} down${event.detail ? ` (${event.detail})` : ""}`;
    case "site_allowed":
      return `${who} allowed ${forOwner ? "your website" : "the website"} to be published again${event.detail ? ` (${event.detail})` : ""}`;
    case "site_domain_connected":
      return `${who} connected ${forOwner ? "your website" : "the website"} to its own address${event.detail ? ` (${event.detail})` : ""}`;
    case "site_domain_disconnected":
      return `${who} disconnected ${forOwner ? "your website" : "the website"} from its own address${event.detail ? ` (${event.detail})` : ""}`;
    case "site_domain_released":
      return forOwner
        ? `Your website stopped using its own address${event.detail ? ` (${event.detail})` : ""}`
        : `The owner gave up the website's own address${event.detail ? ` (${event.detail})` : ""}. Remove it at the host`;
    case "business_renamed":
      return `${who} set the business name${event.detail ? `: ${event.detail.replace(" -> ", " to ")}` : ""}`;
    case "business_deleted":
      return `${who} deleted a business for good${event.detail ? `: ${event.detail}` : ""}`;
    case "admin_granted":
      return `Admin rights given${event.detail ? ` to ${event.detail}` : ""}`;
    case "admin_revoked":
      return `Admin rights taken away${event.detail ? ` from ${event.detail}` : ""}`;
    default:
      return event.detail || event.action;
  }
}

// The longest business name (server/schemas.py MAX_BUSINESS_NAME, the owner's own Settings limit).
export const MAX_BUSINESS_NAME = 80;

// Why a business name cannot be saved, or "" when it can. Spaces at either end do not count.
export function businessNameError(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "Enter the business's name.";
  if (trimmed.length > MAX_BUSINESS_NAME) return `Use at most ${MAX_BUSINESS_NAME} characters.`;
  return "";
}
