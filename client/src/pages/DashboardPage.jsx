import { useEffect, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import UnpaidJobsList from "../components/UnpaidJobsList";
import WeekSchedule from "../components/WeekSchedule";

function formatDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    api("/api/dashboard")
      .then(setData)
      .catch(setError);
  }, []);

  async function updateJob(id, patch) {
    setActionError(null);
    try {
      const updated = await api(`/api/jobs/${id}`, { method: "PATCH", body: patch });
      setData((current) => ({
        ...current,
        week_jobs: current.week_jobs.map((job) => (job.id === id ? updated : job)),
        unpaid_jobs: updated.paid
          ? current.unpaid_jobs.filter((job) => job.id !== id)
          : current.unpaid_jobs.some((job) => job.id === id)
            ? current.unpaid_jobs.map((job) => (job.id === id ? updated : job))
            : [...current.unpaid_jobs, updated],
      }));
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
        <UnpaidJobsList jobs={data.unpaid_jobs} onUpdate={updateJob} />
      </section>
    </div>
  );
}
