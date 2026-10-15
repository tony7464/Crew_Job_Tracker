import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import Loading from "../components/Loading";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setJob(null);
    setError(null);
    api(`/api/jobs/${id}`)
      .then(setJob)
      .catch(setError);
    fetchAll("/api/clients")
      .then(setClients)
      .catch(setError);
  }, [id]);

  async function save(body) {
    const updated = await api(`/api/jobs/${id}`, { method: "PATCH", body });
    setJob(updated);
  }

  async function remove() {
    await api(`/api/jobs/${id}`, { method: "DELETE" });
    navigate("/jobs");
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
      {confirming ? (
        <button
          type="button"
          onClick={remove}
          className="rounded border border-red-300 px-4 py-2 text-sm text-red-700"
        >
          Confirm delete
        </button>
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
