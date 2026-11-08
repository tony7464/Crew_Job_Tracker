import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { QuoteStatusBadge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/Feedback";
import { DollarIcon, InboxIcon, PlusIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { usePaged } from "../hooks";
import { formatMoney, statusLabel } from "../utils/format";
import { QUOTE_STATUSES } from "../utils/quotes";
import { formatReceived } from "../utils/requests";

const FILTERS = [["", "All"], ...QUOTE_STATUSES.map((status) => [status, statusLabel(status)])];
const SEARCH_DELAY = 300;

function QuoteTitle({ quote }) {
  return (
    <span className="block min-w-0">
      <Link to={`/quotes/${quote.id}`} className="font-medium text-fg hover:text-primary hover:underline">
        {quote.title}
      </Link>
      <span className="block text-xs text-subtle">Quote #{quote.id}</span>
    </span>
  );
}

function Customer({ quote }) {
  return (
    <span className="block text-muted">
      <span className="block text-fg">{quote.customer_name}</span>
      {quote.request ? (
        <span className="block text-xs">From a request</span>
      ) : (
        quote.client && <span className="block text-xs">Client</span>
      )}
    </span>
  );
}

function columns(timeZone) {
  return [
    { key: "title", header: "Quote", cell: (quote) => <QuoteTitle quote={quote} /> },
    { key: "customer", header: "Customer", cell: (quote) => <Customer quote={quote} /> },
    { key: "status", header: "Status", cell: (quote) => <QuoteStatusBadge quote={quote} /> },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "whitespace-nowrap font-medium tabular-nums",
      cell: (quote) => formatMoney(quote.total_cents),
    },
    {
      key: "updated",
      header: "Updated",
      align: "right",
      className: "whitespace-nowrap text-muted",
      cell: (quote) => formatReceived(quote.updated_at, timeZone),
    },
  ];
}

function MobileCard({ quote, timeZone }) {
  return (
    <Link to={`/quotes/${quote.id}`} className="-mx-4 -my-3.5 block px-4 py-3.5 active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-fg">{quote.title}</span>
        <span className="shrink-0 font-semibold tabular-nums text-fg">{formatMoney(quote.total_cents)}</span>
      </div>
      <p className="mt-0.5 truncate text-sm text-muted">{quote.customer_name}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <QuoteStatusBadge quote={quote} />
        <span className="text-xs text-subtle">{formatReceived(quote.updated_at, timeZone)}</span>
      </div>
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
            name="quote-status"
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

export default function QuotesPage() {
  const { user } = useAuth();
  // ?status= and ?q= keep the filter across reloads and shared links.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = QUOTE_STATUSES.includes(searchParams.get("status")) ? searchParams.get("status") : "";
  const q = searchParams.get("q") || "";
  const [search, setSearch] = useState(q);
  const query = new URLSearchParams({ ...(status && { status }), ...(q && { q }) }).toString();
  const { setPage, result, error } = usePaged("/api/quotes", query);

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("status", next);
    else params.delete("status");
    setSearchParams(params, { replace: true });
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

  const timeZone = user.timezone;
  const filtered = Boolean(status || q);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotes"
        description={
          result
            ? `${result.total} ${result.total === 1 ? "quote" : "quotes"}${filtered ? " found" : ""}`
            : "Prices you send to clients to accept online"
        }
        actions={
          <>
            <ButtonLink to="/quotes/new" variant="secondary">
              Quote without a visit
            </ButtonLink>
            <ButtonLink to="/visits/new">
              <PlusIcon />
              New quote
            </ButtonLink>
          </>
        }
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <StatusFilter value={status} onChange={setStatus} />
        <label className="relative block md:w-72">
          <span className="sr-only">Search quotes</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, name, email, address"
            maxLength={100}
            className="field pl-9"
          />
        </label>
      </div>
      {error ? (
        <ErrorMessage error={error} />
      ) : !result ? (
        <Loading variant="list" label="Loading quotes…" />
      ) : result.items.length ? (
        <DataTable
          columns={columns(timeZone)}
          rows={result.items}
          caption="Quotes"
          renderMobile={(quote) => <MobileCard quote={quote} timeZone={timeZone} />}
        />
      ) : filtered ? (
        <EmptyState icon={SearchIcon} title="No matching quotes" description="Try another status or search." />
      ) : (
        <EmptyState
          icon={DollarIcon}
          title="No quotes yet"
          description="Price a job for a client and send them a link to accept it. Start from a request in your inbox, or from a client."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/requests" variant="secondary">
                <InboxIcon />
                Requests
              </ButtonLink>
              <ButtonLink to="/quotes/new">
                <PlusIcon />
                Quote a client
              </ButtonLink>
            </div>
          }
        />
      )}
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
    </div>
  );
}
