import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afterSave,
  consentField,
  consentSummary,
  formConsent,
  mayText,
  nextClick,
  normalizePhone,
  requestConsentLine,
  samePhone,
  smsConfirmationText,
  smsConsentText,
} from "../src/utils/smsConsent.js";

// Word for word as the server keeps it with each consent (server/tests/test_sms_consent.py).
const WORDS =
  "By checking this box, I agree to receive job updates by text from Boss Gutters via Crew Job Tracker, including appointment confirmations, reminders, on-the-way notices, and quote and invoice links. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

test("the consent words name the business", () => {
  assert.equal(smsConsentText("Boss Gutters"), WORDS);
  assert.equal(smsConsentText("  Boss Gutters  "), WORDS);
  // No name yet: never brackets or a blank in front of a customer.
  for (const missing of [null, undefined, "", "   "]) {
    assert.equal(smsConsentText(missing), WORDS.replace("Boss Gutters", "this business"));
  }
  // A name is kept exactly as typed, even one that looks like a pattern.
  for (const name of ["A$&B Co", "$1 Windows", "Ann's {business} Co."]) {
    assert.equal(smsConsentText(name), WORDS.replace("Boss Gutters", () => name));
  }
  // The public /sms-consent page shows the same words with [Business].
  assert.equal(smsConsentText("[Business]"), WORDS.replace("Boss Gutters", "[Business]"));
});

test("the confirmation text names the business, word for word as the server sends it", () => {
  assert.equal(
    smsConfirmationText("Boss Gutters"),
    "Crew Job Tracker: You're subscribed to job updates from Boss Gutters. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.",
  );
  assert.equal(smsConfirmationText(""), smsConfirmationText("this business"));
  assert.equal(smsConfirmationText("A$&B"), smsConfirmationText("Boss Gutters").replace("Boss Gutters", () => "A$&B"));
});

test("where a client's consent stands, in one sentence", () => {
  // Noon UTC is the same day in every US time zone.
  const at = "2026-11-16T12:00:00+00:00";
  assert.equal(consentSummary({ sms_consent: true, sms_consent_at: at, sms_consent_source: "intake_form" }), "Agreed to job texts on Nov 16, 2026, on your request form.");
  assert.equal(consentSummary({ sms_consent: true, sms_consent_at: at, sms_consent_source: "owner_form" }), "Agreed to job texts on Nov 16, 2026, recorded by your business.");
  // Taken back: the record of the consent is kept, and the date it ended is shown.
  const later = "2026-11-18T12:00:00+00:00";
  assert.equal(
    consentSummary({ sms_consent: false, sms_consent_at: at, sms_consent_source: "owner_form", sms_consent_revoked_at: later }),
    "Consent to job texts was taken back on Nov 18, 2026.",
  );
  assert.equal(consentSummary({ sms_consent: false, sms_consent_at: null }), "Has not agreed to job texts.");
  assert.equal(consentSummary({}), "Has not agreed to job texts.");
  assert.equal(consentSummary(null), "");
  // Marked not to be texted (they asked, or an earlier import said so): no texts, whatever else.
  assert.equal(consentSummary({ sms_consent: true, sms_opt_out: true }), "Marked not to be texted.");
});

test("phone numbers are the same number exactly when the server says so", () => {
  // server/sms.py normalize_phone, case for case.
  assert.equal(normalizePhone("(512) 555-0199"), "+15125550199");
  assert.equal(normalizePhone("1-512-555-0199"), "+15125550199");
  assert.equal(normalizePhone("+1 512 555 0199"), "+15125550199");
  assert.equal(normalizePhone("+512 555 0199"), "+5125550199");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  for (const notOne of ["", "  ", null, "555-0199", "+1234567", "2-512-555-0199"]) assert.equal(normalizePhone(notOne), null, notOne);
  // Read the same way as the server, whatever is pasted around it (server/tests/test_sms_consent.py).
  assert.equal(normalizePhone("\uFEFF+5125550199"), "+5125550199");
  assert.equal(normalizePhone(" \t+1 512 555 0199\n"), "+15125550199");
  for (const spaced of ["\u0085+5125550199", " +5125550199", " +5125550199　", "\x1c+5125550199"]) {
    assert.equal(normalizePhone(spaced), "+5125550199", JSON.stringify(spaced));
  }
  assert.equal(normalizePhone("５１２５５５０１９９"), null);
  assert.equal(samePhone("512-555-0199", "\uFEFF+5125550199"), false);
  // server/sms_consent.py same_number.
  assert.equal(samePhone("512-555-0199", "(512) 555-0199"), true);
  assert.equal(samePhone("512-555-0199", "+1 512 555 0199"), true);
  assert.equal(samePhone("512-555-0199", "1 (512) 555-0199"), true);
  assert.equal(samePhone("512-555-0199", "+512 555 0199"), false);
  assert.equal(samePhone("+5125550199", "512-555-0199"), false);
  assert.equal(samePhone("512-555-0199", "512-555-0177"), false);
  assert.equal(samePhone("555-0199", "555.0199"), true);
  assert.equal(samePhone("", null), true);
});

