import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  needsServerMode,
  opensInStripe,
  paymentLive,
  stripeLiveFrom,
  stripePaymentUrl,
} from "../src/utils/invoices.js";
import { code } from "./ssr.js";

// Links from an invoice's payments into the Stripe Dashboard (utils/invoices.js): each
// payment opens in the dashboard of the mode it was taken in, when its own ids say so, and
// otherwise in the test dashboard only when the server says Stripe is in test mode.

const LIVE = "https://dashboard.stripe.com/payments/pi_123";
const TEST = "https://dashboard.stripe.com/test/payments/pi_123";
const SERVER_MODES = [true, false, null, undefined];

// An online card payment as GET /api/invoices/<id> lists it (dump_payment in the API).
function card(ids = {}) {
  return { provider: "stripe", method: "card", payment_intent_id: "pi_123", checkout_session_id: null, ...ids };
}

test("a payment whose ids say its mode opens in that dashboard, whatever the server's mode", () => {
  for (const server of SERVER_MODES) {
    const why = `server live: ${server}`;
    // Checkout Session ids carry the mode: every online payment has one.
    assert.equal(stripePaymentUrl(card({ checkout_session_id: "cs_test_a1B2c3" }), server), TEST, why);
    assert.equal(stripePaymentUrl(card({ checkout_session_id: "cs_live_a1B2c3" }), server), LIVE, why);
    // So does any other id written that way, such as a pi_test_ id with no session.
    assert.equal(
      stripePaymentUrl(card({ payment_intent_id: "pi_test_123" }), server),
      "https://dashboard.stripe.com/test/payments/pi_test_123",
      why,
    );
    assert.equal(
      stripePaymentUrl(card({ payment_intent_id: "pi_live_123" }), server),
      "https://dashboard.stripe.com/payments/pi_live_123",
      why,
    );
  }
});

test("when a payment's ids do not say, the server's mode decides, as before", () => {
  const unsaid = [
    card(), // a plain PaymentIntent id and no session id
    card({ checkout_session_id: "" }),
    card({ checkout_session_id: "cs_a1B2c3" }), // a session id with no mode in it
    card({ checkout_session_id: "cs_mock_1" }), // mock ids are neither test nor live
    card({ payment_intent_id: "pi_3TestLive9" }), // random letters that only spell a mode
  ];
  for (const payment of unsaid) {
    const id = payment.payment_intent_id;
    const why = JSON.stringify(payment);
    assert.equal(stripePaymentUrl(payment, false), `https://dashboard.stripe.com/test/payments/${id}`, why);
    assert.equal(stripePaymentUrl(payment, true), `https://dashboard.stripe.com/payments/${id}`, why);
    // No mode known (no answer yet, or none): the live dashboard.
    assert.equal(stripePaymentUrl(payment, null), `https://dashboard.stripe.com/payments/${id}`, why);
    assert.equal(stripePaymentUrl(payment), `https://dashboard.stripe.com/payments/${id}`, why);
    // Only a real false is test mode, not anything that merely looks false.
    for (const notSaid of [0, "", "false"]) {
      assert.equal(stripePaymentUrl(payment, notSaid), `https://dashboard.stripe.com/payments/${id}`, why);
    }
  }
  // The link is always the PaymentIntent's page, and its id stays one part of the address.
  assert.equal(
    stripePaymentUrl(card({ payment_intent_id: "pi_1/../x?y#z" }), false),
    "https://dashboard.stripe.com/test/payments/pi_1%2F..%2Fx%3Fy%23z",
  );
});

test("a payment's own ids say its mode: the Checkout Session first, then the PaymentIntent", () => {
  assert.equal(paymentLive(card({ checkout_session_id: "cs_test_1" })), false);
  assert.equal(paymentLive(card({ checkout_session_id: "cs_live_1" })), true);
  assert.equal(paymentLive(card({ payment_intent_id: "pi_test_1" })), false);
  assert.equal(paymentLive(card({ payment_intent_id: "pi_live_1" })), true);
  // Should the two ever disagree, the session decides.
  assert.equal(paymentLive(card({ checkout_session_id: "cs_live_1", payment_intent_id: "pi_test_1" })), true);
  assert.equal(paymentLive(card({ checkout_session_id: "cs_test_1", payment_intent_id: "pi_live_1" })), false);
  assert.equal(paymentLive(card({ checkout_session_id: "cs_a1", payment_intent_id: "pi_test_1" })), false);
  // Nothing said: no mode, the word alone is not enough, and a missing id is no id.
  assert.equal(paymentLive(card()), null);
  assert.equal(paymentLive(card({ checkout_session_id: "cs_testing_1" })), null);
  assert.equal(paymentLive(card({ payment_intent_id: "pi_testAbc123" })), null);
  assert.equal(paymentLive({ provider: "stripe" }), null);
});

