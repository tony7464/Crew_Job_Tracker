import { useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_DURATION, formatDay, formatMoney, formatTimeRange, STATUSES, statusLabel } from "../utils/format";
import MapLink from "./MapLink";
import { AvatarStack } from "./ui/Avatar";
import { Badge, PaidBadge, StatusBadge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { DataTable } from "./ui/DataTable";
import { EmptyState } from "./ui/Feedback";
import { ClockIcon, RepeatIcon } from "./ui/Icons";
import { isEstimate } from "../utils/visits";

const NO_PENDING = {};

function when(job) {
  return {
    day: formatDay(job.date),
    range: formatTimeRange(job.time, job.duration_minutes ?? DEFAULT_DURATION),
  };
}

// linkBase: where a job title links ("/jobs" for owners, "/my-jobs" for employees).
// showMoney: price and paid; employees never receive them from the API.
// onUpdate(id, patch) and onDelete(id) add inline controls for owners.
// note(job): optional extra line under the title, such as how long a job has been owed.
export default function JobList({
  jobs,
  showClient = false,
  onUpdate,
  onDelete,
  pending = NO_PENDING,
  empty = "No jobs yet.",
  emptyAction,
  linkBase = "/jobs",
  showMoney = true,
  note,
}) {
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function confirmDelete(id) {
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  if (!jobs.length) return <EmptyState title={empty} action={emptyAction} />;

  const title = (job) => (
    <span className="inline-flex items-center gap-1.5">
      <Link to={`${linkBase}/${job.id}`} className="font-medium text-fg hover:text-primary hover:underline">
        {job.service_type}
      </Link>
      {isEstimate(job) && <Badge tone="primary">Estimate</Badge>}
      {job.repeats && (
        <span title={job.repeats} className="text-muted">
          <RepeatIcon className="h-3.5 w-3.5" />
          <span className="sr-only">{job.repeats}</span>
        </span>
      )}
    </span>
  );

  const subtitle = (job) => (
    <>
      {showClient && job.client_name && <span className="block text-sm text-muted">{job.client_name}</span>}
      {note && <span className="mt-1 block">{note(job)}</span>}
      {!showMoney && job.client_address?.trim() && (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {job.client_address} <MapLink address={job.client_address} />
        </span>
      )}
    </>
  );

  const statusControl = (job) =>
    onUpdate ? (
      <select
        aria-label={`Status for ${job.service_type}`}
        value={job.status}
        disabled={Boolean(pending[`${job.id}:status`])}
        onChange={(event) => onUpdate(job.id, { status: event.target.value })}
        className="field-sm"
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>{statusLabel(status)}</option>
        ))}
      </select>
    ) : (
      <StatusBadge status={job.status} />
    );

  // Estimate visits are free: no price to show and nothing to pay.
  const price = (job) =>
    isEstimate(job) ? <span className="text-muted">Free</span> : <span className="tabular-nums">{formatMoney(job.price_cents)}</span>;

  const paidControl = (job) =>
    isEstimate(job) ? (
      <span className="text-sm text-muted">—</span>
    ) : onUpdate ? (
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={job.paid}
          disabled={Boolean(pending[`${job.id}:paid`])}
          onChange={(event) => onUpdate(job.id, { paid: event.target.checked })}
          className="h-4 w-4 disabled:opacity-60"
        />
        Paid
      </label>
    ) : (
      <PaidBadge paid={job.paid} />
    );

  const deleteControl = (job) => (
    <DeleteButtons
      confirming={confirmId === job.id}
      busy={deletingId === job.id}
      onAsk={() => setConfirmId(job.id)}
      onCancel={() => setConfirmId(null)}
      onConfirm={() => confirmDelete(job.id)}
    />
  );

  const columns = [
    {
      key: "job",
      header: "Job",
      cell: (job) => (
        <div className="min-w-40">
          {title(job)}
          {subtitle(job)}
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      className: "whitespace-nowrap",
      cell: (job) => {
        const { day, range } = when(job);
        return (
          <>
            <span className="block text-fg">{day}</span>
            <span className="block text-sm text-muted">{range}</span>
          </>
        );
      },
    },
    { key: "crew", header: "Crew", cell: (job) => <AvatarStack people={job.assignees} /> },
    ...(showMoney
      ? [{ key: "price", header: "Price", align: "right", cell: price }]
      : []),
    { key: "status", header: "Status", cell: statusControl },
    ...(showMoney ? [{ key: "paid", header: "Paid", cell: paidControl }] : []),
    ...(onDelete ? [{ key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: deleteControl }] : []),
  ];

  const renderMobile = (job) => {
    const { day, range } = when(job);
    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title(job)}
            {subtitle(job)}
          </div>
          <StatusBadge status={job.status} />
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <ClockIcon className="h-3.5 w-3.5" />
          {day} · {range}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AvatarStack people={job.assignees} />
          {showMoney && (
            <span className="flex items-center gap-2 text-sm">
              <span className="font-medium">{price(job)}</span>
              {!onUpdate && !isEstimate(job) && <PaidBadge paid={job.paid} />}
            </span>
          )}
        </div>
        {onUpdate && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2.5">
            {statusControl(job)}
            {showMoney && paidControl(job)}
            {onDelete && <div className="ml-auto">{deleteControl(job)}</div>}
          </div>
        )}
      </div>
    );
  };

  return <DataTable columns={columns} rows={jobs} renderMobile={renderMobile} caption="Jobs" />;
}

function DeleteButtons({ confirming, busy, onAsk, onCancel, onConfirm }) {
  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={onAsk}>
        Delete
      </Button>
    );
  }
  return (
    <span className="inline-flex gap-1">
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
        {busy ? "Deleting…" : "Delete"}
      </Button>
    </span>
  );
}
