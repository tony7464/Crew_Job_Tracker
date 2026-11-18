import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement as h } from "react";
import { part, phoneThenConsent, startVite, words } from "./ssr.js";

// Terms, Privacy, and SMS consent are what carriers read when business texting is registered
// (A2P 10DLC), so anyone must be able to open them. These tests draw the real app at those
// addresses with nobody logged in, as a reviewer's browser would.

// Word for word: carriers compare these with what is registered.
const CONSENT =
  "By checking this box, I agree to receive job updates by text from [Business] via Crew Job Tracker, including appointment confirmations, reminders, on-the-way notices, and quote and invoice links. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";
const CONFIRMATION =
  "Crew Job Tracker: You're subscribed to job updates from [Business]. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.";
const NO_SHARING = "We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes.";

let app;
let App;

before(async () => {
  app = await startVite();
  ({ default: App } = await app.load("/src/App.jsx"));
});

after(async () => {
  await app?.close();
});

// Nobody logged in, and a first visit whose session check has not answered yet.
const LOGGED_OUT = { user: null, loading: false };
const CHECKING = { user: null, loading: true };

// The app's HTML at this address.
const render = (path, auth = LOGGED_OUT) => app.render(h(App), { path, auth });

const heading = (html) => words(part(html, "h1"));

test("Terms, Privacy, and SMS consent open for someone who is not logged in", async () => {
  const pages = [
    ["/terms", "Terms of Service"],
    ["/privacy", "Privacy Policy"],
    ["/sms-consent", "SMS Consent"],
  ];
  for (const auth of [LOGGED_OUT, CHECKING]) {
    for (const [path, title] of pages) {
      const html = await render(path, auth);
      const when = auth.loading ? "while the session check runs" : "logged out";
      assert.equal(heading(html), title, `${path}, ${when}`);
      assert.match(part(html, "footer"), /href="\/sms-consent"/, `${path}, ${when}: footer`);
    }
  }
});

test("the home and pricing pages link to SMS consent in their footer", async () => {
  for (const path of ["/", "/pricing"]) {
    assert.match(part(await render(path), "footer"), /href="\/sms-consent"/, path);
  }
});

test("a page behind the login shows nothing to someone logged out", async () => {
  // The same harness, to show it can tell: these go to the login page instead.
  for (const path of ["/dashboard", "/admin"]) {
    const html = await render(path);
    assert.equal(part(html, "h1"), "", path);
    assert.equal(part(html, "footer"), "", path);
  }
});

test("the SMS Terms cover everything carriers look for", async () => {
  const html = await render("/terms");
  const sms = part(html, "section", "SMS Terms");
  assert.match(sms, /<h2[^>]*>SMS Terms<\/h2>/);
  const text = words(sms);
  for (const phrase of [
    "Crew Job Tracker",
    "transactional job texts only",
    "appointment confirmations and reminders",
    "on-the-way notices",
    "schedule changes",
    "quote and invoice links",
    "on behalf of the service business",
    "Message frequency varies.",
    "Message and data rates may apply.",
    "Reply STOP to opt out at any time. Reply HELP for help.",
    "Consent to receive texts is not required to get service.",
    "Carriers are not liable for delayed or undelivered messages.",
  ]) {
    assert.ok(text.includes(phrase), phrase);
  }
  assert.match(sms, /href="\/privacy"/);
});

test("the Privacy Policy names Crew Job Tracker and says opt-in data is not shared for marketing", async () => {
  const main = words(part(await render("/privacy"), "main"));
  assert.ok(main.includes("Crew Job Tracker"));
  assert.ok(main.includes(NO_SHARING));
  // The texting section is still there, as it was.
  assert.ok(main.includes("Customer phone numbers and texts"));
  assert.ok(
    main.includes("Mobile numbers and texting consent are never shared with or sold to third parties or affiliates for marketing or promotional purposes."),
  );
});

test("the SMS consent page shows an optional, unchecked opt-in and the confirmation text", async () => {
  const html = await render("/sms-consent");
  const form = part(html, "form");
  assert.match(form, /<input[^>]*type="tel"/);
  const boxes = form.match(/<input[^>]*type="checkbox"[^>]*>/g) || [];
  assert.equal(boxes.length, 1);
  // Never ticked for the customer, and the form goes without it.
  assert.doesNotMatch(boxes[0], /\schecked/);
  assert.doesNotMatch(boxes[0], /\srequired/);
  // Its words are its label, so tapping them ticks it.
  const label = part(form, "label", "By checking this box");
  assert.match(label, /type="checkbox"/);
  assert.equal(words(label), CONSENT);
  assert.match(form, /href="\/privacy"/);
  assert.match(form, /href="\/terms"/);
  // The phone field sits right above the box, on the same form.
  const placed = phoneThenConsent(form);
  assert.ok(placed.ok, placed.why);

  const main = words(part(html, "main"));
  assert.ok(main.includes(CONFIRMATION));
  assert.ok(main.indexOf(CONFIRMATION) > main.indexOf(CONSENT), "the confirmation text comes after the form");
  assert.match(main, /optional/);
  assert.match(main, /never used for marketing/);
});
