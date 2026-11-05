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

// The Stripe test dashboard page for a payment, so a flagged one can be refunded.
export function stripePaymentUrl(paymentIntentId) {
  return `https://dashboard.stripe.com/test/payments/${encodeURIComponent(paymentIntentId)}`;
}
