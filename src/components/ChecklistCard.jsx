import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CheckIcon, PlusIcon, XIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

const MAX_TEXT = 200;

// A job's checklist. Everyone who can see the job ticks steps; the owner (can_edit)
// can also add and remove steps on this job. onChange({ done, total }) after each load
// or change, so the page can warn before the job is marked completed.
export default function ChecklistCard({ jobId, onChange }) {
  const { data, setData, error } = useAsync(api, `/api/jobs/${jobId}/checklist`);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [text, setText] = useState("");
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const done = data?.done;
  const total = data?.total;
  useEffect(() => {
    if (total !== undefined) onChangeRef.current?.({ done, total });
  }, [done, total]);

  async function run(id, request) {
    setBusyId(id);
    setActionError(null);
    try {
      setData(await request());
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  function toggle(item) {
    // Show the tick at once; the server's answer replaces it.
    setData((current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === item.id ? { ...entry, done: !item.done } : entry)),
      done: current.done + (item.done ? -1 : 1),
    }));
    run(item.id, () => api(`/api/jobs/${jobId}/checklist/${item.id}`, { method: "PATCH", body: { done: !item.done } }));
  }

  async function add(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    await run("new", () => api(`/api/jobs/${jobId}/checklist`, { method: "POST", body: { text: value } }));
    setText("");
  }

  if (error) {
    return (
      <Card title="Checklist">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="Checklist">
        <Loading label="Loading checklist…" />
      </Card>
    );
  }
  if (!data.total && !data.can_edit) return null;

  const allDone = data.total > 0 && data.done === data.total;

  return (
    <Card
      title="Checklist"
      actions={
        data.total > 0 && (
          <span className={cx("text-sm font-medium tabular-nums", allDone ? "text-success" : "text-muted")}>
            {data.done} of {data.total}
          </span>
        )
      }
    >
      {data.total > 0 ? (
        <ul className="space-y-1">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                onClick={() => toggle(item)}
                disabled={busyId === item.id}
                className="flex min-h-11 flex-1 items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
              >
                <span
                  className={cx(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                    item.done ? "border-success bg-success text-white" : "border-border-strong",
                  )}
                >
                  {item.done && <CheckIcon className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className={cx("block text-sm", item.done && "text-muted line-through")}>{item.text}</span>
                  {item.done && item.done_by && (
                    <span className="block text-xs text-muted">
                      {item.done_by.username} ·{" "}
                      {new Date(item.done_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                </span>
              </button>
              {data.can_edit && (
                <button
                  type="button"
                  onClick={() => run(item.id, () => api(`/api/jobs/${jobId}/checklist/${item.id}`, { method: "DELETE" }))}
                  aria-label={`Remove step: ${item.text}`}
                  className="mt-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No checklist for this job. Add steps here, or set one up for this service in Settings.</p>
      )}
      {data.can_edit && (
        <form onSubmit={add} className="mt-3 flex gap-2 border-t border-border pt-3">
          <input
            className="field"
            value={text}
            maxLength={MAX_TEXT}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add a step for this job"
            aria-label="New step"
          />
          <Button type="submit" variant="secondary" disabled={!text.trim() || busyId === "new"}>
            <PlusIcon />
            Add
          </Button>
        </form>
      )}
      <ErrorMessage error={actionError} />
    </Card>
  );
}
