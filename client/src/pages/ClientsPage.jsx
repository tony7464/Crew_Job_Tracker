import { useEffect, useState } from "react";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ClientList from "../components/ClientList";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";

export default function ClientsPage() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/clients")
      .then(setClients)
      .catch(setError);
  }, []);

  async function createClient(body) {
    const created = await api("/api/clients", { method: "POST", body });
    setClients((current) => [...current, created]);
  }

  if (error) return <ErrorMessage error={error} />;
  if (!clients) return <Loading />;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="mt-4 rounded border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Add a client</h2>
          <div className="mt-4">
            <ClientForm onSubmit={createClient} submitLabel="Add client" />
          </div>
        </div>
      </section>
      <ClientList clients={clients} />
    </div>
  );
}
