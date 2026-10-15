import JobList from "./JobList";

function formatDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function WeekSchedule({ jobs, onUpdate }) {
  if (!jobs.length) {
    return <p className="text-slate-500">No jobs this week.</p>;
  }

  const days = [];
  for (const job of jobs) {
    const last = days.at(-1);
    if (!last || last.date !== job.date) days.push({ date: job.date, jobs: [job] });
    else last.jobs.push(job);
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.date}>
          <h3 className="mb-2 text-sm font-medium text-slate-500">{formatDay(day.date)}</h3>
          <JobList jobs={day.jobs} showClient onUpdate={onUpdate} />
        </section>
      ))}
    </div>
  );
}
