import { useEffect, useMemo, useState } from "react";
import { api, apiUrl } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Select } from "../components/Field";
import Loading from "../components/Loading";
import EntryList from "../components/time/EntryList";
import EntryModal from "../components/time/EntryModal";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { ChevronLeftIcon, ChevronRightIcon, ExternalIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { buttonClass } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { useAsync, useMinuteClock } from "../hooks";
import { formatDay } from "../utils/format";
import { isOwner } from "../utils/roles";
import { businessToday } from "../utils/time";
import {
  entryDayKey,
  formatHours,
  formatMinutes,
  liveMinutes,
  onClockChanged,
  shiftDays,
  weekOf,
} from "../utils/timeEntries";

// A week of clocked time, Monday to Sunday in the business time zone. The owner sees
// everyone (or one person), totals per person, can fix entries, and can download a CSV
// for payroll. Crew members see their own hours, read-only.
export default function TimesheetsPage() {
  const { user } = useAuth();
  const owner = isOwner(user);
  const [week, setWeek] = useState(() => weekOf(businessToday(user.timezone)));
  const [personId, setPersonId] = useState("");
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null);
  const now = useMinuteClock(() => Date.now());
  useEffect(() => onClockChanged(() => setTick((value) => value + 1)), []);

  const query = new URLSearchParams({ start: week.start, end: week.end });
  if (owner && personId) query.set("employee_id", personId);
  const { data, error } = useAsync(api, `/api/time_entries?${query}`, tick);
  const employees = useAsync(owner ? api : noEmployees, "/api/employees");

  const thisWeek = weekOf(businessToday(user.timezone));
  const isThisWeek = week.start === thisWeek.start;
  const people = useMemo(
    () => [{ id: user.id, username: user.username }, ...(employees.data || [])],
    [employees.data, user.id, user.username],
  );

  const days = useMemo(() => {
    if (!data) return [];
    const groups = new Map();
    for (const entry of data.entries) {
      const key = entryDayKey(entry.clock_in_at, user.timezone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [data, user.timezone]);

  const total = data ? data.entries.reduce((sum, entry) => sum + liveMinutes(entry, now), 0) : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={owner ? "Timesheets" : "My hours"}
        description={owner ? "Hours the crew clocked on jobs. Tap an entry to fix it." : "The time you clocked on jobs."}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Previous week" onClick={() => setWeek(weekOf(shiftDays(week.start, -7)))}>
            <ChevronLeftIcon />
          </Button>
          <p className="min-w-40 text-center text-sm font-semibold tabular-nums">
            {formatDay(week.start)} – {formatDay(week.end)}
          </p>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next week"
            onClick={() => setWeek(weekOf(shiftDays(week.start, 7)))}
            disabled={isThisWeek}
          >
            <ChevronRightIcon />
          </Button>
          {!isThisWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeek(thisWeek)}>
              This week
            </Button>
          )}
        </div>
        {owner && (
          <div className="flex flex-wrap items-end gap-2">
            <Select label="Person" value={personId} onChange={(event) => setPersonId(event.target.value)} className="w-44">
              <option value="">Everyone</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.username}
                </option>
              ))}
            </Select>
            <a href={apiUrl(`/api/time_entries/export?${query}`)} className={buttonClass({ variant: "secondary" })}>
              <ExternalIcon />
              Download CSV
            </a>
          </div>
        )}
      </div>

      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card title="Totals" className="lg:order-2">
            <p className="text-3xl font-semibold tabular-nums">{formatHours(total)} h</p>
            <p className="text-sm text-muted">{formatMinutes(total)} this week</p>
            {owner && data.people.length > 0 && (
              <ul className="mt-4 divide-y divide-border border-t border-border">
                {data.people.map((row) => {
                  const minutes = data.entries
                    .filter((entry) => entry.person.id === row.person.id)
                    .reduce((sum, entry) => sum + liveMinutes(entry, now), 0);
                  return (
                    <li key={row.person.id} className="flex items-center gap-3 py-2.5">
                      <Avatar person={row.person} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.person.username}</span>
                      {row.open > 0 && <Badge tone="success">On the clock</Badge>}
                      <span className="text-sm tabular-nums">{formatHours(minutes)} h</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <div className="space-y-4 lg:col-span-2 lg:order-1">
            {days.length === 0 ? (
              <EmptyState title="No time this week." description={owner ? "Time shows up here when the crew clocks in on a job." : "Clock in from a job on My jobs."} />
            ) : (
              days.map(([day, entries]) => (
                <Card
                  key={day}
                  title={formatDay(day, "long")}
                  actions={
                    <span className="text-sm font-medium tabular-nums text-muted">
                      {formatMinutes(entries.reduce((sum, entry) => sum + liveMinutes(entry, now), 0))}
                    </span>
                  }
                >
                  <EntryList entries={entries} showJob onEdit={owner ? setEditing : undefined} />
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {editing && (
        <EntryModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setTick((value) => value + 1)}
          onDeleted={() => setTick((value) => value + 1)}
        />
      )}
    </div>
  );
}

// Crew members do not load the employee list.
async function noEmployees() {
  return [];
}
