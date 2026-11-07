import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { DURATION_PRESETS, formatDuration, inputTime } from "../utils/format";
import { fieldErrors } from "../utils/requests";
import ErrorMessage from "./ErrorMessage";
import { Input, Select, TextArea } from "./Field";
import { Avatar } from "./ui/Avatar";
import { Badge } from "./ui/Badge";
import { Button, ButtonLink } from "./ui/Button";
import { Card } from "./ui/Card";
import { Alert } from "./ui/Feedback";
import { CheckIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

const QUOTE_LABELS = {
  draft: ["Draft: not sent yet", "warning"],
  sent: ["Sent to the customer", "primary"],
  accepted: ["Accepted", "success"],
  declined: ["Declined", "danger"],
};

function QuoteStatus({ quote }) {
  const [label, tone] = QUOTE_LABELS[quote.status] || [quote.status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

// An estimate visit: its quote, and (for the owner and leads, canEdit) rescheduling,
// changing who goes, and cancelling. canOpenQuote: the owner, who prices the work.
export default function VisitCard({ job, onChanged, canEdit, canOpenQuote }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const quote = job.visit_quote;

  async function patch(body) {
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/api/visits/${job.id}`, { method: "PATCH", body });
      onChanged(result.visit);
      setSaved(result.confirmation);
      setEditing(false);
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function startQuote() {
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/api/visits/${job.id}/quote`, { method: "POST" });
      onChanged(result.visit);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Estimate visit"
      description="A free visit to look at the work. Take photos, notes, and materials so the work can be quoted."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <span className="font-medium text-fg">Quote</span>
            {quote ? <QuoteStatus quote={quote} /> : <span className="text-muted">None yet</span>}
            {quote?.total && quote.status !== "draft" && <span className="tabular-nums text-muted">${quote.total}</span>}
          </span>
          {canOpenQuote &&
            (quote ? (
              <ButtonLink to={`/quotes/${quote.id}`} size="sm" variant={quote.status === "draft" ? "primary" : "secondary"}>
                {quote.status === "draft" ? "Write the quote" : "Open the quote"}
              </ButtonLink>
            ) : (
              <Button size="sm" onClick={startQuote} disabled={busy}>
                Start a quote
              </Button>
            ))}
        </div>
        {!canOpenQuote && quote?.status === "draft" && (
          <p className="text-sm text-muted">The office prices the work from your photos, notes, and materials.</p>
        )}
        {saved && (
          <Alert tone="success">
            {saved.cancelled ? "The visit is cancelled." : saved.headline}
          </Alert>
        )}
        {canEdit && !editing && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {job.status === "scheduled" && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Reschedule or change crew
              </Button>
            )}
            {job.status === "scheduled" && (
              <Button variant="danger-outline" size="sm" disabled={busy} onClick={() => patch({ status: "cancelled" })}>
                Cancel visit
              </Button>
            )}
            {job.status === "cancelled" && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => patch({ status: "scheduled" })}>
                Book it again
              </Button>
            )}
          </div>
        )}
        {canEdit && editing && (
          <VisitForm job={job} busy={busy} error={error} onCancel={() => setEditing(false)} onSave={patch} />
        )}
        {!editing && <ErrorMessage error={error} />}
      </div>
    </Card>
  );
}

function VisitForm({ job, busy, error, onCancel, onSave }) {
  const [form, setForm] = useState({
    date: job.date,
    time: inputTime(job.time),
    duration_minutes: job.duration_minutes,
    service_type: job.service_type,
    notes: job.notes || "",
    crew: job.assignees.map((person) => person.id),
  });
  const { data } = useAsync(api, `/api/schedule/team?start=${form.date}&end=${form.date}`);
  const crewIds = new Set(form.crew);
  // Keep people already on the visit even if they were deactivated since.
  const people = [
    ...(data?.employees || []).filter((person) => person.is_active || crewIds.has(person.id)),
  ];
  const errors = fieldErrors(error);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const presets = DURATION_PRESETS.includes(Number(form.duration_minutes))
    ? DURATION_PRESETS
    : [...DURATION_PRESETS, Number(form.duration_minutes)].sort((a, b) => a - b);

  function toggle(id) {
    setForm((current) => ({
      ...current,
      crew: current.crew.includes(id) ? current.crew.filter((other) => other !== id) : [...current.crew, id],
    }));
  }

  function submit(event) {
    event.preventDefault();
    onSave({
      date: form.date,
      time: form.time,
      duration_minutes: Number(form.duration_minutes),
      service_type: form.service_type.trim() || job.service_type,
      notes: form.notes.trim() || null,
      employee_ids: form.crew,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-border pt-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Date" type="date" value={form.date} onChange={set("date")} error={errors.date} />
        <Input label="Time" type="time" step={900} value={form.time} onChange={set("time")} error={errors.time} />
        <Select label="How long" value={form.duration_minutes} onChange={set("duration_minutes")} error={errors.duration_minutes}>
          {presets.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes)}
            </option>
          ))}
        </Select>
        <Input label="Service" value={form.service_type} onChange={set("service_type")} error={errors.service_type} maxLength={120} />
      </div>
      {people.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">Who's going</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Crew">
            {people.map((person) => {
              const on = crewIds.has(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(person.id)}
                  className={cx(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-2.5 py-1 text-sm font-medium",
                    on ? "border-primary bg-primary/10 text-fg" : "border-border text-muted hover:text-fg",
                  )}
                >
                  <Avatar person={person} size="sm" />
                  {person.username}
                  {on && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
          {errors.employee_ids && <p className="mt-1.5 text-sm text-danger">{errors.employee_ids}</p>}
        </div>
      )}
      <TextArea label="Notes for the crew" value={form.notes} onChange={set("notes")} error={errors.notes} maxLength={2000} />
      <ErrorMessage error={Object.keys(errors).length ? null : error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save visit"}
        </Button>
      </div>
    </form>
  );
}
