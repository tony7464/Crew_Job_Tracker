import { useSubmit } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import { Checkbox, FormActions, Input, TextArea } from "./Field";
import { Button } from "./ui/Button";

export default function ClientForm({ initial, onSubmit, submitLabel, onCancel }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, !initial);

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    handleSubmit(event, {
      name: form.get("name"),
      address: form.get("address") || null,
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      notes: form.get("notes") || null,
      sms_opt_out: form.get("sms_opt_out") === "on",
    });
  }

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <Input label="Name" name="name" defaultValue={initial?.name} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Address" name="address" defaultValue={initial?.address ?? ""} autoComplete="off" />
        <Input label="Phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} autoComplete="off" />
      </div>
      <Input label="Email" name="email" type="email" defaultValue={initial?.email ?? ""} autoComplete="off" />
      <TextArea
        label="Notes"
        name="notes"
        defaultValue={initial?.notes ?? ""}
        rows="3"
        hint="Gate codes, pets, parking. Crew members with client access can see these."
      />
      <Checkbox
        name="sms_opt_out"
        defaultChecked={Boolean(initial?.sms_opt_out)}
        label="Do not text"
        description="They asked not to get texts. Visit confirmations, reminders, and quote links go by email instead."
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
