import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { useAsync, usePaged } from "../hooks";
import { STATUSES, statusLabel } from "../utils/format";

const selectClass = "rounded border border-slate-300 bg-white px-2 py-1";

export default function JobsPage() {
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client");
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState("");
  const [actionError, setActionError] = useState(null);
  const [pending, setPending] = useState({});
  const pendingKeys = useRef(new Set());
  const query = [status && `status=${status}`, paid && `paid=${paid}`].filter(Boolean).join("&");
  const clientsState = useAsync(fetchAll, "/api/clients");
  const jobsState = usePaged("/api/jobs", query);

  function pick(setter) {
    return (value) => {
      setter(value);
      jobsState.setPage(1);
    };
  }

  async function createJob(body) {
    await api("/api/jobs", { method: "POST", body });
    jobsState.reset();
  }

  async function updateJob(id, patch) {
    const key = `${id}:${Object.keys(patch)[0]}`;
    if (pendingKeys.current.has(key)) return;
    const existing = jobsState.result.items.find((job) => job.id === id);
    if (!existing) return;
    const previous = Object.fromEntries(Object.keys(patch).map((field) => [field, existing[field]]));
    pendingKeys.current.add(key);
    setPending((current) => ({ ...current, [key]: true }));
    setActionError(null);
    // Optimistic update: show the new value immediately, then roll back if the save fails.
    jobsState.setResult((current) => ({
      ...current,
      items: current.items.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    }));
    try {
      await api(`/api/jobs/${id}`, { method: "PATCH", body: patch });
      jobsState.reload();
    } catch (err) {
      jobsState.setResult((current) => ({
        ...current,
        items: current.items.map((job) => (job.id === id ? { ...job, ...previous } : job)),
      }));
      setActionError(err);
    } finally {
      pendingKeys.current.delete(key);
      setPending((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function deleteJob(id) {
    setActionError(null);
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      jobsState.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  const error = clientsState.error || jobsState.error;
  if (error) return <ErrorMessage error={error} />;
  if (!clientsState.data || !jobsState.result) return <Loading />;

  const statusOptions = [["", "All"], ...STATUSES.map((item) => [item, statusLabel(item)])];
  const paidOptions = [["", "All"], ["true", "Paid"], ["false", "Unpaid"]];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <div className="card mt-4">
          <h2 className="font-medium">Schedule a job</h2>
          <div className="mt-4">
            <JobForm
              clients={clientsState.data}
              initial={presetClient ? { client_id: presetClient } : null}
              onSubmit={createJob}
              submitLabel="Add job"
            />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Filter label="Status" value={status} onChange={pick(setStatus)} options={statusOptions} />
          <Filter label="Paid" value={paid} onChange={pick(setPaid)} options={paidOptions} />
        </div>
        <ErrorMessage error={actionError} />
        <JobList
          jobs={jobsState.result.items}
          showClient
          onUpdate={updateJob}
          onDelete={deleteJob}
          pending={pending}
          empty={status || paid ? "No jobs match these filters." : "No jobs yet."}
        />
        <Pagination page={jobsState.result.page} pages={jobsState.result.pages} onPage={jobsState.setPage} />
      </section>
    </div>
  );
}

function Filter({ label, value, onChange, options }) {
  return (
    <label className="text-sm">
      {label}{" "}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}
