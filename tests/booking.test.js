import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startVite } from "./ssr.js";

// Who a new visit is booked for (pages/NewVisitPage.jsx), and whether the page asks for a text.

let app;
let bookingContact, bookingNotify;

before(async () => {
  // Vite loads it, as the app's files import each other without file endings.
  app = await startVite();
  ({ bookingContact, bookingNotify } = await app.load("/src/utils/booking.js"));
});

after(async () => {
  await app?.close();
});

const REQUEST = {
  id: 4, name: "Quinn Test", address: "1 Old Rd", phone: "512-555-0142", email: null,
  sms_consent: true, sms_state: "ok", client: null,
};

test("a request linked to a client books the client: their name, address, number, email and consent", () => {
  const client = {
    id: 2, name: "Quinn Rivera", address: "2 New Ave", phone: "512-555-0106", email: "q@example.com",
    sms_consent: true, sms_opt_out: false,
  };
  const who = bookingContact({ chosen: null, serviceRequest: { ...REQUEST, sms_consent: false, client }, customer: null });
  assert.deepEqual(
    [who.name, who.address, who.phone, who.email, who.sms_consent, who.sms_opt_out, who.request],
    ["Quinn Rivera", "2 New Ave", "512-555-0106", "q@example.com", true, false, true],
  );
  assert.equal(bookingNotify({ sms: true, email: true }, who).sms, true);
  // The client said no: no text, whatever the request's own tick.
  const no = bookingContact({ serviceRequest: { ...REQUEST, client: { ...client, sms_consent: false } } });
  assert.equal(bookingNotify({ sms: true, email: true }, no).sms, false);
});

test("a request with no client goes by the customer's tick, unless the business has a no for that number", () => {
  assert.equal(bookingNotify({ sms: true }, bookingContact({ serviceRequest: REQUEST })).sms, true);
  const revoked = bookingContact({ serviceRequest: { ...REQUEST, sms_state: "no_consent" } });
  assert.equal(revoked.sms_consent, false);
  assert.equal(bookingNotify({ sms: true }, revoked).sms, false);
  const marked = bookingContact({ serviceRequest: { ...REQUEST, sms_state: "opted_out" } });
  assert.equal(marked.sms_opt_out, true);
  assert.equal(bookingNotify({ sms: true }, marked).sms, false);
  // A number the form took that cannot get texts: no text offered, and that is the reason given.
  const short = bookingContact({ serviceRequest: { ...REQUEST, phone: "555-0142", sms_state: "no_phone" } });
  assert.equal(short.cannot_text, true);
  assert.equal(bookingNotify({ sms: true }, short).sms, false);
  const linked = bookingContact({
    serviceRequest: { ...REQUEST, sms_state: "no_phone", client: { name: "Q", phone: "555-0142", sms_consent: true, sms_opt_out: false } },
  });
  assert.equal(bookingNotify({ sms: true }, linked).sms, false);
});

test("a client picked on the page, or a new customer typed in, goes by their own details", () => {
  const chosen = { id: 9, name: "Pat", phone: "512-555-0199", sms_consent: false };
  const who = bookingContact({ chosen, serviceRequest: REQUEST, customer: null });
  assert.equal(who.existing, true);
  assert.equal(bookingNotify({ sms: true, email: false }, who).sms, false);
  const customer = { name: "Ana", phone: "512-555-0131", sms_consent: true };
  assert.deepEqual(bookingContact({ chosen: null, serviceRequest: null, customer }), { ...customer, cannot_text: false });
  // A number the server cannot text (seven digits): no text offered, whoever it is.
  const short = bookingContact({ customer: { ...customer, phone: "555-0131" } });
  assert.equal(short.cannot_text, true);
  assert.equal(bookingNotify({ sms: true }, short).sms, false);
  const shortClient = bookingContact({ chosen: { ...chosen, phone: "555-0199", sms_consent: true } });
  assert.equal(shortClient.cannot_text, true);
  assert.equal(bookingNotify({ sms: true }, shortClient).sms, false);
  assert.deepEqual(bookingNotify({ sms: true, email: false }, customer), { sms: true, email: false });
  // Never a text the screen says will not go, and never one that was not asked for.
  assert.equal(bookingNotify({ sms: false, email: true }, customer).sms, false);
  assert.equal(bookingNotify({ sms: true }, { ...customer, phone: "" }).sms, false);
});
