import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import ConfirmDelete from "../components/ConfirmDelete";
import CreateInvoiceButton from "../components/CreateInvoiceButton";
import ErrorMessage from "../components/ErrorMessage";
import JobForm from "../components/JobForm";
import ChecklistCard from "../components/ChecklistCard";
import MaterialsCard from "../components/MaterialsCard";
import JobNotes from "../components/JobNotes";
import JobPhotos from "../components/JobPhotos";
import OnMyWayCard from "../components/OnMyWayCard";
import JobTimeCard from "../components/time/JobTimeCard";
import SeriesCard from "../components/SeriesCard";
import SignatureCard from "../components/SignatureCard";
import Loading from "../components/Loading";
import { PersonChips } from "../components/ui/Avatar";
import { InvoiceStatusBadge, PaidBadge, RepeatBadge, StatusBadge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { CalendarIcon, ClockIcon, DollarIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAsync } from "../hooks";
import { DEFAULT_DURATION, formatDay, formatDuration, formatTimeRange } from "../utils/format";

// Bill the job, or open the invoice it already has. A paid job's invoice decides its paid flag.
function InvoiceCard({ job }) {
  const invoice = job.invoice;
  if (invoice) {
    return (
      <Card title="Invoice">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <span className="font-medium tabular-nums text-fg">{invoice.label}</span>
            <InvoiceStatusBadge invoice={invoice} />
          </span>
          <ButtonLink to={`/invoices/${invoice.id}`} variant="secondary" size="sm">
            <DollarIcon />
            Open invoice
          </ButtonLink>
        </div>
        <p className="mt-2 text-xs text-muted">Paid is set by the invoice. Record payments there.</p>
      </Card>
    );
  }
  const reason =
    job.status === "cancelled" ? "Cancelled jobs are not billed." : job.paid ? "This job is already marked paid." : null;
  return (
    <Card title="Invoice" description="Bill this job: one line at its price. The client gets a link to pay online.">
      <CreateInvoiceButton source={{ job_id: job.id }} disabledReason={reason} />
    </Card>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  return <JobDetailView key={id} id={id} />;
}

function JobDetailView({ id }) {
  const navigate = useNavigate();
  const jobState = useAsync(api, `/api/jobs/${id}`);

  // After a series change: reload this visit (the series may have updated it). Stopping a
  // series can remove this visit; then go back to the jobs list.
  async function seriesChanged({ stopped = false } = {}) {
    try {
      jobState.setData(await api(`/api/jobs/${id}`));
    } catch (err) {
      if (stopped && err.status === 404) navigate("/jobs");
    }
  }
  const clientsState = useAsync(fetchAll, "/api/clients");
  const employeesState = useAsync(api, "/api/employees");
  const error = jobState.error || clientsState.error || employeesState.error;
  const job = jobState.data;
  const clients = clientsState.data;
  const employees = employeesState.data;
  // Each card refreshes the other when it changes photos.
  const [photosKey, setPhotosKey] = useState(0);
  const [notesKey, setNotesKey] = useState(0);
  const [photosEnabled, setPhotosEnabled] = useState(true);

  async function save(body) {
    jobState.setData(await api(`/api/jobs/${id}`, { method: "PATCH", body }));
  }

  const back = { to: "/jobs", label: "Jobs" };
  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="Job not found" back={back} />
        <EmptyState title="This job does not exist or was deleted." />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!job || !clients || !employees) return <Loading />;
  const crewKey = job.assignees.map((person) => person.id).join(",");
  const minutes = job.duration_minutes ?? DEFAULT_DURATION;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {job.service_type}
            <StatusBadge status={job.status} />
            {job.repeats && <RepeatBadge text={job.repeats} />}
            <PaidBadge paid={job.paid} />
          </span>
        }
        description={
          <span className="flex flex-col gap-1.5">
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to={`/clients/${job.client_id}`} className="link w-fit">
                {job.client_name}
              </Link>
              {job.quote_id && (
                <Link to={`/quotes/${job.quote_id}`} className="link w-fit">
                  From quote #{job.quote_id}
                </Link>
              )}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {formatDay(job.date, "long")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                {formatTimeRange(job.time, minutes)} ({formatDuration(minutes)})
              </span>
            </span>
          </span>
        }
      >
        <div className="mt-3">
          <PersonChips people={job.assignees} />
        </div>
      </PageHeader>
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card title="Edit job" className="lg:col-span-3">
          <JobForm
            key={`${job.id}-${job.status}-${job.paid}-${job.invoice?.status}-${job.date}-${job.time}-${minutes}-${crewKey}`}
            clients={clients}
            employees={employees}
            initial={job}
            onSubmit={save}
            submitLabel="Save changes"
          />
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <InvoiceCard job={job} />
          <SeriesCard job={job} employees={employees} onChanged={seriesChanged} />
          <OnMyWayCard key={job.status} jobId={job.id} onSent={() => setNotesKey((key) => key + 1)} />
          <ChecklistCard key={job.service_type} jobId={job.id} />
          <MaterialsCard key={job.status} jobId={job.id} />
          <JobTimeCard jobId={job.id} crew={job.assignees} reloadKey={`${job.status}-${minutes}`} />
          <JobPhotos
            jobId={job.id}
            reloadKey={photosKey}
            onChange={(_photos, enabled) => setPhotosEnabled(enabled)}
            onPhotosChanged={() => setNotesKey((key) => key + 1)}
          />
          <SignatureCard jobId={job.id} onSigned={() => setNotesKey((key) => key + 1)} />
          <JobNotes
            jobId={job.id}
            reloadKey={notesKey}
            photosEnabled={photosEnabled}
            onPhotosChanged={() => setPhotosKey((key) => key + 1)}
          />
        </div>
      </div>
      <ConfirmDelete
        label="Delete job"
        description="Removes this job, its notes log, and its photos. This cannot be undone."
        onConfirm={async () => {
          await api(`/api/jobs/${id}`, { method: "DELETE" });
          navigate("/jobs");
        }}
      />
    </div>
  );
}
