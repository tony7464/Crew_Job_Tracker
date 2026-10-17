import { Link } from "react-router-dom";
import { useSubmit } from "../hooks";
import { formatTime, STATUSES, statusLabel } from "../utils/format";
import ErrorMessage from "./ErrorMessage";
import { Input, Select, TextArea } from "./Field";

export default function JobForm({ clients, initial, onSubmit, submitLabel }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, !initial);

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

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    handleSubmit(event, {
      client_id: Number(form.get("client_id")),
      date: form.get("date"),
      time: form.get("time"),
      service_type: form.get("service_type"),
      price: Number(form.get("price")),
      status: form.get("status"),
      paid: form.get("paid") === "on",
      notes: form.get("notes") || null,
    });
  }

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <Select label="Client" name="client_id" defaultValue={initial?.client_id ?? ""} required>
        <option value="" disabled>Choose a client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.name}</option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Date" name="date" type="date" defaultValue={initial?.date} required />
        <Input label="Time" name="time" type="time" defaultValue={formatTime(initial?.time)} required />
      </div>
      <Input label="Service" name="service_type" defaultValue={initial?.service_type} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Price"
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initial?.price ?? ""}
          required
        />
        <Select label="Status" name="status" defaultValue={initial?.status ?? "scheduled"}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="paid" type="checkbox" defaultChecked={initial?.paid} />
        Paid
      </label>
      <TextArea label="Notes" name="notes" defaultValue={initial?.notes ?? ""} rows="3" />
      <ErrorMessage error={error} />
      <button type="submit" disabled={submitting} className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
