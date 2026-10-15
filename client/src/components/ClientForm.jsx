import { useState } from "react";
import ErrorMessage from "./ErrorMessage";

export default function ClientForm({ initial, onSubmit, submitLabel }) {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: form.get("name"),
        address: form.get("address") || null,
        phone: form.get("phone") || null,
        notes: form.get("notes") || null,
      });
      if (!initial) event.target.reset();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Name
        <input name="name" defaultValue={initial?.name} required className="field" />
      </label>
      <label className="block text-sm font-medium">
        Address
        <input name="address" defaultValue={initial?.address ?? ""} className="field" />
      </label>
      <label className="block text-sm font-medium">
        Phone
        <input name="phone" defaultValue={initial?.phone ?? ""} className="field" />
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows="3"
          className="field"
        />
      </label>
      <ErrorMessage error={error} />
      <button
        type="submit"
        disabled={submitting}
        className="btn"
      >
        {submitLabel}
      </button>
    </form>
  );
}
