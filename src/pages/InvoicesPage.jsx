import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { InvoiceStatusBadge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/Feedback";
import { BriefcaseIcon, DollarIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { usePaged } from "../hooks";
import { formatMoney, statusLabel } from "../utils/format";
import { INVOICE_STATUSES } from "../utils/invoices";
import { formatDate } from "../utils/quotes";

// "attention" is not a status: it lists invoices with a payment that could not be applied.
const ATTENTION = "attention";
const FILTERS = [["", "All"], ...INVOICE_STATUSES.map((status) => [status, statusLabel(status)]), [ATTENTION, "Needs attention"]];
const SEARCH_DELAY = 300;

function InvoiceNumber({ invoice }) {
  return (
    <span className="block min-w-0">
      <Link to={`/invoices/${invoice.id}`} className="font-medium tabular-nums text-fg hover:text-primary hover:underline">
        {invoice.label}
      </Link>
      <span className="block truncate text-xs text-subtle">{invoice.title}</span>
    </span>
  );
}

function DueDate({ invoice }) {
  if (!invoice.due_date) return <span className="text-subtle">—</span>;
  return (
    <span className={invoice.overdue ? "font-medium text-warning" : "text-muted"}>{formatDate(invoice.due_date)}</span>
  );
}

const COLUMNS = [
  { key: "number", header: "Invoice", cell: (invoice) => <InvoiceNumber invoice={invoice} /> },
  {
    key: "customer",
    header: "Customer",
    cell: (invoice) => <span className="text-fg [overflow-wrap:anywhere]">{invoice.customer_name}</span>,
  },
  { key: "status", header: "Status", cell: (invoice) => <InvoiceStatusBadge invoice={invoice} /> },
  {
    key: "total",
    header: "Total",
    align: "right",
    className: "whitespace-nowrap font-medium tabular-nums",
    cell: (invoice) => formatMoney(invoice.total_cents),
  },
  {
    key: "due",
    header: "Due",
    align: "right",
    className: "whitespace-nowrap",
    cell: (invoice) => <DueDate invoice={invoice} />,
  },
];

function MobileCard({ invoice }) {
  return (
    <Link to={`/invoices/${invoice.id}`} className="-mx-4 -my-3.5 block px-4 py-3.5 active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-fg">
          <span className="tabular-nums">{invoice.label}</span>
          <span className="font-normal text-muted"> · {invoice.customer_name}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-fg">{formatMoney(invoice.total_cents)}</span>
      </div>
      <p className="mt-0.5 truncate text-sm text-muted">{invoice.title}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <InvoiceStatusBadge invoice={invoice} />
        {invoice.due_date && (
          <span className={invoice.overdue ? "text-xs font-medium text-warning" : "text-xs text-subtle"}>
            Due {formatDate(invoice.due_date)}
          </span>
        )}
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
            name="invoice-status"
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

export default function InvoicesPage() {
  // ?status= (or attention) and ?q= keep the filter across reloads and shared links.
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("status");
  const status = INVOICE_STATUSES.includes(raw) || raw === ATTENTION ? raw : "";
  const q = searchParams.get("q") || "";
  const [search, setSearch] = useState(q);
  const filter = status === ATTENTION ? { attention: "true" } : status ? { status } : {};
  const query = new URLSearchParams({ ...filter, ...(q && { q }) }).toString();
  const { setPage, result, error } = usePaged("/api/invoices", query);

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

  const filtered = Boolean(status || q);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description={
          result
            ? `${result.total} ${result.total === 1 ? "invoice" : "invoices"}${filtered ? " found" : ""}`
            : "Bills you send to clients to pay online"
        }
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusFilter value={status} onChange={setStatus} />
        <label className="relative block md:w-72 lg:shrink-0">
          <span className="sr-only">Search invoices</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search number, name, email, title"
            maxLength={100}
            className="field pl-9"
          />
        </label>
      </div>
      {error ? (
        <ErrorMessage error={error} />
      ) : !result ? (
        <Loading variant="list" label="Loading invoices…" />
      ) : result.items.length ? (
        <DataTable
          columns={COLUMNS}
          rows={result.items}
          caption="Invoices"
          renderMobile={(invoice) => <MobileCard invoice={invoice} />}
        />
      ) : status === ATTENTION && !q ? (
        <EmptyState
          icon={DollarIcon}
          title="Nothing needs attention"
          description="A payment shows up here when it could not be applied, for example if a client paid an invoice twice."
        />
      ) : filtered ? (
        <EmptyState icon={SearchIcon} title="No matching invoices" description="Try another status or search." />
      ) : (
        <EmptyState
          icon={DollarIcon}
          title="No invoices yet"
          description="Bill finished work: open a job, or an accepted quote, and choose Create invoice. The client gets a link to pay online."
          action={
            <ButtonLink to="/jobs" variant="secondary">
              <BriefcaseIcon />
              Jobs
            </ButtonLink>
          }
        />
      )}
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
    </div>
  );
}
