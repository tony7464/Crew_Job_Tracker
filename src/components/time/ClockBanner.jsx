import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../context/useAuth";
import { useMinuteClock } from "../../hooks";
import { isOwner } from "../../utils/roles";
import { formatMinutes, liveMinutes, notifyClockChanged, onClockChanged } from "../../utils/timeEntries";
import { Button } from "../ui/Button";

const POLL_MS = 60000;

// A bar under the menu while you are clocked in, on every page but that job's own,
// so a forgotten clock-out is hard to miss.
export default function ClockBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [entry, setEntry] = useState(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const now = useMinuteClock(() => Date.now());

  useEffect(() => {
    if (!user) return undefined;
    const bump = () => setTick((value) => value + 1);
    const id = setInterval(bump, POLL_MS);
    const stop = onClockChanged(bump);
    return () => {
      clearInterval(id);
      stop();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api("/api/me/clock", { skipAuth: true })
      .then((data) => {
        if (!cancelled) setEntry(data.entry);
      })
      .catch(() => {
        // A hint only: keep what we had.
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname, tick]);

  if (!user || !entry) return null;
  const jobPath = entry.job_id ? `${isOwner(user) ? "/jobs" : "/my-jobs"}/${entry.job_id}` : null;
  if (jobPath && pathname === jobPath) return null;

  async function clockOut() {
    setBusy(true);
    try {
      await api(`/api/jobs/${entry.job_id}/clock_out`, { method: "POST" });
      setEntry(null);
      notifyClockChanged();
    } catch {
      setTick((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="border-b border-success/30 bg-success-soft text-success-soft-fg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm sm:px-6">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">On the clock</span> · <span className="tabular-nums">{formatMinutes(liveMinutes(entry, now))}</span>
          <span className="hidden sm:inline"> · {entry.job_label}</span>
        </span>
        {jobPath && (
          <>
            <Link to={jobPath} className="font-medium underline underline-offset-2">
              Open job
            </Link>
            <Button size="sm" variant="secondary" onClick={clockOut} disabled={busy}>
              {busy ? "Clocking out…" : "Clock out"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
