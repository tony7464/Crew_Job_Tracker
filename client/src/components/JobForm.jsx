import { useState } from "react";
import { Link } from "react-router-dom";
import ErrorMessage from "./ErrorMessage";
import { formatTime } from "../utils/format";

export default function JobForm({ clients, initial, onSubmit, submitLabel }) {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!clients.length) {
    return (
      <p className="text-sm text-slate-600">
        Add a client before scheduling a job.{" "}
        <Link to="/clients" className="text-sky-800 hover:underline">
          Go to clients
        </Link>
      </p>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        client_id: Number(form.get("client_id")),
        date: form.get("date"),
        time: form.get("time"),
        service_type: form.get("service_type"),
        price: Number(form.get("price")),
        status: form.get("status"),
        paid: form.get("paid") === "on",
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
        Client
        <select
          name="client_id"
          defaultValue={initial?.client_id ?? ""}
          required
          className="field"
        >
          <option value="" disabled>
            Choose a client
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Date
          <input name="date" type="date" defaultValue={initial?.date} required className="field" />
        </label>
        <label className="block text-sm font-medium">
          Time
          <input
            name="time"
            type="time"
            defaultValue={formatTime(initial?.time)}
            required
            className="field"
          />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Service
        <input
          name="service_type"
          defaultValue={initial?.service_type}
          required
          className="field"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Price
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initial?.price ?? ""}
            required
            className="field"
          />
        </label>
        <label className="block text-sm font-medium">
          Status
          <select name="status" defaultValue={initial?.status ?? "scheduled"} className="field">
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="paid" type="checkbox" defaultChecked={initial?.paid} />
        Paid
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea name="notes" defaultValue={initial?.notes ?? ""} rows="3" className="field" />
      </label>
      <ErrorMessage error={error} />
      <button type="submit" disabled={submitting} className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
