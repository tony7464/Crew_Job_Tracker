import { DEFAULT_DURATION, formatClockRange, formatDay, formatDuration, formatMoney, formatTimeRange } from "../../utils/format";
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
export function JobQuickView({ job, showMoney, openTo, onClose }) {
  const minutes = job.duration_minutes ?? DEFAULT_DURATION;
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
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant={openTo ? "ghost" : "secondary"} onClick={onClose}>
          Close
        </Button>
        {openTo && <ButtonLink to={openTo}>Open job</ButtonLink>}
      </div>
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
