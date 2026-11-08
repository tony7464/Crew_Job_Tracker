import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm";
import ConfirmDelete from "../components/ConfirmDelete";
import ErrorMessage from "../components/ErrorMessage";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import MapLink from "../components/MapLink";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert, EmptyState } from "../components/ui/Feedback";
import { CalendarIcon, DollarIcon, MailIcon, MapPinIcon, PhoneIcon, PlusIcon } from "../components/ui/Icons";
import { PageHeader, SectionHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import { isOwner } from "../utils/roles";

export default function ClientDetail() {
  const { id } = useParams();
  return <ClientDetailView key={id} id={id} />;
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 shrink-0 text-muted">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}

function jobCount(count) {
  return `${count} ${count === 1 ? "job" : "jobs"}`;
}

function upcomingWarning(count) {
  if (!count) return "This client has no upcoming scheduled jobs.";
  return `This client has ${count} upcoming scheduled ${count === 1 ? "job" : "jobs"}. ${
    count === 1 ? "It stays" : "They stay"
  } on the calendar; cancel or move ${count === 1 ? "it" : "them"} separately if needed.`;
}

// Archive or unarchive. Archiving is reversible and keeps every job, so owners and
// employees with client access can both do it. Unarchiving needs no confirmation.
function ArchiveCard({ client, onArchive }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(archived) {
    setBusy(true);
    setError(null);
    try {
      await onArchive(archived);
      setConfirming(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-fg">{client.archived ? "Unarchive client" : "Archive client"}</p>
          <p className="mt-0.5 text-sm text-muted">
            {client.archived
              ? "Shows this client in client lists and the job form again, so you can schedule jobs for them."
              : "Hides this client from client lists and the job form. Their jobs and payment history are kept."}
          </p>
        </div>
        {client.archived ? (
          <Button variant="secondary" onClick={() => run(false)} disabled={busy}>
            {busy ? "Unarchiving…" : "Unarchive"}
          </Button>
        ) : (
          !confirming && (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Archive
            </Button>
          )
        )}
      </div>
      {confirming && !client.archived && (
        <div className="mt-3 space-y-3">
          <Alert tone="warning">{upcomingWarning(client.upcoming_jobs_count)}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(true)} disabled={busy}>
              {busy ? "Archiving…" : "Confirm archive"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <ErrorMessage error={error} className="mt-3" />
    </Card>
  );
}

function ClientDetailView({ id }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Client-admin employees can view and edit clients, but not delete them, see money,
  // or open owner job pages. The API only sends them their own jobs for this client.
  const owner = isOwner(user);
  const { data: client, setData, error } = useAsync(api, `/api/clients/${id}`);

  async function save(body) {
    setData(await api(`/api/clients/${id}`, { method: "PATCH", body }));
  }

  const back = { to: "/clients", label: "Clients" };
  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="Client not found" back={back} />
        <EmptyState title="This client does not exist or was deleted." />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!client) return <Loading />;
  const archivedOn = client.archived_at ? new Date(client.archived_at).toLocaleDateString() : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {client.name}
            {client.archived && <Badge>Archived</Badge>}
          </span>
        }
        back={back}
        actions={
          !client.archived && (
            <>
              <ButtonLink to={`/visits/new?client_id=${client.id}`} variant={owner ? "secondary" : "primary"}>
                <CalendarIcon />
                Schedule estimate visit
              </ButtonLink>
              {owner && (
                <ButtonLink to={`/quotes/new?client_id=${client.id}`} variant="secondary">
                  <DollarIcon />
                  Create quote
                </ButtonLink>
              )}
              {owner && (
                <ButtonLink to={`/jobs?client=${client.id}`}>
                  <PlusIcon />
                  Schedule a job
                </ButtonLink>
              )}
            </>
          )
        }
      />
      {client.archived && (
        <Alert tone="info" title={`Archived${archivedOn ? ` on ${archivedOn}` : ""}`}>
          This client is hidden from client lists and the job form, and new jobs cannot be scheduled for them.
          Their jobs stay on the calendar and in the job history. Unarchive them below to schedule again.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-3">
            <Detail icon={MapPinIcon} label="Address">
              {client.address ? (
                <span className="flex flex-wrap items-center gap-x-2">
                  {client.address} <MapLink address={client.address} />
                </span>
              ) : (
                <span className="text-muted">No address</span>
              )}
            </Detail>
            <Detail icon={PhoneIcon} label="Phone">
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="link">{client.phone}</a>
              ) : (
                <span className="text-muted">No phone</span>
              )}
            </Detail>
            {client.email && (
              <Detail icon={MailIcon} label="Email">
                <a href={`mailto:${client.email}`} className="link break-all">{client.email}</a>
              </Detail>
            )}
          </dl>
          {client.notes && (
            <div className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
              <p className="mt-1 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </Card>
        <Card title="Edit client" className="lg:col-span-2">
          <ClientForm key={client.id} initial={client} onSubmit={save} submitLabel="Save changes" />
        </Card>
      </div>
      <section>
        <SectionHeader title={owner ? "Job history" : "Your jobs here"} />
        {owner ? (
          <JobList jobs={client.jobs} empty="No jobs for this client yet." />
        ) : (
          <JobList jobs={client.jobs} linkBase="/my-jobs" showMoney={false} empty="No jobs assigned to you here." />
        )}
      </section>
      <ArchiveCard client={client} onArchive={(archived) => save({ archived })} />
      {owner && (
        <ConfirmDelete
          label="Delete client"
          description={`Permanently deletes this client and all ${jobCount(client.jobs.length)}, including their payment history and notes. This cannot be undone. To stop seeing a client you no longer work with, archive them instead.`}
          onConfirm={async () => {
            await api(`/api/clients/${id}`, { method: "DELETE" });
            navigate("/clients");
          }}
        />
      )}
    </div>
  );
}
