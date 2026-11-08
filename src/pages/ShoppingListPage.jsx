import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import MapLink from "../components/MapLink";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { CartIcon, CheckIcon, CopyIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import { formatDay, formatTime } from "../utils/format";
import { isOwner } from "../utils/roles";

const RANGES = [
  [1, "Today"],
  [3, "Next 3 days"],
  [7, "Next 7 days"],
  [14, "Next 14 days"],
];

function listText(body) {
  const lines = ["Shopping list"];
  for (const group of body.jobs) {
    const { job } = group;
    lines.push("", `${job.client_name}: ${job.service_type}, ${formatDay(job.date)} ${formatTime(job.time)}`);
    for (const item of group.items) {
      const extra = [item.quantity, item.note].filter(Boolean).join(", ");
      lines.push(`- ${item.name}${extra ? ` (${extra})` : ""}`);
    }
  }
  return lines.join("\n");
}

// Everything still to pick up for the upcoming jobs this person can see, so one store
// run covers several jobs. Ticking an item marks it picked up on its job.
export default function ShoppingListPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const { data, error } = useAsync(api, `/api/materials/shopping?days=${days}`);
  const [got, setGot] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [shared, setShared] = useState(false);
  const jobPath = (id) => (isOwner(user) ? `/jobs/${id}` : `/my-jobs/${id}`);

  async function toggle(jobId, item) {
    const next = !got[item.id];
    setGot((current) => ({ ...current, [item.id]: next }));
    setBusyId(item.id);
    setActionError(null);
    try {
      await api(`/api/jobs/${jobId}/materials/${item.id}`, { method: "PATCH", body: { got: next } });
    } catch (err) {
      setGot((current) => ({ ...current, [item.id]: !next }));
      setActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function share() {
    const text = listText(data);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Shopping list", text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // The person closed the share sheet, or the browser refused the clipboard.
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shopping list"
        description="Materials still to pick up for upcoming jobs. Tick items as you get them."
        actions={
          data?.total > 0 && (
            <Button variant="secondary" onClick={share}>
              {shared ? <CheckIcon /> : <CopyIcon />}
              {shared ? "Copied" : "Share list"}
            </Button>
          )
        }
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="How far ahead">
        {RANGES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={days === value}
            onClick={() => setDays(value)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              days === value ? "border-primary bg-primary text-primary-fg" : "border-border text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorMessage error={error || actionError} />
      {!data && !error && <Loading label="Loading shopping list…" />}
      {data && data.jobs.length === 0 && (
        <EmptyState
          icon={CartIcon}
          title="Nothing to pick up"
          description="Add materials on a job and they'll show up here until someone ticks them off."
        />
      )}
      {data?.jobs.map(({ job, items }) => (
        <Card
          key={job.id}
          title={
            <Link to={jobPath(job.id)} className="hover:underline">
              {job.client_name}
            </Link>
          }
          description={`${job.service_type} · ${formatDay(job.date)}, ${formatTime(job.time)}`}
          actions={<MapLink address={job.client_address} />}
        >
          <ul className="space-y-1">
            {items.map((item) => {
              const done = Boolean(got[item.id]);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => toggle(job.id, item)}
                    disabled={busyId === item.id}
                    className="flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                  >
                    <span
                      className={cx(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        done ? "border-success bg-success text-white" : "border-border-strong",
                      )}
                    >
                      {done && <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className={cx("block text-sm", done && "text-muted line-through")}>
                        {item.name}
                        {item.quantity && <span className="ml-2 font-medium text-muted">{item.quantity}</span>}
                      </span>
                      {item.note && <span className="block text-xs text-muted">{item.note}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
