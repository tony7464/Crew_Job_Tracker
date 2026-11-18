// What became of each text, and what the owner is told when texts are not arriving
// (server/sms_status.py). A text's delivery is { state, label, error_code, reason }: state is
// delivered, sent, sending, failed (not delivered), not_sent, or logged (texting is not set up).

const TONES = {
  delivered: "success",
  sent: "neutral",
  sending: "neutral",
  failed: "danger",
  not_sent: "warning",
  logged: "warning",
};

// A text's status as a badge: { label, tone, reason }, or null when there is none (an email,
// or a text sent before statuses were kept).
export function deliveryBadge(delivery) {
  if (!delivery?.label) return null;
  return { label: delivery.label, tone: TONES[delivery.state] || "neutral", reason: delivery.reason || null };
}

// The alert for a business whose texts are not arriving (GET /api/business/texting), or null.
// "Texting isn't on yet" only once texts were held back this week (or always), so a business
// that texts nobody is not nagged about it on every page.
export function textingAlert(summary, { always = false } = {}) {
  const problem = summary?.problem;
  if (!problem) return null;
  if (problem.code === "not_set_up" && !problem.count && !always) return null;
  return {
    // Waiting on carriers is a warning; texting that is off or set up wrong needs fixing.
    tone: problem.code === "carrier_approval" || problem.code === "carrier_filtered" ? "warning" : "danger",
    title: problem.title,
    message: problem.message,
  };
}

const KIND_LABELS = {
  opt_in_confirmation: "Opt-in confirmation",
  visit_confirmation: "Visit confirmation",
  visit_rescheduled: "New visit time",
  visit_cancelled: "Cancellation",
  visit_reminder: "Day-before reminder",
  on_my_way: "On my way",
  quote_link: "Quote link",
};

// One text that did not arrive, in a line: "Visit confirmation to •••0133: Pending carrier approval (30034)".
export function failureLine(failure) {
  const what = KIND_LABELS[failure?.kind] || "Text";
  return `${what} to ${failure?.sent_to || "them"}: ${failure?.short || "Not delivered"}`;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The last week of texts in one sentence: "5 texts in the last 7 days: 3 delivered, 2 not delivered."
export function weekSummary(week) {
  if (!week) return "";
  const parts = [
    [week.delivered, "delivered"],
    [week.sent, "sent"],
    [week.sending, "sending"],
    [week.failed, "not delivered"],
    [week.not_sent, "not sent"],
    [week.logged, "only logged"],
  ].filter(([count]) => count > 0);
  const total = parts.reduce((sum, [count]) => sum + count, 0);
  if (!total) return "No texts in the last 7 days.";
  return `${plural(total, "text")} in the last 7 days: ${parts.map(([count, label]) => `${count} ${label}`).join(", ")}.`;
}
