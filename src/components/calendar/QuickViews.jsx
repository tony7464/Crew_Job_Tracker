import { useState } from "react";
import { deleteJobCopy } from "../../utils/deleteJob";
import { DEFAULT_DURATION, formatClockRange, formatDay, formatDuration, formatMoney, formatTimeRange } from "../../utils/format";
import ErrorMessage from "../ErrorMessage";
import MapLink from "../MapLink";
import { PersonChips } from "../ui/Avatar";
import { PaidBadge, StatusBadge } from "../ui/Badge";
import { Button, ButtonLink } from "../ui/Button";
import { Alert } from "../ui/Feedback";
import { Modal } from "../ui/Modal";

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// showMoney: the owner sees the price and paid status; client-admins never do.
// openTo: where "Open job" goes, or null when this person cannot open the job.
// onDelete: the owner only. Deletes the job (async); the quick view asks to confirm first.
export function JobQuickView({ job, showMoney, openTo, onClose, onDelete }) {
  const minutes = job.duration_minutes ?? DEFAULT_DURATION;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const copy = deleteJobCopy(job);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }
  return (
    <Modal title={job.service_type} description={job.client_name} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={job.status} />
        {showMoney && <PaidBadge paid={job.paid} />}
      </div>
      <dl className="mt-3 divide-y divide-border">
        <Row label="When">
          {formatDay(job.date, "long")}
          <span className="block text-muted">
            {formatTimeRange(job.time, minutes)} · {formatDuration(minutes)}
          </span>
        </Row>
        <Row label="Crew">
          <PersonChips people={job.assignees} />
        </Row>
        {showMoney && <Row label="Price">{formatMoney(job.price_cents)}</Row>}
        {job.client_address && (
          <Row label="Address">
            <span className="flex flex-wrap items-center gap-x-2">
              {job.client_address} <MapLink address={job.client_address} />
            </span>
          </Row>
        )}
        {job.notes && (
          <Row label="Instructions">
            <span className="whitespace-pre-wrap">{job.notes}</span>
          </Row>
        )}
      </dl>
      {!openTo && (
        <p className="mt-3 text-xs text-muted">You can see this job on the team schedule. Only the owner can change it.</p>
      )}
      {confirming ? (
        <div className="mt-5 rounded-xl border border-danger/30 p-3.5" role="group" aria-label={copy.label}>
          <p className="text-sm font-medium text-fg">{copy.label}?</p>
          <p className="mt-0.5 text-sm text-muted">{copy.description}</p>
          <ErrorMessage error={error} className="mt-3" />
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Confirm delete"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {onDelete && (
            <Button variant="danger-outline" onClick={() => setConfirming(true)} className="sm:mr-auto">
              {copy.label}
            </Button>
          )}
          <Button variant={openTo ? "ghost" : "secondary"} onClick={onClose}>
            Close
          </Button>
          {openTo && <ButtonLink to={openTo}>Open job</ButtonLink>}
        </div>
      )}
    </Modal>
  );
}

export function LunchQuickView({ lunch, onClose }) {
  return (
    <Modal title="Lunch break" description={lunch.user.name} onClose={onClose} size="sm">
      <dl className="divide-y divide-border">
        <Row label="When">
          {formatDay(lunch.date, "long")}
          <span className="block text-muted">{formatClockRange(lunch.start_time, lunch.end_time)}</span>
        </Row>
      </dl>
      <Alert tone="info" className="mt-4">
        Employees add and change their own lunch breaks. You can see them here so you can plan around them.
      </Alert>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
