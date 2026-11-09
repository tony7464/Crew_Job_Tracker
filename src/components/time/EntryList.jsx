import { useAuth } from "../../context/useAuth";
import { useMinuteClock } from "../../hooks";
import { formatClockTime, formatEntryDay, formatMinutes, liveMinutes } from "../../utils/timeEntries";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";

// Time entries as rows. onEdit(entry), when given, makes each row a button (owners).
// showJob adds the job's name (timesheets); job pages already say which job.
export default function EntryList({ entries, onEdit, showJob = false, empty = "No time yet." }) {
  const { user } = useAuth();
  const zone = user.timezone;
  const now = useMinuteClock(() => Date.now());

  if (!entries.length) {
    return <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => {
        const body = (
          <span className="flex w-full items-start gap-3 py-2.5 text-left">
            <Avatar person={entry.person} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-fg">{entry.person.name}</span>
                {entry.long_open ? (
                  <Badge tone="danger" title="Open for more than 16 hours">Check clock-out</Badge>
                ) : entry.open ? (
                  <Badge tone="success">On the clock</Badge>
                ) : null}
                {entry.edited_by && (
                  <Badge tone="neutral" title={`Changed by ${entry.edited_by.name}`}>Edited</Badge>
                )}
              </span>
              {showJob && <span className="block truncate text-sm text-fg">{entry.job_label}</span>}
              <span className="block text-xs text-muted">
                {formatEntryDay(entry.clock_in_at, zone)} · {formatClockTime(entry.clock_in_at, zone)} –{" "}
                {entry.open ? "now" : formatClockTime(entry.clock_out_at, zone)}
              </span>
              {entry.note && <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-muted">{entry.note}</span>}
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-fg">{formatMinutes(liveMinutes(entry, now))}</span>
          </span>
        );
        return (
          <li key={entry.id}>
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 hover:bg-surface-2"
                aria-label={`Edit ${entry.person.name}'s time, ${formatMinutes(liveMinutes(entry, now))}`}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
