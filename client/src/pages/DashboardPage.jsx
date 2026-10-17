import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import WeekSchedule from "../components/WeekSchedule";
import { useAsync } from "../hooks";
import { formatDay } from "../utils/format";

function bySchedule(a, b) {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id;
}

export default function DashboardPage() {
  const { data, setData, error } = useAsync(api, "/api/dashboard");
  const [actionError, setActionError] = useState(null);

  async function updateJob(id, patch) {
    setActionError(null);
    try {
      const updated = await api(`/api/jobs/${id}`, { method: "PATCH", body: patch });
      setData((current) => {
        const weekJobs = current.week_jobs.map((job) => (job.id === id ? updated : job));
        const listed = current.unpaid_jobs.some((job) => job.id === id);
        let unpaidJobs;
        if (updated.paid) {
          unpaidJobs = current.unpaid_jobs.filter((job) => job.id !== id);
        } else if (listed) {
          unpaidJobs = current.unpaid_jobs.map((job) => (job.id === id ? updated : job));
        } else {
          // A job that was paid is unpaid again, so put it back in schedule order.
          unpaidJobs = [...current.unpaid_jobs, updated].sort(bySchedule);
        }
        return { ...current, week_jobs: weekJobs, unpaid_jobs: unpaidJobs };
      });
    } catch (err) {
      setActionError(err);
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">This week</h1>
        <p className="mt-1 text-sm text-slate-500">
          {formatDay(data.week_start)} – {formatDay(data.week_end)}
        </p>
      </div>
      <ErrorMessage error={actionError} />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Schedule</h2>
        <WeekSchedule jobs={data.week_jobs} onUpdate={updateJob} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Unpaid</h2>
        {data.unpaid_jobs.length === 0 ? (
          <p className="text-slate-500">No unpaid jobs.</p>
        ) : (
          <JobList jobs={data.unpaid_jobs} showClient onUpdate={updateJob} />
        )}
      </section>
    </div>
  );
}
