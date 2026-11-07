import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/Button";
import { PlusIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { useAsync, usePaged } from "../hooks";
import { STATUSES, statusLabel } from "../utils/format";
import { createJob as addJob } from "../utils/series";

export default function JobsPage() {
  // ?new=1 opens the new-job form; ?client=<id> also picks the client.
  const [searchParams, setSearchParams] = useSearchParams();
  const presetClient = searchParams.get("client");
  const [creating, setCreating] = useState(() => Boolean(presetClient || searchParams.get("new")));
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState("");
  const [actionError, setActionError] = useState(null);
  const [pending, setPending] = useState({});
  const pendingKeys = useRef(new Set());
  const query = [status && `status=${status}`, paid && `paid=${paid}`].filter(Boolean).join("&");
  const clientsState = useAsync(fetchAll, "/api/clients");
  const employeesState = useAsync(api, "/api/employees");
  const jobsState = usePaged("/api/jobs", query);

  function pick(setter) {
    return (value) => {
      setter(value);
      jobsState.setPage(1);
    };
  }

  function closeForm() {
    setCreating(false);
    if (searchParams.size) setSearchParams({}, { replace: true });
  }

  async function createJob(body) {
    await addJob(body);
    jobsState.reset();
    closeForm();
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

  const error = clientsState.error || employeesState.error || jobsState.error;
  if (error) return <ErrorMessage error={error} />;
  if (!clientsState.data || !employeesState.data || !jobsState.result) return <Loading />;

  const statusOptions = [["", "All statuses"], ...STATUSES.map((item) => [item, statusLabel(item)])];
  const paidOptions = [["", "Paid and unpaid"], ["true", "Paid"], ["false", "Unpaid"]];
  const total = jobsState.result.total;
  // The client list leaves out archived clients, so a link for one opens a blank form.
  const presetActive = presetClient && clientsState.data.some((client) => String(client.id) === presetClient);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Every job in your business, soonest date first."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            New job
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Filter label="Status" value={status} onChange={pick(setStatus)} options={statusOptions} />
        <Filter label="Paid" value={paid} onChange={pick(setPaid)} options={paidOptions} />
        <span className="ml-auto text-sm text-muted">
          {total} {total === 1 ? "job" : "jobs"}
        </span>
      </div>
      <ErrorMessage error={actionError} />
      <JobList
        jobs={jobsState.result.items}
        showClient
        onUpdate={updateJob}
        onDelete={deleteJob}
        pending={pending}
        empty={status || paid ? "No jobs match these filters." : "No jobs yet."}
        emptyAction={
          status || paid ? null : (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              Schedule your first job
            </Button>
          )
        }
      />
      <Pagination page={jobsState.result.page} pages={jobsState.result.pages} onPage={jobsState.setPage} />
      {creating && (
        <Modal title="New job" description="Times are in your business time zone." onClose={closeForm} size="lg">
          <JobForm
            clients={clientsState.data}
            employees={employeesState.data}
            initial={presetActive ? { client_id: presetClient } : null}
            onSubmit={createJob}
            onCancel={closeForm}
            submitLabel="Add job"
          />
        </Modal>
      )}
    </div>
  );
}

function Filter({ label, value, onChange, options }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field-sm h-9 pr-8">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}
