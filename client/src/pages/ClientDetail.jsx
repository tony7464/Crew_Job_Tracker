import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ConfirmDelete from "../components/ConfirmDelete";
import ErrorMessage from "../components/ErrorMessage";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import { useAsync } from "../hooks";

export default function ClientDetail() {
  const { id } = useParams();
  return <ClientDetailView key={id} id={id} />;
}

function ClientDetailView({ id }) {
  const navigate = useNavigate();
  const { data: client, setData, error } = useAsync(api, `/api/clients/${id}`);

  async function save(body) {
    setData(await api(`/api/clients/${id}`, { method: "PATCH", body }));
  }

  if (error?.status === 404) return <p>Client not found.</p>;
  if (error) return <ErrorMessage error={error} />;
  if (!client) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/clients" className="text-sm text-sky-800 hover:underline">
          Back to clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{client.name}</h1>
        <dl className="mt-4 space-y-1 text-sm text-slate-700">
          <div>Address: {client.address || "—"}</div>
          <div>Phone: {client.phone || "—"}</div>
          <div>Notes: {client.notes || "—"}</div>
        </dl>
      </div>
      <section className="card">
        <h2 className="font-medium">Edit client</h2>
        <div className="mt-4">
          <ClientForm key={client.id} initial={client} onSubmit={save} submitLabel="Save changes" />
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Job history</h2>
          <Link to={`/jobs?client=${client.id}`} className="text-sm text-sky-800 hover:underline">
            Schedule a job
          </Link>
        </div>
        <div className="mt-3">
          <JobList jobs={client.jobs} />
        </div>
      </section>
      <ConfirmDelete
        label="Delete client"
        onConfirm={async () => {
          await api(`/api/clients/${id}`, { method: "DELETE" });
          navigate("/clients");
        }}
      />
    </div>
  );
}
