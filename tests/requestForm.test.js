import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startVite } from "./ssr.js";

// The public request form (pages/PublicRequestPage.jsx): the box for consent to job texts
// starts unticked, is never needed to send, and is sent exactly as the customer left it.

let app;
let EMPTY_REQUEST, fieldValue, requestBody, validateRequest, FILLED;
const SENT = { windows: [], photos: [], formToken: "token" };

before(async () => {
  // Vite loads it, as the app's files import each other without file endings.
  app = await startVite();
  ({ EMPTY_REQUEST, fieldValue, requestBody, validateRequest } = await app.load("/src/utils/requestForm.js"));
  FILLED = { ...EMPTY_REQUEST, name: "Quinn Lee", phone: "512-555-0142", address: "2 Side St", service_type: "Gutters" };
});

after(async () => {
  await app?.close();
});

test("the box starts unticked", () => {
  assert.equal(EMPTY_REQUEST.sms_consent, false);
});

test("the form goes without agreeing to texts", () => {
  assert.deepEqual(validateRequest(FILLED, []), {});
  assert.deepEqual(validateRequest({ ...FILLED, sms_consent: true }, []), {});
  // Ticked with no phone: still nothing in the way (there is just no number to text).
  assert.deepEqual(validateRequest({ ...FILLED, phone: "", email: "q@example.com", sms_consent: true }, []), {});
  // The other checks still work.
  assert.equal(Object.keys(validateRequest(EMPTY_REQUEST, [])).sort().join(), "address,contact,name,service_type");
});

test("the box is sent as the customer left it", () => {
  assert.equal(requestBody(FILLED, SENT).sms_consent, false);
  assert.equal(requestBody({ ...FILLED, sms_consent: true }, SENT).sms_consent, true);
  assert.deepEqual(
    Object.keys(requestBody(FILLED, SENT)).sort(),
    ["address", "email", "form_token", "name", "notes", "phone", "photos", "preferred_text", "preferred_windows", "service_type", "sms_consent", "website"],
  );
  assert.equal(requestBody({ ...FILLED, phone: "  " }, SENT).phone, null);
});

test("a box's change gives its ticked state, a field's what was typed", () => {
  assert.equal(fieldValue({ target: { type: "checkbox", checked: true, value: "on" } }), true);
  assert.equal(fieldValue({ target: { type: "checkbox", checked: false, value: "on" } }), false);
  assert.equal(fieldValue({ target: { type: "tel", value: "512" } }), "512");
});
