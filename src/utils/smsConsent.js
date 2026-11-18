// A customer's consent to job texts (A2P 10DLC): a box right next to their phone number,
// never ticked for them and never needed to send a form. The server keeps the same words
// with each consent (server/sms_consent.py), and the public /sms-consent page shows them
// with "[Business]" for the name.

const WORDING =
  "By checking this box, I agree to receive job updates by text from {business} via Crew Job Tracker, including appointment confirmations, reminders, on-the-way notices, and quote and invoice links. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";
// The text a customer gets right after they agree (server/sms_consent.py sends it).
const CONFIRMATION =
  "Crew Job Tracker: You're subscribed to job updates from {business}. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.";

// For a business with no name yet: never brackets or a blank in front of a customer.
const NO_NAME = "this business";

function withName(template, businessName) {
  const name = String(businessName ?? "").trim() || NO_NAME;
  // A function, so a name with "$&" or "$1" in it is kept exactly as typed.
  return template.replace("{business}", () => name);
}

// The consent words with this business's name in them.
export function smsConsentText(businessName) {
  return withName(WORDING, businessName);
}

// The opt-in confirmation text with this business's name in it.
export function smsConfirmationText(businessName) {
  return withName(CONFIRMATION, businessName);
}

const WHERE = {
  intake_form: "on your request form",
  owner_form: "recorded by your business",
};

function day(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Where a client's (or request's) consent stands, in one sentence for the business:
// "Agreed to job texts on Nov 16, 2026, on your request form."
export function consentSummary(holder) {
  if (!holder) return "";
  if (holder.sms_opt_out) return "Marked not to be texted.";
  const when = holder.sms_consent_at ? day(holder.sms_consent_at) : "";
  if (holder.sms_consent) {
    const where = WHERE[holder.sms_consent_source];
    return `Agreed to job texts${when ? ` on ${when}` : ""}${where ? `, ${where}` : ""}.`;
  }
  if (holder.sms_consent_revoked_at) return `Consent to job texts was taken back on ${day(holder.sms_consent_revoked_at)}.`;
  return "Has not agreed to job texts.";
}

// The line about texts on a request's page. A request with a client goes by the client's own
// consent and number. One without goes by the customer's tick on the form, except where the
// business has a no on record for that number (sms_state, from the server).
export function requestConsentLine(request) {
  const client = request?.client;
  if (client) {
    if (client.sms_opt_out) return "Texts go by their client page: they are marked not to be texted.";
    if (client.sms_consent && (request.sms_state === "no_phone" || normalizePhone(client.phone) === null)) {
      return "Texts go by their client page: they agreed, but their number cannot get texts.";
    }
    if (client.sms_consent) return `Texts go by their client page: agreed to job texts at ${client.phone}.`;
    return "Texts go by their client page: they have not agreed to job texts.";
  }
  if (!request?.sms_consent) return "Has not agreed to job texts.";
  if (request.sms_state === "no_phone") return "Agreed on the request form, but this number cannot get texts.";
  if (request.sms_state === "opted_out") {
    return "Agreed on the request form, but a client page marks this number not to be texted, so no texts go.";
  }
  if (request.sms_state && request.sms_state !== "ok") {
    return "Agreed on the request form, but consent for this number was taken back on a client page, so no texts go.";
  }
  return "Agreed to job texts on the request form.";
}

// Stripped from the ends of a typed number before looking for a leading +: any space, and the
// invisible mark some copies carry. The same as the server's (server/sms.py PHONE_ENDS): what
// \s matches here, and the few more that Python counts as space.
const MORE_SPACE = new Set(["\x1c", "\x1d", "\x1e", "\x1f", "\x85"]);
const isSpace = (character) => /\s/.test(character) || MORE_SPACE.has(character);

function trimPhone(raw) {
  const text = String(raw ?? "");
  let start = 0;
  let end = text.length;
  while (start < end && isSpace(text[start])) start += 1;
  while (end > start && isSpace(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

// A phone number as the server texts it ("+15125550142"), or null: server/sms.py normalize_phone.
// Ten digits are a US or Canada number; anything else must start with +. Only 0-9 count.
export function normalizePhone(raw) {
  const text = trimPhone(raw);
  const digits = text.replace(/[^0-9]/g, "");
  if (!text) return null;
  if (text.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// server/models.py phone_digits: the digits, without a US or Canada 1 in front of eleven.
function phoneDigits(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return (digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits).slice(0, 20);
}

// Whether two typed numbers are the same number to text, as the server decides it
// (server/sms_consent.py same_number): "(512) 555-0199" and "+1 512 555 0199" are, and
// "+512 555 0199" (another country) is not.
export function samePhone(first, second) {
  const one = normalizePhone(first);
  const other = normalizePhone(second);
  if (one !== null || other !== null) return one === other;
  return phoneDigits(first) === phoneDigits(second);
}

// The client form's box: whether it shows ticked, and whether to send it with the save.
// initial: the saved client (none when adding); phone: the number in the form now; ticked:
// null, or the last clicks on the box as { checked, phone, from }: what the last click left,
// the number in the form then, and what the box showed before the first of those clicks
// (nextClick makes it). Consent is for one number: a new number starts unticked, and clicks
// count only for the number they were made for (or for any, when no whole number was typed
// yet), and only when they changed something. When editing, the box is sent only when it
// differs from how it started, so saving other changes, or a page left open while someone
// else changed it, never gives or takes consent.
export function formConsent({ initial, phone, ticked }) {
  const agreedBefore = Boolean(initial?.sms_consent);
  const newNumber = Boolean(initial) && !samePhone(phone, initial.phone);
  const untouched = newNumber ? false : agreedBefore;
  const changed = Boolean(ticked) && ticked.checked !== ticked.from;
  const forThisNumber = changed && (normalizePhone(ticked.phone) === null || samePhone(ticked.phone, phone));
  const checked = forThisNumber ? ticked.checked : untouched;
  return {
    checked,
    send: !initial || checked !== untouched,
    newNumber,
    agreedBefore,
    clicked: forThisNumber,
    // Ticked for a number that is no longer in the form: it has to be ticked again for this one.
    tickedForOther: changed && !forThisNumber && ticked.checked ? ticked.phone : null,
  };
}

// The record of a click on the box (ticked for formConsent): last is the one before, shown what
// the box showed when clicked. Clicks on the same number run together from the first one.
export function nextClick(last, { checked, phone, shown }) {
  return { checked, phone, from: last && samePhone(last.phone, phone) ? last.from : shown };
}

// The clicks once a save sent with sent has worked: those are now what was saved, so the box
// starts from that. A click made while it saved (last) is kept, counted from what the save left.
export function afterSave(last, sent) {
  if (last === sent) return null;
  if (last && sent && samePhone(last.phone, sent.phone)) return { ...last, from: sent.checked };
  return last;
}

// The box's part of the client form's body: only what formConsent says to send.
export function consentField({ checked, send }) {
  return send ? { sms_consent: checked } : {};
}

// Whether a text may go to them, as far as the page knows (the server checks again): a number
// the server can text, read the way it reads one (normalizePhone), consent, and no mark not to
// be texted. cannot_text: the server said their number cannot get texts (utils/booking.js).
export function mayText(holder) {
  return Boolean(normalizePhone(holder?.phone) && holder.sms_consent && !holder.sms_opt_out && !holder.cannot_text);
}
