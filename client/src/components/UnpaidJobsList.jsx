import JobList from "./JobList";

export default function UnpaidJobsList({ jobs, onUpdate }) {
  if (!jobs.length) {
    return <p className="text-slate-500">No unpaid jobs.</p>;
  }

  return <JobList jobs={jobs} showClient onUpdate={onUpdate} />;
}
