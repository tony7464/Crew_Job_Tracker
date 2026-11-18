import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { code, elements, part, phoneThenConsent, startVite, words } from "./ssr.js";

// Every form that takes a customer's phone number has the texting consent box right under
// it: unticked to start, never required, and the same words, with the business's name.

const CONSENT =
  "By checking this box, I agree to receive job updates by text from Boss Gutters via Crew Job Tracker, including appointment confirmations, reminders, on-the-way notices, and quote and invoice links. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";
const OWNER = {
  id: 1,
  role: "owner",
  username: "boss",
  first_name: "Boss",
  last_name: "Owner",
  name: "Boss Owner",
  email: "boss@example.com",
  email_verified: true,
  business_name: "Boss Gutters",
  business_email_verified: true,
  timezone: "America/Chicago",
  visit_confirmations: true,
  companies: [],
};
const SIGNED_IN = { user: OWNER, loading: false };

let app;
let App;
let ClientForm;

before(async () => {
  app = await startVite();
  ({ default: App } = await app.load("/src/App.jsx"));
  ({ default: ClientForm } = await app.load("/src/components/ClientForm.jsx"));
});

after(async () => {
  await app?.close();
});

// The consent box in some HTML: right under the phone field, and its label's words.
function consentBox(html) {
  const placed = phoneThenConsent(html);
  assert.ok(placed.ok, placed.why);
  const label = part(html, "label", "By checking this box");
  assert.match(label, /type="checkbox"/);
  return { box: placed.box, words: words(label) };
}

test("adding a client: the box is under the phone number, unticked and optional", async () => {
  const html = await app.render(h(ClientForm, { onSubmit() {}, submitLabel: "Add client" }), { auth: SIGNED_IN });
  const consent = consentBox(html);
  assert.equal(consent.words, CONSENT);
  assert.doesNotMatch(consent.box, /\schecked/);
  assert.doesNotMatch(consent.box, /\srequired/);
  // The old "Do not text" box is gone: unticking consent is how texts stop.
  assert.doesNotMatch(html, /Do not text/);
});

test("editing a client shows their consent as it stands", async () => {
  const agreed = {
    id: 7, name: "Pat", phone: "512-555-0199", sms_consent: true,
    sms_consent_at: "2026-11-16T12:00:00+00:00", sms_consent_source: "intake_form",
  };
  const html = await app.render(h(ClientForm, { initial: agreed, onSubmit() {}, submitLabel: "Save changes" }), { auth: SIGNED_IN });
  assert.match(consentBox(html).box, /\schecked/);
  assert.match(words(html), /Agreed to job texts on Nov 16, 2026, on your request form\./);

  const plain = { id: 8, name: "Lee", phone: "512-555-0198", sms_consent: false };
  const unticked = await app.render(h(ClientForm, { initial: plain, onSubmit() {}, submitLabel: "Save changes" }), { auth: SIGNED_IN });
  assert.doesNotMatch(consentBox(unticked).box, /\schecked/);
});

