import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Alert, EmptyState } from "../components/ui/Feedback";
import { BriefcaseIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAsync } from "../hooks";
import { ago, eventText, formatWhen, planLabel } from "../utils/admin";

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function BusinessRow({ business }) {
  return (
    <li>
      <Link
        to={`/admin/businesses/${business.id}`}
        className="grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:px-5"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-fg [overflow-wrap:anywhere]">{business.business_name || "No business name"}</span>
            {!business.is_active && <Badge tone="danger">Turned off</Badge>}
            {!business.email_verified && <Badge tone="warning">Email not verified</Badge>}
            {business.support_access_until && <Badge tone="primary">Support access on</Badge>}
          </span>
          <span className="block text-sm text-muted [overflow-wrap:anywhere]">
            {[business.owner_name, business.email].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="text-sm text-muted">
          <span className="block text-fg">{planLabel(business)}</span>
          {business.crew + 1} {business.crew === 0 ? "person" : "people"} · {business.clients}{" "}
          {business.clients === 1 ? "client" : "clients"} · {business.jobs} {business.jobs === 1 ? "job" : "jobs"}
        </span>
        <span className="text-sm text-muted">
          <span className="block">Joined {business.created_at ? ago(business.created_at).toLowerCase() : "before records began"}</span>
          Last login: {ago(business.last_login_at).toLowerCase()}
        </span>
      </Link>
    </li>
  );
}

function Businesses() {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Search a moment after the typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(typed.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    api(`/api/admin/businesses?${params}`)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [page, query]);

  if (error) return <ErrorMessage error={error} />;
  if (!result) return <Loading variant="list" label="Loading businesses…" />;

  const { summary } = result;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Businesses" value={summary.businesses} />
        <Tile label="New in 30 days" value={summary.new_30_days} />
        <Tile label="Support access on" value={summary.support_access_on} hint="Owners who are letting support look now" />
      </div>
      <label className="relative block">
        <span className="sr-only">Search businesses</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Search by business, owner, or email"
          maxLength={100}
          className="field pl-9"
        />
      </label>
      {result.items.length ? (
        <Card flush title={query ? `${result.total} found` : "Newest first"}>
          <ul className="divide-y divide-border">
            {result.items.map((business) => (
              <BusinessRow key={business.id} business={business} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          icon={BriefcaseIcon}
          title={query ? "No business matches" : "No businesses yet"}
          description={query ? "Try part of the business name, the owner's name, or their email." : "Businesses appear here as owners sign up."}
        />
      )}
      <Pagination page={result.page} pages={result.pages} onPage={setPage} />
    </div>
  );
}

// Web addresses of their own that owners asked for and nobody has connected yet.
function WaitingAddresses() {
  const { data } = useAsync(api, "/api/admin/site-domains");
  if (!data?.waiting.length) return null;
  return (
    <Card
      title="Web addresses waiting to be connected"
      description="An owner asked to use an address of their own. Open the business to see whether they have proved it is theirs. If so, add it to the web service at the host, wait for its certificate, and press Connect."
    >
      <ul className="-my-2 divide-y divide-border">
        {data.waiting.map((entry) => (
          <li key={entry.business_id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
            <Link to={`/admin/businesses/${entry.business_id}`} className="link min-w-0 [overflow-wrap:anywhere]">{entry.domain}</Link>
            <span className="text-muted [overflow-wrap:anywhere]">{entry.business_name}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecentActivity() {
  const { data, error } = useAsync(api, "/api/admin/events?per_page=15");
  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;
  return (
    <Card title="Recent activity" description="What admins did and what owners allowed. The record cannot be edited.">
      {data.items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="-my-2 divide-y divide-border">
          {data.items.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
              <span className="min-w-0 text-fg [overflow-wrap:anywhere]">
                {eventText(event)}
                {event.business_id && (
                  <>
                    {" · "}
                    <Link to={`/admin/businesses/${event.business_id}`} className="link">
                      {event.business_name || "Business"}
                    </Link>
                  </>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">{formatWhen(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Every business that has signed up. For the people who run Crew Job Tracker only.
export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Carried here from a business's page after it was deleted. Shown once: a reload does not say it again.
  const [gone] = useState(location.state?.deleted ? location.state : null);
  const hasState = Boolean(location.state);
  useEffect(() => {
    if (hasState) navigate(location.pathname, { replace: true, state: null });
  }, [hasState, navigate, location.pathname]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Admin"
        description="Every business that has signed up. You see who they are and how big they are, not their customers or jobs. To see what an owner sees, they turn on support access first."
      />
      <div className="space-y-6">
        {gone && (
          <Alert tone="success" title={`${gone.deleted} was deleted`}>
            The business, its people and everything in it are gone.
            {gone.emailed && " Its owner has been emailed."}
            {gone.domain && ` Its website's address ${gone.domain} is still attached at the host: remove it there.`}
          </Alert>
        )}
        <WaitingAddresses />
        <Businesses />
        <RecentActivity />
      </div>
    </div>
  );
}
