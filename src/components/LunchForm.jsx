import { useState } from "react";
import { api } from "../api";
import { formatDay, inputTime } from "../utils/format";
import { addDays, weekStart } from "../utils/time";
import ErrorMessage from "./ErrorMessage";
import { FormActions, Input } from "./Field";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

// Weekdays (Mon–Fri) of the chosen date's week and the week after, from today on,
// other than the chosen date itself. Offered as "also add on" days for a new lunch.
function repeatChoices(date, today) {
  if (!date) return [];
  const sunday = weekStart(date);
  const days = [];
  // Monday to Friday of this week and the next.
  for (const offset of [1, 2, 3, 4, 5, 8, 9, 10, 11, 12]) {
    const day = addDays(sunday, offset);
    if (day !== date && day >= today) days.push(day);
  }
  return days;
}

// Add, edit, or delete one of your own lunch breaks.
// lunch: the lunch being edited. initial: { date, start_time, end_time } for a new one.
// onSaved() runs after any change so the page can reload.
export default function LunchForm({ lunch, initial, today, onSaved, onClose }) {
  const editing = Boolean(lunch);
  const start = lunch || initial;
  const [date, setDate] = useState(start.date);
  const [repeat, setRepeat] = useState(() => new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const choices = editing ? [] : repeatChoices(date, today);

  function toggleDay(day) {
    setRepeat((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function run(request) {
    setBusy(true);
    setError(null);
    try {
      await request();
      onSaved();
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const times = { start_time: form.get("start_time"), end_time: form.get("end_time") };
    if (times.end_time <= times.start_time) {
      setError(new Error("The end time must be after the start time."));
      return;
    }
    if (editing) {
      run(() => api(`/api/me/lunches/${lunch.id}`, { method: "PATCH", body: { date, ...times } }));
      return;
    }
    // Only days still offered count, in case the date changed after picking some.
    const extra = choices.filter((day) => repeat.has(day));
    const body = extra.length ? { dates: [date, ...extra], ...times } : { date, ...times };
    run(() => api("/api/me/lunches", { method: "POST", body }));
  }

  return (
    <Modal
      title={editing ? "Edit lunch break" : "Add a lunch break"}
      description="Your lunch shows on the owner's schedule so jobs can be planned around it."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Date"
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start" name="start_time" type="time" defaultValue={inputTime(start.start_time)} required />
          <Input label="End" name="end_time" type="time" defaultValue={inputTime(start.end_time)} required />
        </div>
        {choices.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-fg">Also add on</legend>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((day) => (
                <label
                  key={day}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-fg has-focus-visible:ring-4 has-focus-visible:ring-ring"
                >
                  <input
                    type="checkbox"
                    checked={repeat.has(day)}
                    onChange={() => toggleDay(day)}
                    className="h-3.5 w-3.5"
                  />
                  {formatDay(day)}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">Each day becomes its own lunch break you can change later.</p>
          </fieldset>
        )}
        <ErrorMessage error={error} />
        <FormActions>
          {editing && !confirmDelete && (
            <Button variant="danger-outline" onClick={() => setConfirmDelete(true)} disabled={busy} className="sm:mr-auto">
              Delete
            </Button>
          )}
          {editing && confirmDelete && (
            <Button
              variant="danger"
              onClick={() => run(() => api(`/api/me/lunches/${lunch.id}`, { method: "DELETE" }))}
              disabled={busy}
              className="sm:mr-auto"
            >
              Confirm delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save" : "Add lunch"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
