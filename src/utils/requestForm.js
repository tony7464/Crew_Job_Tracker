// The public request form's values, its checks, and what it sends (pages/PublicRequestPage.jsx).
import { emailLooksValid, phoneLooksValid } from "./requests";

export const EMPTY_REQUEST = {
  name: "",
  phone: "",
  email: "",
  address: "",
  service_type: "",
  preferred_text: "",
  notes: "",
  website: "",
  // The box for consent to job texts: unticked until the customer ticks it, and never needed to send.
  sms_consent: false,
};

// A field's new value from its change event: a box's ticked state, or what was typed.
export function fieldValue(event) {
  return event.target.type === "checkbox" ? event.target.checked : event.target.value;
}

// Checks done in the browser before sending. The server repeats every one. Consent to texts
// is not among them: the form goes without it.
export function validateRequest(values, windows) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!values.address.trim()) errors.address = "Enter the address for the job.";
  if (!values.service_type) errors.service_type = "Pick a service.";
  const phone = values.phone.trim();
  const email = values.email.trim();
  if (!phone && !email) errors.contact = "Enter a phone number or an email address so we can reach you.";
  if (phone && !phoneLooksValid(phone)) errors.phone = "Enter a phone number with 7 to 15 digits, like 555-123-4567.";
  if (email && !emailLooksValid(email)) errors.email = "Enter an email address like name@example.com.";
  if (windows.some((row) => !row.date)) errors.preferred_windows = "Pick a date for each preferred time, or remove it.";
  return errors;
}

// What the form sends. sms_consent is exactly the box: ticked or not.
export function requestBody(values, { windows, photos, formToken }) {
  const trimmed = (value) => value.trim() || null;
  return {
    name: values.name.trim(),
    phone: trimmed(values.phone),
    sms_consent: values.sms_consent === true,
    email: trimmed(values.email),
    address: values.address.trim(),
    service_type: values.service_type,
    preferred_windows: windows.map(({ date, window }) => ({ date, window })),
    preferred_text: trimmed(values.preferred_text),
    notes: trimmed(values.notes),
    photos: photos.map((photo) => photo.dataUrl),
    website: values.website,
    form_token: formToken,
  };
}
