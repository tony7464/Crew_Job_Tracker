import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ClientList from "../components/ClientList";
import ErrorMessage from "../components/ErrorMessage";
import { Checkbox } from "../components/Field";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";
import { PlusIcon, UsersIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { usePaged } from "../hooks";

export default function ClientsPage() {
  // ?archived=1 keeps "Show archived" on across reloads and shared links.
  const [searchParams, setSearchParams] = useSearchParams();
  const showArchived = searchParams.get("archived") === "1";
  const { setPage, result, error, reset } = usePaged("/api/clients", showArchived ? "include_archived=true" : "");
  const [adding, setAdding] = useState(false);

  function toggleArchived(event) {
    const next = new URLSearchParams(searchParams);
    if (event.target.checked) next.set("archived", "1");
    else next.delete("archived");
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  async function createClient(body) {
    await api("/api/clients", { method: "POST", body });
    reset();
    setAdding(false);
  }

  if (error) return <ErrorMessage error={error} />;
  if (!result) return <Loading />;

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <PlusIcon />
      Add client
    </Button>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        description={`${result.total} ${result.total === 1 ? "client" : "clients"}${showArchived ? ", including archived" : ""}`}
        actions={addButton}
      />
      <Checkbox
        label="Show archived"
        description="Archived clients are hidden from lists and the job form. Their jobs are kept."
        checked={showArchived}
        onChange={toggleArchived}
      />
      {result.items.length ? (
        <ClientList clients={result.items} />
      ) : (
        <EmptyState
          icon={UsersIcon}
          title={showArchived ? "No clients yet" : "No active clients"}
          description={
            showArchived
              ? "Add the homes and businesses you work for, then schedule jobs for them."
              : "Add the homes and businesses you work for, or turn on Show archived to see archived clients."
          }
          action={addButton}
        />
      )}
      <Pagination page={result.page} pages={result.pages} onPage={setPage} />
      {adding && (
        <Modal title="Add a client" onClose={() => setAdding(false)}>
          <ClientForm onSubmit={createClient} onCancel={() => setAdding(false)} submitLabel="Add client" />
        </Modal>
      )}
    </div>
  );
}
