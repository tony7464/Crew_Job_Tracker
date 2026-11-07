import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../context/useAuth";
import { useAsync, useMinuteClock } from "../../hooks";
import { formatClockTime, formatEntryDay, formatMinutes, liveMinutes, notifyClockChanged, onClockChanged } from "../../utils/timeEntries";
import ErrorMessage from "../ErrorMessage";
import Loading from "../Loading";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Alert } from "../ui/Feedback";
import { ClockIcon } from "../ui/Icons";

// Clock in and out of one job, with your time on it. reloadKey: bump to fetch again
// (after marking the job completed, which clocks you out).
export default function ClockCard({ jobId, reloadKey = 0 }) {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const { data, error } = useAsync(api, `/api/jobs/${jobId}/time`, `${reloadKey}-${tick}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const now = useMinuteClock(() => Date.now());
  const zone = user.timezone;

  // Clocking in or out elsewhere (another tab, the bar at the top) changes this card too.
  useEffect(() => onClockChanged(() => setTick((value) => value + 1)), []);

  async function run(path, body) {
    setBusy(true);
    setActionError(null);
    try {
      await api(path, { method: "POST", body });
      // Refetches this card (see onClockChanged above) and the bar at the top.
      notifyClockChanged();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

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

  const open = data.my_open_entry;
  const here = open && open.job_id === jobId;
  const elsewhere = open && !here;
  const total = data.entries.reduce((sum, entry) => sum + liveMinutes(entry, now), 0);

  return (
    <Card title="Time">
      <div className="space-y-3">
        {here ? (
          <div className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-success-soft-fg">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              On the clock since {formatClockTime(open.clock_in_at, zone)}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMinutes(liveMinutes(open, now))}</p>
          </div>
        ) : elsewhere ? (
          <Alert tone="warning" title={`You are clocked in to ${open.job_label}`}>
            Switching clocks you out there and in here.
          </Alert>
        ) : null}

        {here ? (
          <Button variant="secondary" size="lg" block onClick={() => run(`/api/jobs/${jobId}/clock_out`)} disabled={busy}>
            <ClockIcon className="h-5 w-5" />
            {busy ? "Clocking out…" : "Clock out"}
          </Button>
        ) : data.can_clock_in ? (
          <Button
            size="lg"
            block
            onClick={() => run(`/api/jobs/${jobId}/clock_in`, elsewhere ? { switch: true } : undefined)}
            disabled={busy}
          >
            <ClockIcon className="h-5 w-5" />
            {busy ? "Clocking in…" : elsewhere ? "Switch to this job" : "Clock in"}
          </Button>
        ) : (
          !data.entries.length && <p className="text-sm text-muted">No time was clocked on this job.</p>
        )}
        <ErrorMessage error={actionError} />

        {data.entries.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="flex justify-between text-sm">
              <span className="text-muted">Your time on this job</span>
              <span className="font-semibold tabular-nums">{formatMinutes(total)}</span>
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.entries.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 text-muted">
                  <span>
                    {formatEntryDay(entry.clock_in_at, zone)} · {formatClockTime(entry.clock_in_at, zone)} –{" "}
                    {entry.open ? "now" : formatClockTime(entry.clock_out_at, zone)}
                  </span>
                  <span className="tabular-nums">{formatMinutes(liveMinutes(entry, now))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
