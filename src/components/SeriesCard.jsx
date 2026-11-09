import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAsync } from "../hooks";
import { DEFAULT_DURATION, DURATION_PRESETS, formatDay, formatDuration, inputTime } from "../utils/format";
import { parseRepeat, REPEAT_OPTIONS, repeatOptions, repeatValue } from "../utils/series";
import ConfirmButton from "./ConfirmButton";
import ErrorMessage from "./ErrorMessage";
import { FormActions, Input, Select, TextArea } from "./Field";
import Loading from "./Loading";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Alert } from "./ui/Feedback";
import { RepeatIcon } from "./ui/Icons";
import { Modal } from "./ui/Modal";

// On the owner's job page: how the job repeats, its next visits, editing the series,
// and stopping it. A one-off job gets "Make this repeat". onChanged() after any change,
// so the page reloads the job (a series change can update this visit too).
export default function SeriesCard({ job, employees, onChanged }) {
  if (!job.series_id) return <MakeRepeat job={job} onChanged={onChanged} />;
  return <SeriesDetails key={job.series_id} seriesId={job.series_id} jobId={job.id} employees={employees} onChanged={onChanged} />;
}

function MakeRepeat({ job, onChanged }) {
  const [value, setValue] = useState("weekly:1");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/series", {
        method: "POST",
        body: { from_job_id: job.id, ...parseRepeat(value), end_date: endDate || null },
      });
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Repeat" description="Make this a regular visit. Future visits are added to the schedule for you.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Repeat" value={value} onChange={(event) => setValue(event.target.value)}>
            {REPEAT_OPTIONS.filter(([option]) => option).map(([option, label]) => (
              <option key={option} value={option}>{label}</option>
            ))}
          </Select>
          <Input label="Ends on" type="date" hint="Optional" value={endDate} min={job.date} onChange={(event) => setEndDate(event.target.value)} />
        </div>
        <ErrorMessage error={error} />
        <Button type="submit" variant="secondary" disabled={busy} block>
          <RepeatIcon />
          {busy ? "Saving…" : "Make this repeat"}
        </Button>
      </form>
    </Card>
  );
}

function SeriesDetails({ seriesId, jobId, employees, onChanged }) {
  const [reload, setReload] = useState(0);
  const { data: series, error } = useAsync(api, `/api/series/${seriesId}`, reload);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(null);

  if (error?.status === 404) return null;
  if (error) {
    return (
      <Card title="Repeats">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!series) {
    return (
      <Card title="Repeats">
        <Loading label="Loading…" />
      </Card>
    );
  }

  function saved(result) {
    const parts = [];
    if (result.updated) parts.push(`${result.updated} upcoming ${result.updated === 1 ? "visit" : "visits"} updated`);
    if (result.made || result.removed) parts.push("the schedule was rebuilt");
    setNotice(parts.length ? `Saved: ${parts.join(", ")}.` : "Saved.");
    setReload((key) => key + 1);
    onChanged();
  }

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <RepeatIcon className="h-4 w-4 text-primary" />
          {series.description}
        </span>
      }
      description={series.end_date ? `Until ${formatDay(series.end_date, "long")}` : "No end date"}
      actions={
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit series
        </Button>
      }
    >
      {notice && <Alert tone="success" className="mb-3">{notice}</Alert>}
      {series.upcoming.length ? (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Next visits</p>
          <ul className="flex flex-wrap gap-1.5">
            {series.upcoming.map((visit) => (
              <li key={visit.id}>
                {visit.id === jobId ? (
                  <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-soft-fg">
                    {formatDay(visit.date)} (this one)
                  </span>
                ) : (
                  <Link
                    to={`/jobs/${visit.id}`}
                    className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
                  >
                    {formatDay(visit.date)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">No upcoming visits.</p>
      )}
      <p className="mt-3 text-xs text-muted">
        Changes to one visit stay with that visit. Edit the series to change every upcoming visit that has not started.
      </p>
      <div className="mt-3 border-t border-border pt-3">
        <ConfirmButton
          label="Stop repeating"
          confirmLabel="Stop repeating"
          busyLabel="Stopping…"
          warning="Upcoming visits nobody has started are removed from the schedule. Past visits, and any with notes, photos, time, or an invoice, stay."
          onConfirm={async () => {
            await api(`/api/series/${seriesId}`, { method: "DELETE" });
            onChanged({ stopped: true });
          }}
        />
      </div>
      {editing && <SeriesEditor series={series} employees={employees} onClose={() => setEditing(false)} onSaved={saved} />}
    </Card>
  );
}

function SeriesEditor({ series, employees, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const assigned = new Set(series.assignees.map((person) => person.id));
  const crew = employees.filter((employee) => employee.is_active || assigned.has(employee.id));
  const durations = DURATION_PRESETS.includes(series.duration_minutes)
    ? DURATION_PRESETS
    : [...DURATION_PRESETS, series.duration_minutes].sort((a, b) => a - b);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setSaving(true);
    setError(null);
    try {
      const result = await api(`/api/series/${series.id}`, {
        method: "PATCH",
        body: {
          ...parseRepeat(form.get("repeat")),
          end_date: form.get("end_date") || null,
          time: form.get("time"),
          duration_minutes: Number(form.get("duration_minutes")),
          service_type: form.get("service_type"),
          price: String(form.get("price")).trim(),
          notes: form.get("notes") || null,
          employee_ids: form.getAll("employee_ids").map(Number),
        },
      });
      onSaved(result);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit series"
      description={`${series.client.name}. Changes apply to upcoming visits nobody has started. Changing how often it repeats rebuilds them.`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Repeat" name="repeat" defaultValue={repeatValue(series)}>
            {repeatOptions(series)
              .filter(([value]) => value)
              .map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
          </Select>
          <Input label="Ends on" name="end_date" type="date" defaultValue={series.end_date || ""} hint="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input label="Service" name="service_type" defaultValue={series.service_type} required className="col-span-2 sm:col-span-1" />
          <Input label="Start time" name="time" type="time" defaultValue={inputTime(series.time)} required />
          <Select label="Length" name="duration_minutes" defaultValue={series.duration_minutes ?? DEFAULT_DURATION}>
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>
            ))}
          </Select>
        </div>
        <Input
          label="Price ($)"
          name="price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          defaultValue={series.price}
          required
        />
        <TextArea label="Instructions for the crew" name="notes" defaultValue={series.notes || ""} rows="3" />
        {crew.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-fg">Crew</legend>
            <div className="flex flex-wrap gap-2">
              {crew.map((employee) => (
                <label
                  key={employee.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface py-1 pl-2.5 pr-3 text-sm transition-colors hover:bg-surface-2 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-4 has-focus-visible:ring-ring"
                >
                  <input type="checkbox" name="employee_ids" value={employee.id} defaultChecked={assigned.has(employee.id)} className="h-4 w-4" />
                  <Avatar person={employee} size="xs" />
                  {employee.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <ErrorMessage error={error} />
        <FormActions>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save series"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
