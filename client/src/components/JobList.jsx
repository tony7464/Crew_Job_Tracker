import { useState } from "react";
import { Link } from "react-router-dom";
import { formatMoney, formatTime } from "../utils/format";

const STATUSES = ["scheduled", "completed", "cancelled"];

const badgeClass = {
  scheduled: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-600",
};

export default function JobList({ jobs, showClient = false, onUpdate, onDelete, empty = "No jobs yet." }) {
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function confirmDelete(id) {
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  if (!jobs.length) {
    return <p className="text-slate-500">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
      {jobs.map((job) => (
        <li
          key={job.id}
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">
              <Link to={`/jobs/${job.id}`} className="hover:underline">
                {job.service_type}
              </Link>{" "}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass[job.status]}`}>
                {job.status}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {showClient && job.client_name ? `${job.client_name} · ` : ""}
              {job.date} {formatTime(job.time)} · {formatMoney(job.price)}
              {job.paid ? " · Paid" : " · Unpaid"}
            </p>
          </div>
          {onUpdate && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label={`Status for ${job.service_type}`}
                value={job.status}
                onChange={(event) => onUpdate(job.id, { status: event.target.value })}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={job.paid}
                  onChange={(event) => onUpdate(job.id, { paid: event.target.checked })}
                />
                Paid
              </label>
              {onDelete &&
                (confirmId === job.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => confirmDelete(job.id)}
                      disabled={deletingId === job.id}
                      className="text-sm text-red-700 hover:underline disabled:opacity-60"
                    >
                      {deletingId === job.id ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={deletingId === job.id}
                      className="text-sm text-slate-600 hover:underline disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(job.id)}
                    className="text-sm text-slate-500 hover:underline"
                  >
                    Delete
                  </button>
                ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
