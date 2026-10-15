import { useEffect, useState } from "react";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ClientList from "../components/ClientList";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api(`/api/clients?page=${page}`)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  async function createClient(body) {
    await api("/api/clients", { method: "POST", body });
    if (page !== 1) setPage(1);
    else setReloadKey((key) => key + 1);
  }

  if (error) return <ErrorMessage error={error} />;
  if (!result) return <Loading />;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="card mt-4">
          <h2 className="font-medium">Add a client</h2>
          <div className="mt-4">
            <ClientForm onSubmit={createClient} submitLabel="Add client" />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <ClientList clients={result.items} />
        <Pagination page={result.page} pages={result.pages} onPage={setPage} />
      </section>
    </div>
  );
}