import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ErrorMessage from "../components/ErrorMessage";
import JobList from "../components/JobList";
import Loading from "../components/Loading";

export default function ClientDetail() {
  const { id } = useParams();
  return <ClientDetailView key={id} id={id} />;
}

function ClientDetailView({ id }) {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/clients/${id}`)
      .then((data) => {
        if (!cancelled) setClient(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(body) {
    const updated = await api(`/api/clients/${id}`, { method: "PATCH", body });
    setClient(updated);
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/api/clients/${id}`, { method: "DELETE" });
      navigate("/clients");
    } catch (err) {
      setDeleteError(err);
      setDeleting(false);
    }
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
          <ClientForm
            key={client.id}
            initial={client}
            onSubmit={save}
            submitLabel="Save changes"
          />
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
          Delete client
        </button>
      )}
    </div>
  );
}
