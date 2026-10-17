import { useSubmit } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import { Input, TextArea } from "./Field";

export default function ClientForm({ initial, onSubmit, submitLabel }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, !initial);

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    handleSubmit(event, {
      name: form.get("name"),
      address: form.get("address") || null,
      phone: form.get("phone") || null,
      notes: form.get("notes") || null,
    });
  }

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <Input label="Name" name="name" defaultValue={initial?.name} required />
      <Input label="Address" name="address" defaultValue={initial?.address ?? ""} />
      <Input label="Phone" name="phone" defaultValue={initial?.phone ?? ""} />
      <TextArea label="Notes" name="notes" defaultValue={initial?.notes ?? ""} rows="3" />
      <ErrorMessage error={error} />
      <button type="submit" disabled={submitting} className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
