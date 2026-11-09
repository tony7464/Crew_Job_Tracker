import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../context/useAuth";
import { useAsync, useMinuteClock } from "../../hooks";
import { formatMinutes, liveMinutes, onClockChanged } from "../../utils/timeEntries";
import ErrorMessage from "../ErrorMessage";
import Loading from "../Loading";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PlusIcon } from "../ui/Icons";
import { cx } from "../ui/styles";
import EntryList from "./EntryList";
import EntryModal from "./EntryModal";

// The owner's view of a job's time: everyone's entries, the total against the
// scheduled length, and adding or fixing entries. crew: the job's assignees.
export default function JobTimeCard({ jobId, crew, reloadKey = 0 }) {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const { data, setData, error } = useAsync(api, `/api/jobs/${jobId}/time`, `${reloadKey}-${tick}`);
  const [editing, setEditing] = useState(null);
  const now = useMinuteClock(() => Date.now());
  useEffect(() => onClockChanged(() => setTick((value) => value + 1)), []);

  if (error) {
    return (
      <Card title="Time">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="Time">
        <Loading label="Loading time…" />
      </Card>
    );
  }

  const total = data.entries.reduce((sum, entry) => sum + liveMinutes(entry, now), 0);
  const scheduled = data.scheduled_minutes;
  const over = total - scheduled;
  const people = [...crew, { id: user.id, username: user.username, name: user.name }];

  function saved(entry) {
    setData((current) => {
      const exists = current.entries.some((item) => item.id === entry.id);
      const entries = exists
        ? current.entries.map((item) => (item.id === entry.id ? entry : item))
        : [...current.entries, entry].sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at));
      return { ...current, entries };
    });
  }

  function deleted(entryId) {
    setData((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entryId) }));
  }

  return (
    <Card
      title="Time"
      description="Hours the crew clocked on this job."
      actions={
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <PlusIcon />
          Add time
        </Button>
      }
    >
      {data.entries.length > 0 && (
        <div className="mb-3 flex items-baseline justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
          <span className="text-sm text-muted">
            {formatMinutes(total)} of {formatMinutes(scheduled)} scheduled
          </span>
          {Math.abs(over) >= 5 && (
            <span className={cx("text-sm font-medium tabular-nums", over > 0 ? "text-warning" : "text-success")}>
              {over > 0 ? `${formatMinutes(over)} over` : `${formatMinutes(-over)} under`}
            </span>
          )}
        </div>
      )}
      <EntryList entries={data.entries} onEdit={setEditing} empty="Nobody has clocked in yet." />
      {editing && (
        <EntryModal
          entry={editing === "new" ? null : editing}
          jobId={jobId}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onDeleted={deleted}
        />
      )}
    </Card>
  );
}
