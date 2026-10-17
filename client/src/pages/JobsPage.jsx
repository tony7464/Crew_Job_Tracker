import { useState } from "react";
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

  async function changeJob(id, method, body) {
    setActionError(null);
    try {
      await api(`/api/jobs/${id}`, { method, body });
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
          onUpdate={(id, patch) => changeJob(id, "PATCH", patch)}
          onDelete={(id) => changeJob(id, "DELETE")}
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
