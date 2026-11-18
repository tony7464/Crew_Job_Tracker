import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { driveText, tightCount, tightText } from "../utils/driveTime";
import { formatTime } from "../utils/format";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { MapPinIcon } from "./ui/Icons";

function Leg({ leg }) {
  const problem = tightText(leg);
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
      <span className="min-w-0 text-fg [overflow-wrap:anywhere]">
        {leg.from_client} <span aria-hidden="true">→</span>
        <span className="sr-only">to</span> {leg.to_client}
        <span className="text-muted"> · next starts {formatTime(leg.to_time)}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums text-muted">{driveText(leg)}</span>
        {problem && <Badge tone="warning">{problem}</Badge>}
      </span>
    </li>
  );
}

function Routes({ path, team, title }) {
  const [again, setAgain] = useState(0);
  const { data } = useAsync(api, path, again);
  // Nothing to show is not worth a card: off, no day with two jobs, or it could not load.
  if (!data || !data.enabled) return null;
  const people = data.people.filter((person) => person.legs.length || person.missing.length);
  if (!people.length && !data.waiting) return null;
  const tight = tightCount(people);

  return (
    <Card
      title={title}
      description={
        tight
          ? `${tight} ${tight === 1 ? "drive does" : "drives do"} not fit in the time between jobs.`
          : "The drive from each job to the next."
      }
    >
      <div className="space-y-4">
        {people.map((person) => (
          <section key={person.user_id}>
            {team && <h3 className="mb-0.5 text-sm font-semibold text-fg">{person.name}</h3>}
            {person.legs.length > 0 && (
              <ul className="divide-y divide-border">
                {person.legs.map((leg) => (
                  <Leg key={`${leg.from_job_id}-${leg.to_job_id}`} leg={leg} />
                ))}
              </ul>
            )}
            {person.missing.length > 0 && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {person.missing.length === 1 ? "1 job's address is" : `${person.missing.length} jobs' addresses are`} not on
                the map, so no drive is shown to or from {person.missing.length === 1 ? "it" : "them"}. Check the client&apos;s
                address.
              </p>
            )}
          </section>
        ))}
        {data.waiting > 0 && (
          <p className="text-xs text-muted">
            Still finding {data.waiting === 1 ? "1 address" : `${data.waiting} addresses`} on the map.{" "}
            <button type="button" className="link" onClick={() => setAgain((value) => value + 1)}>
              Check again
            </button>
          </p>
        )}
        <p className="text-xs text-muted">Drive times are without traffic. Map data © OpenStreetMap contributors.</p>
      </div>
    </Card>
  );
}

// The drive between each job and the next on one day, with a warning where the drive does
// not fit. team: everyone's day (owner and managers); otherwise the person's own.
// refreshKey: change it when the day's jobs change, to work the drives out again.
export default function DayDriveTimes({ date, team = false, refreshKey = "", title = "Drive times" }) {
  const path = `/api/drive_times?date=${date}${team ? "&team=true" : ""}`;
  // A new day, or changed jobs, starts over, so one day's drives never show under another.
  return <Routes key={`${path}|${refreshKey}`} path={path} team={team} title={title} />;
}