test("the public request form: the box is under the phone number, unticked, optional, with the policies beside it", async () => {
  const { default: RequestContactFields } = await app.load("/src/components/RequestContactFields.jsx");
  const handler = () => () => {};
  const html = await app.render(
    h(RequestContactFields, {
      businessName: "Boss Gutters",
      values: { phone: "", email: "", sms_consent: false },
      errors: {},
      onChange: handler,
      onBlur: handler,
    }),
  );
  const consent = consentBox(html);
  assert.equal(consent.words, CONSENT);
  assert.doesNotMatch(consent.box, /\schecked|\srequired/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(words(html), /Optional\. You can get service without agreeing to texts\./);
});

test("the public request form: ticking the box sets it, and the page sends it as it is", async () => {
  const { default: RequestContactFields } = await app.load("/src/components/RequestContactFields.jsx");
  const { fieldValue } = await app.load("/src/utils/requestForm.js");
  const changed = [];
  const tree = RequestContactFields({
    businessName: "Boss Gutters",
    values: { phone: "512-555-0142", email: "", sms_consent: false },
    errors: {},
    onChange: (name) => (event) => changed.push([name, fieldValue(event)]),
    onBlur: () => () => {},
  });
  const box = elements(tree).find((element) => element.type?.name === "SmsConsentCheckbox");
  assert.equal(box.props.businessName, "Boss Gutters");
  assert.equal(box.props.checked, false);
  box.props.onChange({ target: { type: "checkbox", checked: true, value: "on" } });
  assert.deepEqual(changed, [["sms_consent", true]]);

  // The page (which loads its form over the network, so it is not drawn here) gives these
  // fields the business's name and its own setter, starts unticked, and sends the box as it is.
  const page = code("src/pages/PublicRequestPage.jsx");
  const fields = page.match(/<RequestContactFields\b[^>]*\/>/)?.[0] ?? "";
  assert.match(fields, /businessName=\{form\.business_name\}/);
  assert.match(fields, /onChange=\{setValue\}/);
  assert.match(page, /useState\(EMPTY_REQUEST\)/);
  assert.match(page, /body: requestBody\(values,/);
  assert.match(page, /const value = fieldValue\(event\);/);
  assert.doesNotMatch(page, /sms_consent/);
});

test("the client form sends the box only through formConsent", () => {
  const form = code("src/components/ClientForm.jsx");
  assert.match(form, /\.\.\.consentField\(box\)/);
  assert.match(form, /checked=\{box\.checked\}/);
  assert.match(form, /const click = \{ checked: event\.target\.checked, phone, shown: box\.checked \};/);
  assert.match(form, /setTicked\(\(last\) => nextClick\(last, click\)\)/);
  // Once a save works, the box starts again from what was saved (a click made while saving stays).
  assert.match(form, /saving\.current = ticked;/);
  assert.match(form, /const sent = saving\.current;/);
  assert.match(form, /setTicked\(\(last\) => afterSave\(last, sent\)\)/);
  assert.doesNotMatch(form, /sms_consent/);
});

test("booking a visit for a new customer: the box is under the phone number, unticked", async () => {
  const html = await app.render(h(App), { path: "/visits/new", auth: SIGNED_IN });
  const consent = consentBox(part(html, "form", "Who is the customer?"));
  assert.equal(consent.words, CONSENT);
  assert.doesNotMatch(consent.box, /\schecked|\srequired/);
});

test("no other checkbox, at sign-up or anywhere, carries consent to texts", async () => {
  // Sign-up has no box that agrees to anything.
  const signup = await app.render(h(App), { path: "/signup" });
  assert.doesNotMatch(signup, /type="checkbox"/);
  // The consent words live in one place, and only the consent box shows them.
  const src = fileURLToPath(new URL("../src/", import.meta.url));
  const holders = readdirSync(src, { recursive: true })
    .filter((file) => /\.(js|jsx)$/.test(file))
    .filter((file) => readFileSync(`${src}${file}`, "utf8").includes("I agree to receive"));
  assert.deepEqual(holders.map((file) => file.replaceAll("\\", "/")), ["utils/smsConsent.js"]);
  const users = readdirSync(src, { recursive: true })
    .filter((file) => /\.(js|jsx)$/.test(file))
    .filter((file) => /smsConsentText\(/.test(readFileSync(`${src}${file}`, "utf8")))
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(users, ["components/SmsConsentCheckbox.jsx", "utils/smsConsent.js"]);
  // Every form with the box draws it through that one component.
  const boxes = readdirSync(src, { recursive: true })
    .filter((file) => /\.jsx$/.test(file))
    .filter((file) => /<SmsConsentCheckbox\b/.test(readFileSync(`${src}${file}`, "utf8")))
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(boxes, [
    "components/ClientForm.jsx",
    "components/RequestContactFields.jsx",
    "pages/NewVisitPage.jsx",
    "pages/landing/SmsConsentPage.jsx",
  ]);
});
