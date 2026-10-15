import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";

export default function JobsPage() {
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client");
  const [clients, setClients] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchAll("/api/clients")
      .then(setClients)
      .catch(setError);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (paid) params.set("paid", paid);
    let cancelled = false;
    api(`/api/jobs?${params}`)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [status, paid, page, reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function createJob(body) {
    await api("/api/jobs", { method: "POST", body });
    if (page !== 1) setPage(1);
    else reload();
  }

  async function updateJob(id, patch) {
    setActionError(null);
    try {
      await api(`/api/jobs/${id}`, { method: "PATCH", body: patch });
      reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function deleteJob(id) {
    setActionError(null);
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(err);
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!clients || !result) return <Loading />;

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
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
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
              onChange={(event) => {
                setPaid(event.target.value);
                setPage(1);
              }}
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
          jobs={result.items}
          showClient
          onUpdate={updateJob}
          onDelete={deleteJob}
          empty={status || paid ? "No jobs match these filters." : "No jobs yet."}
        />
        <Pagination page={result.page} pages={result.pages} onPage={setPage} />
      </section>
    </div>
  );
}
