import { useState } from "react";
import ErrorMessage from "./ErrorMessage";

const fieldClass = "mt-1 w-full rounded border border-slate-300 px-3 py-2";

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
        <input name="name" defaultValue={initial?.name} required className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">
        Address
        <input name="address" defaultValue={initial?.address ?? ""} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">
        Phone
        <input name="phone" defaultValue={initial?.phone ?? ""} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows="3"
          className={fieldClass}
        />
      </label>
      <ErrorMessage error={error} />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-sky-700 px-4 py-2 text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
