import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ClientList from "../components/ClientList";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { usePaged } from "../hooks";

export default function ClientsPage() {
  const { setPage, result, error, reset } = usePaged("/api/clients");

  async function createClient(body) {
    await api("/api/clients", { method: "POST", body });
    reset();
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
