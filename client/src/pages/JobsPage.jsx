import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import JobList from "../components/JobList";
import Loading from "../components/Loading";

export default function JobsPage() {
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client");
  const [clients, setClients] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState("");

  useEffect(() => {
    api("/api/clients")
      .then(setClients)
      .catch(setError);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (paid) params.set("paid", paid);
    const query = params.toString();
    api(`/api/jobs${query ? `?${query}` : ""}`)
      .then(setJobs)
      .catch(setError);
  }, [status, paid]);

  function matches(job) {
    if (status && job.status !== status) return false;
    if (paid === "true" && !job.paid) return false;
    if (paid === "false" && job.paid) return false;
    return true;
  }

  async function createJob(body) {
    const created = await api("/api/jobs", { method: "POST", body });
    if (matches(created)) {
      setJobs((current) =>
        [...current, created].sort(
          (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        ),
      );
    }
  }

  async function updateJob(id, patch) {
    setActionError(null);
    try {
      const updated = await api(`/api/jobs/${id}`, { method: "PATCH", body: patch });
      setJobs((current) =>
        current.flatMap((job) => {
          if (job.id !== id) return [job];
          return matches(updated) ? [updated] : [];
        }),
      );
    } catch (err) {
      setActionError(err);
    }
  }

  async function deleteJob(id) {
    setActionError(null);
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      setJobs((current) => current.filter((job) => job.id !== id));
    } catch (err) {
      setActionError(err);
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!clients || !jobs) return <Loading />;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <div className="card mt-4">
          <h2 className="font-medium">Schedule a job</h2>
          <div className="mt-4">
            <JobForm
              clients={clients}
              initial={presetClient ? { client_id: presetClient } : null}
              onSubmit={createJob}
              submitLabel="Add job"
            />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Status{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1"
            >
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-sm">
            Paid{" "}
            <select
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1"
            >
              <option value="">All</option>
              <option value="true">Paid</option>
              <option value="false">Unpaid</option>
            </select>
          </label>
        </div>
        <ErrorMessage error={actionError} />
        <JobList
          jobs={jobs}
          showClient
          onUpdate={updateJob}
          onDelete={deleteJob}
          empty={status || paid ? "No jobs match these filters." : "No jobs yet."}
        />
      </section>
    </div>
  );
}
