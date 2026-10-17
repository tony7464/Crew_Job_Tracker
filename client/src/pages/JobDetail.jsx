import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ConfirmDelete from "../components/ConfirmDelete";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import Loading from "../components/Loading";
import { useAsync } from "../hooks";

export default function JobDetail() {
  const { id } = useParams();
  return <JobDetailView key={id} id={id} />;
}

function JobDetailView({ id }) {
  const navigate = useNavigate();
  const jobState = useAsync(api, `/api/jobs/${id}`);
  const clientsState = useAsync(fetchAll, "/api/clients");
  const error = jobState.error || clientsState.error;
  const job = jobState.data;
  const clients = clientsState.data;

  async function save(body) {
    jobState.setData(await api(`/api/jobs/${id}`, { method: "PATCH", body }));
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
      <ConfirmDelete
        label="Delete job"
        onConfirm={async () => {
          await api(`/api/jobs/${id}`, { method: "DELETE" });
          navigate("/jobs");
        }}
      />
    </div>
  );
}