test("only a Stripe payment whose ids do not say its mode needs the server's", () => {
  assert.equal(needsServerMode(card()), true);
  assert.equal(needsServerMode(card({ checkout_session_id: "cs_a1" })), true);
  assert.equal(needsServerMode(card({ checkout_session_id: "cs_test_1" })), false);
  assert.equal(needsServerMode(card({ checkout_session_id: "cs_live_1" })), false);
  assert.equal(needsServerMode(card({ payment_intent_id: null })), false);
  assert.equal(needsServerMode({ provider: "mock", payment_intent_id: "pi_mock_1", checkout_session_id: "cs_mock_1" }), false);
  assert.equal(needsServerMode({ provider: "manual", payment_intent_id: null, checkout_session_id: null }), false);
});

test("the server's mode is read as Settings reads it: only while Stripe is configured", () => {
  // GET /api/business/stripe's answers in each mode (server/tests/test_stripe_routes.py).
  const testMode = { configured: true, mode: "test", live: false };
  const mock = { configured: true, mode: "mock", live: false };
  const live = { configured: true, mode: "live", live: true };
  // Unset, or refused (say live mode set with a test key): Settings shows "Stripe not configured".
  const notConfigured = { configured: false, mode: null, live: false };
  assert.equal(stripeLiveFrom(testMode), false);
  assert.equal(stripeLiveFrom(mock), false);
  assert.equal(stripeLiveFrom(live), true);
  assert.equal(stripeLiveFrom(notConfigured), null);
  // No answer yet, or one without the flag.
  assert.equal(stripeLiveFrom(null), null);
  assert.equal(stripeLiveFrom(undefined), null);
  assert.equal(stripeLiveFrom({ configured: true }), null);
  // The links that follow for a payment whose ids do not say: the test dashboard only for
  // test mode, never while Stripe is not configured.
  assert.equal(stripePaymentUrl(card(), stripeLiveFrom(testMode)), TEST);
  assert.equal(stripePaymentUrl(card(), stripeLiveFrom(live)), LIVE);
  assert.equal(stripePaymentUrl(card(), stripeLiveFrom(notConfigured)), LIVE);
});

test("only online Stripe payments with a PaymentIntent link to Stripe", () => {
  assert.equal(opensInStripe({ provider: "stripe", payment_intent_id: "pi_1" }), true);
  assert.equal(opensInStripe({ provider: "stripe", payment_intent_id: null }), false);
  assert.equal(opensInStripe({ provider: "stripe", payment_intent_id: "" }), false);
  assert.equal(opensInStripe({ provider: "mock", payment_intent_id: "pi_mock_1" }), false);
  assert.equal(opensInStripe({ provider: "manual", payment_intent_id: null }), false);
});

test("every link into the Stripe Dashboard carries its payment and the server's mode", () => {
  const src = fileURLToPath(new URL("../src/", import.meta.url));
  const files = readdirSync(src, { recursive: true })
    .filter((file) => /\.(js|jsx)$/.test(file))
    .map((file) => file.replaceAll("\\", "/"));
  // Whole files, comments and all, so nothing can hide in what looks like a comment.
  const having = (pattern) => files.filter((file) => pattern.test(readFileSync(join(src, file), "utf8"))).sort();
  // The dashboard's address is written in one place, so no page links to a fixed mode...
  assert.deepEqual(having(/dashboard\.stripe\.com/), ["utils/invoices.js"]);
  // ...the one page that links there passes the payment and the server's mode on every link...
  assert.deepEqual(having(/stripePaymentUrl\(/), ["pages/InvoiceDetail.jsx", "utils/invoices.js"]);
  const page = code("src/pages/InvoiceDetail.jsx");
  const calls = page.match(/stripePaymentUrl\([^)]*\)/g) ?? [];
  assert.ok(calls.length > 0, "no links found");
  for (const call of calls) assert.equal(call, "stripePaymentUrl(payment, stripeLive)");
  // ...and hands the mode down to every part of the page that draws one.
  for (const name of ["AttentionAlert", "PaymentsCard", "InvoiceSummary"]) {
    const uses = page.split(`<${name}`).slice(1);
    assert.ok(uses.length, name);
    for (const use of uses) assert.match(use.slice(0, use.indexOf("/>")), /\bstripeLive=\{stripeLive\}/, name);
  }
  // The server's mode is asked for only when a payment's ids do not say its own, from
  // GET /api/business/stripe, the answer Settings reads, read as it reads it.
  assert.match(page, /const stripeLive = useStripeLive\(Boolean\(invoice\?\.payments\?\.some\(needsServerMode\)\)\);/);
  const hook = code("src/hooks.js").match(/export function useStripeLive\b[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(hook, /useAsync\(enabled \? api : nothing, enabled \? "\/api\/business\/stripe" : ""\)/);
  assert.match(hook, /stripeLiveFrom\(data\)/);
  const settings = code("src/pages/SettingsPaymentsCard.jsx");
  assert.match(settings, /const PATH = "\/api\/business\/stripe";/);
  assert.match(settings, /stripe\.configured &&\s*\(stripe\.live \?/);
});
