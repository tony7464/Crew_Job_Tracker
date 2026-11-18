import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ClientList from "../components/ClientList";
import ErrorMessage from "../components/ErrorMessage";
import { Checkbox } from "../components/Field";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";
import { PlusIcon, SearchIcon, UsersIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { usePaged } from "../hooks";
import { isSearchShortcut } from "../utils/clientSearch";
import { isOwner } from "../utils/roles";

const SEARCH_DELAY = 300;

export default function ClientsPage() {
  // ?archived=1 and ?q= keep "Show archived" and the search across reloads and shared links.
  const [searchParams, setSearchParams] = useSearchParams();
  const showArchived = searchParams.get("archived") === "1";
  // The server takes at most 100 characters: a longer q in a link is cut, not refused.
  const q = (searchParams.get("q") || "").slice(0, 100);
  const [search, setSearch] = useState(q);
  const query = new URLSearchParams({ ...(showArchived && { include_archived: "true" }), ...(q && { q }) }).toString();
  const { setPage, result, error, reset } = usePaged("/api/clients", query);
  const [adding, setAdding] = useState(false);
  const searchBox = useRef(null);
  const { user } = useAuth();

  function toggleArchived(event) {
    const next = new URLSearchParams(searchParams);
    if (event.target.checked) next.set("archived", "1");
    else next.delete("archived");
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  // Search a moment after typing stops.
  useEffect(() => {
    if (search.trim() === q) return undefined;
    const id = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      setSearchParams(next, { replace: true });
      setPage(1);
    }, SEARCH_DELAY);
    return () => clearTimeout(id);
  }, [search, q, searchParams, setSearchParams, setPage]);

  // "/" jumps to the search box, unless you are typing in a field.
  useEffect(() => {
    function onKey(event) {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      searchBox.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function createClient(body) {
    await api("/api/clients", { method: "POST", body });
    reset();
    setAdding(false);
  }

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
        description={
          result
            ? `${result.total} ${result.total === 1 ? "client" : "clients"}${q ? " found" : ""}${showArchived ? ", including archived" : ""}`
            : "The homes and businesses you work for"
        }
        actions={
          <>
            {isOwner(user) && (
              <ButtonLink to="/import" variant="secondary">
                Import or export
              </ButtonLink>
            )}
            {addButton}
          </>
        }
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Checkbox
          label="Show archived"
          description="Archived clients are hidden from lists and the job form. Their jobs are kept."
          checked={showArchived}
          onChange={toggleArchived}
        />
        <label className="relative block md:w-96 md:shrink-0">
          <span className="sr-only">Search clients</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            ref={searchBox}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, email, address, notes"
            maxLength={100}
            aria-keyshortcuts="/"
            className="field pl-9 min-h-11"
          />
        </label>
        {/* What a screen reader hears when a search's results arrive. */}
        <span role="status" className="sr-only">
          {q && result ? (result.total ? `${result.total} ${result.total === 1 ? "client" : "clients"} found` : "No matching clients") : ""}
        </span>
      </div>
      {error ? (
        <ErrorMessage error={error} />
      ) : !result ? (
        <Loading variant="list" label="Loading clients…" />
      ) : result.items.length ? (
        <ClientList clients={result.items} query={q} />
      ) : q ? (
        <EmptyState
          icon={SearchIcon}
          title="No matching clients"
          description={
            showArchived
              ? "Try another search."
              : "Try another search, or turn on Show archived to search archived clients too."
          }
        />
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
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
      {adding && (
        <Modal title="Add a client" onClose={() => setAdding(false)}>
          <ClientForm onSubmit={createClient} onCancel={() => setAdding(false)} submitLabel="Add client" />
        </Modal>
      )}
    </div>
  );
}
