import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { RequestStatusBadge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/Feedback";
import { CameraIcon, InboxIcon, SearchIcon, SettingsIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { usePaged } from "../hooks";
import { statusLabel } from "../utils/format";
import { REQUEST_STATUSES, formatReceived } from "../utils/requests";
import { isOwner } from "../utils/roles";

const FILTERS = [["", "All"], ...REQUEST_STATUSES.map((status) => [status, statusLabel(status)])];
const SEARCH_DELAY = 300;

function UnreadDot({ request }) {
  if (request.seen) return <span className="inline-block h-2 w-2 shrink-0" aria-hidden="true" />;
  return (
    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" title="Not opened yet">
      <span className="sr-only">Unread</span>
    </span>
  );
}

function RequestName({ request }) {
  return (
    <span className="inline-flex items-center gap-2">
      <UnreadDot request={request} />
      <Link
        to={`/requests/${request.id}`}
        className={cx("hover:text-primary hover:underline", request.seen ? "font-medium text-fg" : "font-semibold text-fg")}
      >
        {request.name}
      </Link>
    </span>
  );
}

// Phone and email on their own lines, so an email only wraps when it cannot fit.
function Contact({ request }) {
  if (!request.phone && !request.email) return <span className="text-subtle">—</span>;
  return (
    <span className="block text-muted">
      {request.phone && <span className="block whitespace-nowrap">{request.phone}</span>}
      {request.email && <span className="block [overflow-wrap:anywhere]">{request.email}</span>}
    </span>
  );
}

function PhotoCount({ count }) {
  if (!count) return <span className="text-subtle">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-muted" title={`${count} ${count === 1 ? "photo" : "photos"}`}>
      <CameraIcon className="h-4 w-4" />
      {count}
      <span className="sr-only">{count === 1 ? "photo" : "photos"}</span>
    </span>
  );
}

function columns(timeZone) {
  return [
    { key: "name", header: "Client", cell: (request) => <RequestName request={request} /> },
    { key: "service", header: "Service", cell: (request) => request.service_type },
    { key: "contact", header: "Contact", className: "max-w-56", cell: (request) => <Contact request={request} /> },
    { key: "photos", header: "Photos", cell: (request) => <PhotoCount count={request.photo_count} /> },
    { key: "status", header: "Status", cell: (request) => <RequestStatusBadge status={request.status} /> },
    {
      key: "received",
      header: "Received",
      align: "right",
      className: "whitespace-nowrap text-muted",
      cell: (request) => formatReceived(request.created_at, timeZone),
    },
  ];
}

function MobileCard({ request, timeZone }) {
  return (
    <Link to={`/requests/${request.id}`} className="-mx-4 -my-3.5 block px-4 py-3.5 active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <UnreadDot request={request} />
          <span className={cx("truncate text-fg", request.seen ? "font-medium" : "font-semibold")}>{request.name}</span>
        </span>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="mt-1 pl-4 text-sm text-fg">
        {request.service_type}
        {request.photo_count > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-muted">
            <CameraIcon className="h-3.5 w-3.5" />
            {request.photo_count}
          </span>
        )}
      </p>
      <p className="mt-0.5 truncate pl-4 text-sm text-muted">{request.address}</p>
      <p className="mt-0.5 pl-4 text-xs text-subtle">{formatReceived(request.created_at, timeZone)}</p>
    </Link>
  );
}

function StatusFilter({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Status"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      data-noswipe
    >
      {FILTERS.map(([status, label]) => (
        <label
          key={status || "all"}
          className="shrink-0 cursor-pointer rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-fg has-focus-visible:ring-4 has-focus-visible:ring-ring"
        >
          <input
            type="radio"
            name="request-status"
            value={status}
            checked={value === status}
            onChange={() => onChange(status)}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  // ?status= and ?q= keep the filter across reloads and shared links.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = REQUEST_STATUSES.includes(searchParams.get("status")) ? searchParams.get("status") : "";
  const q = searchParams.get("q") || "";
  const [search, setSearch] = useState(q);
  const query = new URLSearchParams({ ...(status && { status }), ...(q && { q }) }).toString();
  const { setPage, result, error } = usePaged("/api/requests", query);

  function updateParams(patch) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
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

  const owner = isOwner(user);
  const timeZone = user.timezone;
  const filtered = Boolean(status || q);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Requests"
        description={
          result
            ? `${result.total} ${result.total === 1 ? "request" : "requests"}${filtered ? " found" : ""}`
            : "Requests sent through your request form"
        }
        actions={
          owner && (
            <ButtonLink to="/settings" variant="secondary">
              <SettingsIcon />
              Request form
            </ButtonLink>
          )
        }
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <StatusFilter value={status} onChange={(next) => updateParams({ status: next })} />
        <label className="relative block md:w-80">
          <span className="sr-only">Search requests</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, email, address"
            maxLength={100}
            className="field pl-9"
          />
        </label>
      </div>
      {error ? (
        <ErrorMessage error={error} />
      ) : !result ? (
        <Loading variant="list" label="Loading requests…" />
      ) : result.items.length ? (
        <DataTable
          columns={columns(timeZone)}
          rows={result.items}
          caption="Requests"
          renderMobile={(request) => <MobileCard request={request} timeZone={timeZone} />}
        />
      ) : filtered ? (
        <EmptyState
          icon={SearchIcon}
          title="No matching requests"
          description="Try another status or search."
        />
      ) : (
        <EmptyState
          icon={InboxIcon}
          title="No requests yet"
          description={
            owner
              ? "Share your request form link with clients. What they send shows up here."
              : "Requests that clients send through the business's request form show up here."
          }
          action={owner && <ButtonLink to="/settings">Get your form link</ButtonLink>}
        />
      )}
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
    </div>
  );
}