// The box as the client form keeps it: clicks made one after another, as nextClick records them.
function clicks(initial, ...steps) {
  let ticked = null;
  for (const [checked, phone] of steps) {
    const shown = formConsent({ initial, phone, ticked }).checked;
    ticked = nextClick(ticked, { checked, phone, shown });
  }
  return ticked;
}

test("the client form's box: a new number starts unticked, and an untouched box is not sent", () => {
  // Adding: unticked, and sent as it is.
  assert.deepEqual(pick(formConsent({ initial: null, phone: "512-555-0199", ticked: null })), { checked: false, send: true });
  const added = clicks(null, [true, "512-555-0199"]);
  assert.deepEqual(pick(formConsent({ initial: null, phone: "512-555-0199", ticked: added })), { checked: true, send: true });
  // Ticked before the number was typed: it is for the number typed.
  for (const before of ["", "512"]) {
    assert.deepEqual(pick(formConsent({ initial: null, phone: "512-555-0199", ticked: clicks(null, [true, before]) })), { checked: true, send: true });
  }
  const agreed = { phone: "(512) 555-0199", sms_consent: true };
  // Editing other things, or the same number written another way: shown as saved, not sent.
  for (const phone of ["(512) 555-0199", "512.555.0199", "+1 512 555 0199"]) {
    assert.deepEqual(pick(formConsent({ initial: agreed, phone, ticked: null })), { checked: true, send: false }, phone);
  }
  // A new number, or the same digits in another country: unticked, and left to the server,
  // which takes the old consent back.
  for (const phone of ["512-555-0177", "+512 555 0199"]) {
    const moved = formConsent({ initial: agreed, phone, ticked: null });
    assert.deepEqual(pick(moved), { checked: false, send: false }, phone);
    assert.equal(moved.newNumber && moved.agreedBefore && !moved.clicked, true);
  }
  // Ticked again for the new number: that is the business's choice, and it is sent.
  const regiven = clicks(agreed, [true, "512-555-0177"]);
  assert.deepEqual(pick(formConsent({ initial: agreed, phone: "512-555-0177", ticked: regiven })), { checked: true, send: true });
  // Unticked on purpose: sent, so consent is taken back.
  const unticked = clicks(agreed, [false, "(512) 555-0199"]);
  assert.deepEqual(pick(formConsent({ initial: agreed, phone: "(512) 555-0199", ticked: unticked })), { checked: false, send: true });
});

test("clicks count only for the number they were made for, and only when they changed something", () => {
  const agreed = { phone: "(512) 555-0199", sms_consent: true };
  // Clicked twice (off, then on) for the old number, then the number changed: nothing changed
  // for the new one, so the box unticks and nothing is sent.
  const twice = clicks(agreed, [false, "(512) 555-0199"], [true, "(512) 555-0199"]);
  const stale = formConsent({ initial: agreed, phone: "512-555-0177", ticked: twice });
  assert.deepEqual(pick(stale), { checked: false, send: false });
  assert.equal(stale.clicked, false);
  // The same two clicks while the number was half typed, then the saved number typed back:
  // nothing changed, so consent stays as it was and nothing is sent.
  const partial = clicks(agreed, [true, "512-555-019"], [false, "512-555-019"]);
  assert.deepEqual(pick(formConsent({ initial: agreed, phone: "(512) 555-0199", ticked: partial })), { checked: true, send: false });
  // Ticked for one new number, then corrected to another: needs ticking again, and says so.
  const corrected = formConsent({ initial: agreed, phone: "512-555-0166", ticked: clicks(agreed, [true, "512-555-0177"]) });
  assert.deepEqual(pick(corrected), { checked: false, send: false });
  assert.equal(corrected.tickedForOther, "512-555-0177");
  const plain = { phone: "(512) 555-0198", sms_consent: false };
  const typo = formConsent({ initial: plain, phone: "512-555-0128", ticked: clicks(plain, [true, "512-555-0127"]) });
  assert.equal(typo.checked, false);
  assert.equal(typo.tickedForOther, "512-555-0127");
  // A click that leaves the box as it was is not sent: a page left open while someone else
  // took consent back does not give it again.
  assert.deepEqual(pick(formConsent({ initial: agreed, phone: "(512) 555-0199", ticked: twice })), { checked: true, send: false });
  assert.deepEqual(pick(formConsent({ initial: plain, phone: "(512) 555-0198", ticked: clicks(plain, [true, "(512) 555-0198"], [false, "(512) 555-0198"]) })), {
    checked: false,
    send: false,
  });
  assert.deepEqual(pick(formConsent({ initial: plain, phone: "(512) 555-0198", ticked: clicks(plain, [true, "(512) 555-0198"]) })), {
    checked: true,
    send: true,
  });
});

