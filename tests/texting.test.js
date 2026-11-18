import assert from "node:assert/strict";
import test from "node:test";
import { deliveryBadge, failureLine, textingAlert, weekSummary } from "../src/utils/texting.js";

// What the owner is told about texts (server/sms_status.py): next to each text, and when
// texts are not arriving.

test("a text's status shows as a badge, with the reason when it did not arrive", () => {
  assert.equal(deliveryBadge(null), null);
  assert.equal(deliveryBadge(undefined), null);
  assert.deepEqual(deliveryBadge({ state: "delivered", label: "Delivered", reason: null }), {
    label: "Delivered",
    tone: "success",
    reason: null,
  });
  const blocked = deliveryBadge({
    state: "failed",
    label: "Not delivered",
    error_code: 30034,
    reason: "Pending carrier approval: ... (Twilio error 30034)",
  });
  assert.equal(blocked.tone, "danger");
  assert.match(blocked.reason, /Pending carrier approval/);
  assert.equal(deliveryBadge({ state: "logged", label: "Not sent: texting is not set up" }).tone, "warning");
  assert.equal(deliveryBadge({ state: "sending", label: "Sending" }).tone, "neutral");
});

test("the alert says texting is pending carrier approval while texts are blocked", () => {
  const summary = {
    problem: {
      code: "carrier_approval",
      title: "Texting pending carrier approval",
      message: "US carriers block texts ... 2 texts to customers did not arrive in the last 7 days.",
      count: 2,
      error_code: 30034,
    },
  };
  assert.deepEqual(textingAlert(summary), {
    tone: "warning",
    title: "Texting pending carrier approval",
    message: summary.problem.message,
  });
  assert.equal(textingAlert({ problem: { ...summary.problem, code: "sender_setup", title: "Texting isn't set up correctly" } }).tone, "danger");
  // Carriers filtering texts (30007) is waiting on carriers too, not something broken here.
  assert.equal(textingAlert({ problem: { ...summary.problem, code: "carrier_filtered", title: "Carriers are filtering texts" } }).tone, "warning");
  assert.equal(textingAlert({ problem: null }), null);
  assert.equal(textingAlert(null), null);
});

test("texting that is not set up is only raised once texts were held back, or where asked", () => {
  const idle = { problem: { code: "not_set_up", title: "Texting isn't on yet", message: "...", count: 0 } };
  assert.equal(textingAlert(idle), null);
  assert.equal(textingAlert(idle, { always: true }).title, "Texting isn't on yet");
  assert.equal(textingAlert({ problem: { ...idle.problem, count: 3 } }).tone, "danger");
});

test("a text that did not arrive reads as one line: what it was, to whom, and why", () => {
  assert.equal(
    failureLine({ kind: "visit_confirmation", sent_to: "•••0133", short: "Pending carrier approval (30034)" }),
    "Visit confirmation to •••0133: Pending carrier approval (30034)",
  );
  assert.equal(failureLine({ kind: "opt_in_confirmation", sent_to: "•••0133", short: "They texted STOP (21610)" }), "Opt-in confirmation to •••0133: They texted STOP (21610)");
  assert.equal(failureLine({ kind: "text", sent_to: "•••0100" }), "Text to •••0100: Not delivered");
});

test("the week reads as one sentence", () => {
  assert.equal(weekSummary(null), "");
  assert.equal(weekSummary({ delivered: 0, sent: 0, sending: 0, failed: 0, not_sent: 0, logged: 0 }), "No texts in the last 7 days.");
  assert.equal(
    weekSummary({ delivered: 3, sent: 0, sending: 1, failed: 2, not_sent: 0, logged: 0 }),
    "6 texts in the last 7 days: 3 delivered, 1 sending, 2 not delivered.",
  );
  assert.equal(weekSummary({ delivered: 1, sent: 0, sending: 0, failed: 0, not_sent: 0, logged: 0 }), "1 text in the last 7 days: 1 delivered.");
});
