import { useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import { useSubmit } from "../hooks";
import { afterSave, consentField, consentSummary, formConsent, nextClick } from "../utils/smsConsent";
import ErrorMessage from "./ErrorMessage";
import { FormActions, Input, TextArea } from "./Field";
import SmsConsentCheckbox from "./SmsConsentCheckbox";
import { Button } from "./ui/Button";

// Adding or editing a client. The box for consent to job texts sits right under the phone
// number: the business reads the words to the customer and ticks it only if they agree, and
// unticks it to take consent back. Texts go only to clients with it; email is not affected.
//
// Consent is for one number, so a new number starts unticked, and a click on the box counts
// only for the number it was made for. When editing, the box is sent only when it differs
// from how it started (utils/smsConsent.js formConsent). Once a save works, the box starts
// again from what was saved.
export default function ClientForm({ initial, onSubmit, submitLabel, onCancel }) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(initial?.phone ?? "");
  // null until the box is clicked: then the business's choice, and the number it was for.
  const [ticked, setTicked] = useState(null);
  const box = formConsent({ initial, phone, ticked });
  // The clicks on the box that the save in progress was sent with.
  const saving = useRef(null);
  const { error, submitting, handleSubmit } = useSubmit(async (body) => {
    const sent = saving.current;
    await onSubmit(body);
    // Saved: the box starts from what was saved. A click made while it saved is kept.
    setTicked((last) => afterSave(last, sent));
  }, !initial);

  function onSubmitForm(event) {
    saving.current = ticked;
    const form = new FormData(event.target);
    const body = {
      name: form.get("name"),
      address: form.get("address") || null,
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      notes: form.get("notes") || null,
      ...consentField(box),
    };
    // Adding closes the form when it works, so nothing here needs clearing.
    handleSubmit(event, body);
  }

  const consentHint = [
    initial && !box.newNumber && consentSummary(initial),
    box.newNumber && box.agreedBefore && !box.clicked && "Their consent was for the old number.",
    box.tickedForOther && `It was ticked for ${box.tickedForOther}: tick it again if they agreed for this number.`,
    "Optional. Read it to the customer, and tick it only if they agree.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <Input label="Name" name="name" defaultValue={initial?.name} required />
      <Input label="Address" name="address" defaultValue={initial?.address ?? ""} autoComplete="off" />
      <div className="space-y-3">
        <Input label="Phone" name="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="off" />
        <SmsConsentCheckbox
          businessName={user?.business_name}
          checked={box.checked}
          onChange={(event) => {
            const click = { checked: event.target.checked, phone, shown: box.checked };
            setTicked((last) => nextClick(last, click));
          }}
          hint={consentHint}
        />
      </div>
      <Input label="Email" name="email" type="email" defaultValue={initial?.email ?? ""} autoComplete="off" />
      <TextArea
        label="Notes"
        name="notes"
        defaultValue={initial?.notes ?? ""}
        rows="3"
        hint="Gate codes, pets, parking. Crew members with client access can see these."
      />
      <ErrorMessage error={error} />
      <FormActions>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