test("a request's line about texts says whose consent its texts go by", () => {
  assert.equal(requestConsentLine({ sms_consent: true, sms_state: "ok" }), "Agreed to job texts on the request form.");
  assert.equal(requestConsentLine({ sms_consent: false, sms_state: "no_consent" }), "Has not agreed to job texts.");
  // The business has a no on record for that number: the customer's tick does not count.
  assert.equal(requestConsentLine({ sms_consent: true, sms_state: "no_phone" }), "Agreed on the request form, but this number cannot get texts.");
  for (const state of ["opted_out", "no_consent"]) {
    assert.match(requestConsentLine({ sms_consent: true, sms_state: state }), /^Agreed on the request form, but .* so no texts go\.$/);
  }
  const client = { phone: "512-555-0106", sms_consent: true, sms_opt_out: false };
  assert.equal(requestConsentLine({ sms_consent: false, client }), "Texts go by their client page: agreed to job texts at 512-555-0106.");
  assert.equal(requestConsentLine({ sms_consent: true, client: { ...client, sms_consent: false } }), "Texts go by their client page: they have not agreed to job texts.");
  assert.equal(requestConsentLine({ sms_consent: true, client: { ...client, sms_opt_out: true } }), "Texts go by their client page: they are marked not to be texted.");
  for (const linked of [{ sms_state: "no_phone", client }, { client: { ...client, phone: "555-0106" } }]) {
    assert.equal(requestConsentLine(linked), "Texts go by their client page: they agreed, but their number cannot get texts.");
  }
});

test("the box goes in the client form's body only when it is to be sent", () => {
  assert.deepEqual(consentField({ checked: true, send: true }), { sms_consent: true });
  assert.deepEqual(consentField({ checked: false, send: true }), { sms_consent: false });
  assert.deepEqual(consentField({ checked: true, send: false }), {});
  assert.deepEqual(consentField({ checked: false, send: false }), {});
});

function pick({ checked, send }) {
  return { checked, send };
}

test("texts only for someone with a phone who agreed and did not ask to stop", () => {
  assert.equal(mayText({ phone: "512-555-0199", sms_consent: true }), true);
  assert.equal(mayText({ phone: "512-555-0199", sms_consent: true, sms_opt_out: true }), false);
  assert.equal(mayText({ phone: "512-555-0199", sms_consent: false }), false);
  assert.equal(mayText({ phone: "", sms_consent: true }), false);
  assert.equal(mayText({ phone: "555-0142", sms_consent: true, cannot_text: true }), false);
  // A number the server cannot text, read the way it reads one: not offered.
  assert.equal(mayText({ phone: "555-0142", sms_consent: true }), false);
  assert.equal(mayText({ phone: "+1 512 555 0199", sms_consent: true }), true);
  assert.equal(mayText(null), false);
});

test("after a save works, the box starts from what was saved, and a click made meanwhile is kept", () => {
  const sent = { checked: true, phone: "512-555-0199", from: false };
  assert.equal(afterSave(sent, sent), null);
  // Unticked again while it saved: counted from what the save left (ticked), so it is sent next.
  const meanwhile = nextClick(sent, { checked: false, phone: "512-555-0199", shown: true });
  const kept = afterSave(meanwhile, sent);
  assert.deepEqual(kept, { checked: false, phone: "512-555-0199", from: true });
  const agreed = { phone: "512-555-0199", sms_consent: true };
  assert.deepEqual(pick(formConsent({ initial: agreed, phone: "512-555-0199", ticked: kept })), { checked: false, send: true });
  // A click for another number, or with nothing sent, is kept as it was.
  const other = { checked: true, phone: "512-555-0177", from: false };
  assert.equal(afterSave(other, sent), other);
  assert.equal(afterSave(meanwhile, null), meanwhile);
  assert.equal(afterSave(null, sent), null);
});
