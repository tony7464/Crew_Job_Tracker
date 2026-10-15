import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import Loading from "../components/Loading";

export default function JobDetail() {
  const { id } = useParams();
  return <JobDetailView key={id} id={id} />;
}

function JobDetailView({ id }) {
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/jobs/${id}`)
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    fetchAll("/api/clients")
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(body) {
    const updated = await api(`/api/jobs/${id}`, { method: "PATCH", body });
    setJob(updated);
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      navigate("/jobs");
    } catch (err) {
      setDeleteError(err);
      setDeleting(false);
    }
  }

  if (error?.status === 404) return <p>Job not found.</p>;
  if (error) return <ErrorMessage error={error} />;
  if (!job || !clients) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/jobs" className="text-sm text-sky-800 hover:underline">
          Back to jobs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{job.service_type}</h1>
        <p className="mt-1 text-sm text-slate-600">{job.client_name}</p>
      </div>
      <section className="card">
        <h2 className="font-medium">Edit job</h2>
        <div className="mt-4">
          <JobForm
            key={`${job.id}-${job.status}-${job.paid}`}
            clients={clients}
            initial={job}
            onSubmit={save}
            submitLabel="Save changes"
          />
        </div>
      </section>
      <ErrorMessage error={deleteError} />
      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="text-sm text-slate-600 hover:underline disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-700 hover:underline"
        >
          Delete job
        </button>
      )}
    </div>
  );
}
