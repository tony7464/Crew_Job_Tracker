import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import BusinessHealthCard from "../components/BusinessHealthCard";
import ErrorMessage from "../components/ErrorMessage";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import TeamSchedule from "../components/calendar/TeamSchedule";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CountUp, TiltCard } from "../components/ui/Motion";
import { EmptyState } from "../components/ui/Feedback";
import { CalendarIcon, CheckIcon, DollarIcon, PlusIcon } from "../components/ui/Icons";
import { Badge } from "../components/ui/Badge";
import { PageHeader, SectionHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import { daysBetween, formatDay, formatMoney, isOwed, overdueLabel, sumCents } from "../utils/format";

// [totals key (whole cents), label, icon, icon colors, note(data)]
// Estimate visits are free, so the week's counts are of paid work only.
const workJobs = (data) => data.week_jobs.filter((job) => job.kind !== "estimate");

const TOTAL_CARDS = [
  ["week_scheduled_cents", "Scheduled this week", CalendarIcon, "bg-primary-soft text-primary-soft-fg",
    (data) => countLabel(workJobs(data).filter((job) => job.status !== "cancelled").length)],
  ["week_completed_cents", "Completed this week", CheckIcon, "bg-success-soft text-success-soft-fg",
    (data) => countLabel(workJobs(data).filter((job) => job.status === "completed").length)],
  ["paid_this_week_cents", "Paid this week", DollarIcon, "bg-success-soft text-success-soft-fg",
    (data) => countLabel(workJobs(data).filter((job) => job.status !== "cancelled" && job.paid).length)],
  ["unpaid_total_cents", "Owed, all time", DollarIcon, "bg-warning-soft text-warning-soft-fg",
    (data) => `${countLabel(data.totals.unpaid_count)} completed, not paid`],
];

// A month or more overdue reads as urgent.
const LATE_DAYS = 30;

function countLabel(count) {
  return `${count} ${count === 1 ? "job" : "jobs"}`;
}

function bySchedule(a, b) {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id;
}

// The same totals the server sends, from the same rules, in whole cents.
function totalsFor(weekJobs, owedJobs) {
  const activeWeek = weekJobs.filter((job) => job.status !== "cancelled");
  return {
    week_scheduled_cents: sumCents(activeWeek),
    week_completed_cents: sumCents(weekJobs.filter((job) => job.status === "completed")),
    unpaid_total_cents: sumCents(owedJobs),
    unpaid_count: owedJobs.length,
    paid_this_week_cents: sumCents(activeWeek.filter((job) => job.paid)),
  };
}

// fallback: the job as it was before an optimistic change, for when that change
// already took it off both lists (so a rollback can put it back).
function applyJobChange(current, id, patch, fallback) {
  const existing = current.week_jobs.find((job) => job.id === id)
    || current.unpaid_jobs.find((job) => job.id === id)
    || fallback;
  if (!existing) return current;
  const updated = { ...existing, ...patch };
  const weekJobs = current.week_jobs.map((job) => (job.id === id ? updated : job));
  const listed = current.unpaid_jobs.some((job) => job.id === id);
  let unpaidJobs;
  if (!isOwed(updated)) {
    // Paid, or no longer completed (scheduled or cancelled): nothing is owed.
    unpaidJobs = current.unpaid_jobs.filter((job) => job.id !== id);
  } else if (listed) {
    unpaidJobs = current.unpaid_jobs.map((job) => (job.id === id ? updated : job));
  } else {
    // Newly owed (completed, or unpaid again), so put it back in date order, oldest first.
    const owed = { ...updated, days_overdue: daysBetween(updated.date, current.today) };
    unpaidJobs = [...current.unpaid_jobs, owed].sort(bySchedule);
  }
  return {
    ...current,
    week_jobs: weekJobs,
    unpaid_jobs: unpaidJobs,
    totals: totalsFor(weekJobs, unpaidJobs),
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, setData, error } = useAsync(api, "/api/dashboard");
  // Bumped after a change in the unpaid list so the calendar shows it too.
  const [scheduleKey, setScheduleKey] = useState(0);

  // The calendar moved or added a job; the week totals and unpaid list may have changed.
  function refreshTotals() {
    api("/api/dashboard").then(setData).catch(() => {});
  }
  const [actionError, setActionError] = useState(null);
  const [pending, setPending] = useState({});
  const pendingKeys = useRef(new Set());

  async function updateJob(id, patch) {
    const key = `${id}:${Object.keys(patch)[0]}`;
    if (pendingKeys.current.has(key)) return;
    const existing = data.week_jobs.find((job) => job.id === id)
      || data.unpaid_jobs.find((job) => job.id === id);
    if (!existing) return;
    const previous = Object.fromEntries(Object.keys(patch).map((field) => [field, existing[field]]));
    pendingKeys.current.add(key);
    setPending((current) => ({ ...current, [key]: true }));
    setActionError(null);
    // Optimistic update: show the new value immediately, then roll back if the save fails.
    setData((current) => applyJobChange(current, id, patch));
    try {
      const updated = await api(`/api/jobs/${id}`, { method: "PATCH", body: patch });
      const confirmed = Object.fromEntries(Object.keys(patch).map((field) => [field, updated[field]]));
      setData((current) => applyJobChange(current, id, confirmed));
      setScheduleKey((key) => key + 1);
    } catch (err) {
      setData((current) => applyJobChange(current, id, previous, existing));
      setActionError(err);
    } finally {
      pendingKeys.current.delete(key);
      setPending((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description={`This week: ${formatDay(data.week_start)} – ${formatDay(data.week_end)}`}
        actions={
          <>
            <ButtonLink to="/jobs?new=1" variant="secondary">
              <PlusIcon />
              New job
            </ButtonLink>
            <ButtonLink to="/visits/new">
              <PlusIcon />
              New quote
            </ButtonLink>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TOTAL_CARDS.map(([key, label, Icon, iconClass, note]) => (
          <TiltCard key={key} max={9} className="glass rounded-2xl border border-border p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
              <span className={cx("hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex", iconClass)}>
                <Icon />
              </span>
            </div>
            <p className="mt-1 font-display text-xl font-bold tabular-nums tracking-tight sm:text-3xl">
              <CountUp value={data.totals[key]} format={formatMoney} />
            </p>
            <p className="mt-0.5 text-xs text-muted">{note(data)}</p>
          </TiltCard>
        ))}
      </div>
      <ErrorMessage error={actionError} />
      <Card
        title="Schedule"
        className="min-h-48"
        actions={<ButtonLink to="/schedule" variant="ghost" size="sm">Team schedule</ButtonLink>}
      >
        <TeamSchedule
          mode="owner"
          variant="dashboard"
          timezone={user.timezone}
          selfId={user.id}
          reloadKey={scheduleKey}
          onChanged={refreshTotals}
        />
      </Card>
      {data.visits_to_price?.length > 0 && <VisitsToPrice visits={data.visits_to_price} />}
      <BusinessHealthCard />
      <section>
        <SectionHeader
          title="Owed"
          description="Completed jobs that are not paid yet, oldest first. Mark them paid as payments come in."
          actions={
            data.unpaid_jobs.length > 0 && (
              <span className="text-sm text-muted">
                {countLabel(data.totals.unpaid_count)} ·{" "}
                <span className="font-semibold tabular-nums text-fg">{formatMoney(data.totals.unpaid_total_cents)}</span>
              </span>
            )
          }
        />
        {data.unpaid_jobs.length ? (
          <JobList
            jobs={data.unpaid_jobs}
            showClient
            onUpdate={updateJob}
            pending={pending}
            note={(job) => (
              <Badge tone={job.days_overdue >= LATE_DAYS ? "danger" : "warning"}>
                {overdueLabel(job.days_overdue)}
              </Badge>
            )}
          />
        ) : (
          <EmptyState
            icon={CheckIcon}
            title="Nothing is owed"
            description="Every completed job is paid. Jobs show up here once they are marked completed and still unpaid."
          />
        )}
      </section>
    </div>
  );
}

// Estimate visits that have happened whose quote is not sent yet.
function VisitsToPrice({ visits }) {
  return (
    <section>
      <SectionHeader
        title="Visits to price"
        description="The crew has been out to look. Write the quote from their photos, notes, and materials."
      />
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface shadow-card">
        {visits.map((visit) => (
          <li key={visit.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <Link to={`/jobs/${visit.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                {visit.client_name}
              </Link>
              <p className="text-sm text-muted">
                {visit.service_type} · visited {formatDay(visit.date)}
                {visit.status === "scheduled" && " (not marked done)"}
              </p>
            </div>
            {visit.visit_quote ? (
              <ButtonLink to={`/quotes/${visit.visit_quote.id}`} size="sm">
                Write the quote
              </ButtonLink>
            ) : (
              <ButtonLink to={`/jobs/${visit.id}`} size="sm" variant="secondary">
                Open visit
              </ButtonLink>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
