import { useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../context/useAuth";
import { businessNow, wallDate } from "../../utils/time";
import { toWallInput } from "../../utils/timeEntries";
import ConfirmButton from "../ConfirmButton";
import ErrorMessage from "../ErrorMessage";
import { FormActions, Input, Select, TextArea } from "../Field";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const MAX_NOTE = 500;

// Add time for someone (entry is null: pass jobId and people), or fix an entry's times
// and note. Times are wall-clock times in the business time zone. Owners only.
// onSaved(entry) after a save; onDeleted(id) after a delete.
export default function EntryModal({ entry, jobId, people = [], onClose, onSaved, onDeleted }) {
  const { user } = useAuth();
  const zone = user.timezone;
  const today = wallDate(businessNow(zone));
  const [values, setValues] = useState(() => ({
    user_id: entry ? entry.person.id : people[0]?.id ?? "",
    clock_in: entry ? toWallInput(entry.clock_in_at, zone) : `${today}T08:00`,
    // An open entry has no end yet: suggest now, so saving clocks it out.
    clock_out: entry?.clock_out_at
      ? toWallInput(entry.clock_out_at, zone)
      : entry
        ? toWallInput(new Date().toISOString(), zone)
        : `${today}T12:00`,
    note: entry?.note || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(name) {
    return (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { clock_in: values.clock_in, clock_out: values.clock_out, note: values.note.trim() || null };
      const saved = entry
        ? await api(`/api/time_entries/${entry.id}`, { method: "PATCH", body })
        : await api("/api/time_entries", {
            method: "POST",
            body: { ...body, user_id: Number(values.user_id), job_id: jobId },
          });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const errors = error?.data?.errors || {};
  const first = (name) => [].concat(errors[name] || [])[0];

  return (
    <Modal
      title={entry ? "Edit time" : "Add time"}
      description={entry ? `${entry.person.name} on ${entry.job_label}` : "For time someone forgot to clock."}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {!entry && (
          <Select label="Person" value={values.user_id} onChange={set("user_id")} required>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        )}
        {entry?.open && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-fg">
            {entry.person.name} is still clocked in. Saving with a clock-out time clocks them out.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Clock in"
            type="datetime-local"
            value={values.clock_in}
            onChange={set("clock_in")}
            error={first("clock_in")}
            required
          />
          <Input
            label="Clock out"
            type="datetime-local"
            value={values.clock_out}
            onChange={set("clock_out")}
            error={first("clock_out")}
            required
          />
        </div>
        <TextArea
          label="Note"
          hint="Optional, such as why the time was changed."
          rows="2"
          maxLength={MAX_NOTE}
          value={values.note}
          onChange={set("note")}
        />
        {!first("clock_in") && !first("clock_out") && <ErrorMessage error={error} />}
        <FormActions>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : entry ? "Save changes" : "Add time"}
          </Button>
        </FormActions>
      </form>
      {entry && (
        <div className="mt-5 border-t border-border pt-4">
          <ConfirmButton
            label="Delete entry"
            confirmLabel="Delete entry"
            busyLabel="Deleting…"
            warning="This time is removed from the timesheet. This cannot be undone."
            onConfirm={async () => {
              await api(`/api/time_entries/${entry.id}`, { method: "DELETE" });
              onDeleted(entry.id);
              onClose();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
