export default function JobList({ jobs }) {
  if (!jobs.length) {
    return <p className="text-slate-500">No jobs yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
      {jobs.map((job) => (
        <li key={job.id} className="px-4 py-3 text-sm">
          <span className="font-medium">{job.service_type}</span>
          <span className="mt-1 block text-slate-600">
            {job.date} {job.time} · {job.status} · ${job.price} · {job.paid ? "Paid" : "Unpaid"}
          </span>
        </li>
      ))}
    </ul>
  );
}
