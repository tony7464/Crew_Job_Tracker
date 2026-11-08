import { useState } from "react";
import { Link } from "react-router-dom";
import { useSubmit } from "../hooks";
import { REPEAT_OPTIONS, parseRepeat } from "../utils/series";
import {
  DEFAULT_DURATION,
  DURATION_PRESETS,
  formatDuration,
  inputTime,
  STATUSES,
  statusLabel,
} from "../utils/format";
import ErrorMessage from "./ErrorMessage";
import { Checkbox, FormActions, Input, Select, TextArea } from "./Field";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";

// Active employees can be picked. Inactive ones already on the job stay listed (and
// checked) so saving keeps them; the server accepts those but no new inactive ones.
function assignableEmployees(employees, initial) {
  const assignedIds = new Set((initial?.assignees || []).map((person) => person.id));
  return employees.filter((employee) => employee.is_active || assignedIds.has(employee.id));
}

// Archived clients are not in the picker. A job already on one keeps its client
// listed (and labelled) so it can be edited; new jobs cannot pick it.
function pickableClients(clients, initial) {
  const listed = clients.some((client) => String(client.id) === String(initial?.client_id));
  if (!initial?.id || listed || !initial.client_name) return clients.map((client) => [client.id, client.name]);
  return [
    ...clients.map((client) => [client.id, client.name]),
    [initial.client_id, `${initial.client_name} (archived)`],
  ];
}

function durationOptions(current) {
  return DURATION_PRESETS.includes(current) ? DURATION_PRESETS : [...DURATION_PRESETS, current].sort((a, b) => a - b);
}

// employees: the owner's employee list. Leave it out to hide the crew picker.
// initial: the job being edited, or prefill values (client_id, date, time, duration_minutes).
// New jobs get a Repeat picker; the body then has repeat: { repeat, every, end_date } or null
// (see createJob in utils/series.js).
export default function JobForm({ clients, employees, initial, onSubmit, submitLabel, onCancel }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, !initial);
  const isNew = !initial?.id;
  const [repeat, setRepeat] = useState("");

  if (!clients.length && !initial?.id) {
    return (
      <p className="text-sm text-muted">
        Add a client before scheduling a job.{" "}
        <Link to="/clients" className="link">
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
      duration_minutes: Number(form.get("duration_minutes")),
      service_type: form.get("service_type"),
      // The input's own text, like "19.99": the server turns it into whole cents exactly.
      price: String(form.get("price")).trim(),
      status: form.get("status"),
      // While an invoice decides paid, send the value the job already has (the server refuses a change).
      paid: paidByInvoice ? Boolean(initial.paid) : form.get("paid") === "on",
      notes: form.get("notes") || null,
      ...(employees ? { employee_ids: form.getAll("employee_ids").map(Number) } : {}),
      ...(isNew
        ? {
            repeat: parseRepeat(repeat) && { ...parseRepeat(repeat), end_date: form.get("repeat_end") || null },
          }
        : {}),
    });
  }

  const crew = employees ? assignableEmployees(employees, initial) : [];
  const paidByInvoice = Boolean(initial?.invoice);
  const assignedIds = new Set((initial?.assignees || []).map((person) => person.id));
  const duration = initial?.duration_minutes ?? DEFAULT_DURATION;

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Client" name="client_id" defaultValue={initial?.client_id ?? ""} required>
          <option value="" disabled>Choose a client</option>
          {pickableClients(clients, initial).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </Select>
        <Input
          label="Service"
          name="service_type"
          defaultValue={initial?.service_type}
          placeholder="Windows, gutters, deep clean…"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Input label="Date" name="date" type="date" defaultValue={initial?.date} required className="col-span-2 sm:col-span-1" />
        <Input label="Start time" name="time" type="time" defaultValue={inputTime(initial?.time)} required />
        <Select label="Length" name="duration_minutes" defaultValue={duration}>
          {durationOptions(duration).map((minutes) => (
            <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>
          ))}
        </Select>
      </div>
      {isNew && (
        <div className="grid grid-cols-2 gap-4">
          <Select label="Repeat" value={repeat} onChange={(event) => setRepeat(event.target.value)}>
            {REPEAT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          {repeat && <Input label="Ends on" name="repeat_end" type="date" hint="Optional" />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Price ($)"
          name="price"
          type="number"
          inputMode="decimal"
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
      <Checkbox
        label="Paid"
        name="paid"
        defaultChecked={initial?.paid}
        disabled={paidByInvoice}
        description={
          paidByInvoice ? `Set by invoice ${initial.invoice.label}. Record payments on the invoice.` : undefined
        }
      />
      <TextArea
        label="Instructions for the crew"
        name="notes"
        defaultValue={initial?.notes ?? ""}
        rows="3"
      />
      {employees && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Crew</legend>
          {crew.length ? (
            <div className="flex flex-wrap gap-2">
              {crew.map((employee) => (
                <label
                  key={employee.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface py-1 pl-2.5 pr-3 text-sm transition-colors hover:bg-surface-2 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-4 has-focus-visible:ring-ring"
                >
                  <input
                    type="checkbox"
                    name="employee_ids"
                    value={employee.id}
                    defaultChecked={assignedIds.has(employee.id)}
                    className="h-4 w-4"
                  />
                  <Avatar person={employee} size="xs" />
                  {employee.username}
                  {!employee.is_active && <span className="text-muted">(inactive)</span>}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No employees yet.{" "}
              <Link to="/employees" className="link">Add employees</Link>
            </p>
          )}
        </fieldset>
      )}
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
