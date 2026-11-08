import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import ChecklistCard from "../components/ChecklistCard";
import MaterialsCard from "../components/MaterialsCard";
import JobNotes from "../components/JobNotes";
import JobPhotos from "../components/JobPhotos";
import OnMyWayCard from "../components/OnMyWayCard";
import SignatureCard from "../components/SignatureCard";
import VisitCard from "../components/VisitCard";
import VisitQuoteCard from "../components/quotes/VisitQuoteCard";
import ClockCard from "../components/time/ClockCard";
import Loading from "../components/Loading";
import MapLink from "../components/MapLink";
import { PersonChips } from "../components/ui/Avatar";
import { Badge, RepeatBadge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert, EmptyState } from "../components/ui/Feedback";
import { CalendarIcon, CheckIcon, ClockIcon, PhoneIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { buttonClass } from "../components/ui/styles";
import { useAsync } from "../hooks";
import { useAuth } from "../context/useAuth";
import { DEFAULT_DURATION, formatDay, formatDuration, formatTimeRange } from "../utils/format";
import { canQuote, hasClientAccess } from "../utils/roles";
import { isEstimate } from "../utils/visits";
import { notifyClockChanged } from "../utils/timeEntries";

export default function MyJobDetail() {
  const { id } = useParams();
  return <MyJobDetailView key={id} id={id} />;
}

function MyJobDetailView({ id }) {
  const { user } = useAuth();
  const { data: job, setData, error } = useAsync(api, `/api/jobs/${id}`);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [photosKey, setPhotosKey] = useState(0);
  const [notesKey, setNotesKey] = useState(0);
  const [afterCount, setAfterCount] = useState(null);
  const [photosEnabled, setPhotosEnabled] = useState(true);
  const [checklist, setChecklist] = useState(null);

  async function markCompleted() {
    setSaving(true);
    setSaveError(null);
    try {
      setData(await api(`/api/jobs/${id}`, { method: "PATCH", body: { status: "completed" } }));
      // Completing a job clocks you out of it.
      notifyClockChanged();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  const back = { to: "/my-jobs", label: "My jobs" };
  // 404 also covers jobs that are not assigned to this employee.
  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="Job not found" back={back} />
        <EmptyState title="This job does not exist, or it is no longer assigned to you." />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!job) return <Loading />;
  const minutes = job.duration_minutes ?? DEFAULT_DURATION;
  const estimate = isEstimate(job);
  const doneLabel = estimate ? "Mark visit done" : "Mark completed";

  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {job.service_type}
            <StatusBadge status={job.status} />
            {job.repeats && <RepeatBadge text={job.repeats} />}
            {estimate && <Badge tone="primary">Estimate visit</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-base text-fg">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-muted" />
              {formatDay(job.date, "long")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 text-muted" />
              {formatTimeRange(job.time, minutes)}
              <span className="text-sm text-muted">({formatDuration(minutes)})</span>
            </span>
          </span>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title={job.client_name}>
            <div className="space-y-4">
              {job.client_address ? (
                <p className="text-sm">{job.client_address}</p>
              ) : (
                <p className="text-sm text-muted">No address on file.</p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <MapLink address={job.client_address} asButton label="Directions" />
                {job.client_phone && (
                  <a href={`tel:${job.client_phone}`} className={buttonClass({ variant: "secondary" })}>
                    <PhoneIcon />
                    Call {job.client_phone}
                  </a>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Crew</p>
                <PersonChips people={job.assignees} />
              </div>
              {job.notes && (
                <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-fg">
                  <p className="text-xs font-semibold uppercase tracking-wide">Instructions</p>
                  <p className="mt-1 whitespace-pre-wrap">{job.notes}</p>
                </div>
              )}
            </div>
          </Card>
          {estimate && (
            <VisitCard
              job={job}
              onChanged={setData}
              canEdit={hasClientAccess(user)}
              canOpenQuote={false}
              quotingHere={canQuote(user) && Boolean(job.visit_quote)}
            />
          )}
          {estimate && canQuote(user) && job.visit_quote && (
            <VisitQuoteCard
              quoteId={job.visit_quote.id}
              visitId={job.id}
              onSent={async () => {
                // Sending marks the visit done and clocks the sender out.
                setData(await api(`/api/jobs/${id}`));
                notifyClockChanged();
              }}
            />
          )}
          <OnMyWayCard key={job.status} jobId={job.id} onSent={() => setNotesKey((key) => key + 1)} />
          <ClockCard jobId={job.id} reloadKey={job.status} />
          <ChecklistCard jobId={job.id} onChange={setChecklist} />
          <MaterialsCard key={job.status} jobId={job.id} />
          <JobPhotos
            jobId={job.id}
            reloadKey={photosKey}
            defaultKind={!estimate && job.status === "completed" ? "after" : "before"}
            onChange={(photos, enabled) => {
              setAfterCount(photos.filter((photo) => photo.kind === "after").length);
              setPhotosEnabled(enabled);
            }}
            onPhotosChanged={() => setNotesKey((key) => key + 1)}
          />
          {job.status === "scheduled" ? (
            <div className="space-y-2">
              {checklist && checklist.done < checklist.total && (
                <p className="text-sm font-medium text-warning">
                  {checklist.total - checklist.done} of {checklist.total} checklist steps are not ticked yet.
                </p>
              )}
              {!estimate && afterCount === 0 && photosEnabled && (
                <p className="text-sm text-muted">Add a few <strong className="font-medium text-fg">After</strong> photos before you finish, so the owner can see the work.</p>
              )}
              <Button onClick={markCompleted} disabled={saving} size="lg" block className="sm:w-auto">
                <CheckIcon className="h-5 w-5" />
                {saving ? "Saving…" : doneLabel}
              </Button>
              <ErrorMessage error={saveError} />
            </div>
          ) : job.status === "completed" ? (
            <Alert tone="success">
              {estimate ? "This visit is done." : "This job is marked completed."} If that was a mistake, ask the owner to change it back.
            </Alert>
          ) : (
            <Alert tone="warning">{estimate ? "This visit was cancelled." : "This job was cancelled."}</Alert>
          )}
        </div>
        <div className="lg:col-span-2">
          {!estimate && <SignatureCard jobId={job.id} onSigned={() => setNotesKey((key) => key + 1)} />}
          <JobNotes
            jobId={job.id}
            reloadKey={notesKey}
            photosEnabled={photosEnabled}
            onPhotosChanged={() => setPhotosKey((key) => key + 1)}
          />
        </div>
      </div>
    </div>
  );
}
