// Invoice helpers. Totals use the same math as quotes (see utils/quotes.js).

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"];

// Stripe's smallest card charge; the server refuses to send a smaller invoice.
export const MIN_INVOICE_CENTS = 50;

export const MANUAL_METHODS = [
  ["cash", "Cash"],
  ["check", "Check"],
  ["other", "Other"],
];
export const MAX_PAYMENT_NOTE = 300;

export const PROVIDER_LABELS = {
  stripe: "Paid online (Stripe)",
  mock: "Paid online (test mode, mock)",
  manual: "Recorded by hand",
};

export function invoicePath(id, action = "") {
  return `/api/invoices/${id}${action}`;
}

export function publicInvoicePath(token, action = "") {
  return `/api/public/invoices/${encodeURIComponent(token)}${action}`;
}

// Whether a payment has a page in the Stripe Dashboard: an online Stripe payment with its
// PaymentIntent id. Mock and hand-recorded payments do not.
export function opensInStripe(payment) {
  return payment.provider === "stripe" && Boolean(payment.payment_intent_id);
}

// The Stripe mode a payment's own ids say it was taken in: true for live, false for test,
// null when none says. Stripe writes the mode into some ids, right after the prefix:
// Checkout Session ids start cs_test_ or cs_live_ (any other id written that way counts
// too, such as pi_test_). A PaymentIntent id is pi_ and random letters, so it says
// nothing, and no payment stores its mode otherwise.
export function paymentLive(payment) {
  for (const id of [payment.checkout_session_id, payment.payment_intent_id]) {
    const mode = /^[a-z]+_(test|live)_/.exec(id ?? "")?.[1];
    if (mode) return mode === "live";
  }
  return null;
}

// Whether a payment's Stripe link needs the server's mode: a Stripe payment whose own ids
// do not say which mode it was taken in.
export function needsServerMode(payment) {
  return opensInStripe(payment) && paymentLive(payment) === null;
}

// The server's Stripe mode from its GET /api/business/stripe answer, read the way Settings
// reads it: the live flag counts only while Stripe is configured, when Settings shows Live,
// Test mode, or Mock mode. true or false then. null with no answer, or while Stripe is not
// configured (unset, or refused, say live mode set with a test key): no mode is in use.
export function stripeLiveFrom(status) {
  return status?.configured ? (status.live ?? null) : null;
}

// The Stripe Dashboard page for a payment, so a flagged one can be refunded: in the test
// dashboard when the payment was taken in test mode, the live one for a live payment. The
// payment's own ids decide (paymentLive). When they do not say, serverLive does: the
// server's Stripe mode (stripeLiveFrom, through useStripeLive in hooks.js), where only
// false, the server saying test mode, gives the test dashboard; true, or no mode known,
// the live one.
export function stripePaymentUrl(payment, serverLive) {
  const live = paymentLive(payment) ?? serverLive;
  const mode = live === false ? "test/" : "";
  return `https://dashboard.stripe.com/${mode}payments/${encodeURIComponent(payment.payment_intent_id)}`;
}
