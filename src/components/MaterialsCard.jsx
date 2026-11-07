import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

const MAX_NAME = 120;
const MAX_QUANTITY = 40;
const MAX_NOTE = 200;
const MAX_LINES = 30;

function when(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// What a job needs from the store. Everyone on the job sees the list, adds to it, and
// ticks items as picked up; the owner, a lead, or whoever added an item (can_edit) can
// change or remove it.
export default function MaterialsCard({ jobId }) {
  const url = `/api/jobs/${jobId}/materials`;
  const { data, setData, error } = useAsync(api, url);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [hideGot, setHideGot] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function run(id, request) {
    setBusyId(id);
    setActionError(null);
    try {
      setData(await request());
      return true;
    } catch (err) {
      setActionError(err);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function toggle(item) {
    // Show the tick at once; the server's answer replaces it.
    setData((current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === item.id ? { ...entry, got: !item.got } : entry)),
      got: current.got + (item.got ? -1 : 1),
    }));
    run(item.id, () => api(`${url}/${item.id}`, { method: "PATCH", body: { got: !item.got } }));
  }

  async function save(item, fields) {
    if (await run(item.id, () => api(`${url}/${item.id}`, { method: "PATCH", body: fields }))) setEditingId(null);
  }

  if (error) {
    return (
      <Card title="Materials">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="Materials">
        <Loading label="Loading materials…" />
      </Card>
    );
  }

  const allGot = data.total > 0 && data.got === data.total;
  const shown = hideGot ? data.items.filter((item) => !item.got) : data.items;

  return (
    <Card
      title="Materials"
      description="What this job needs from the store. Tick items as they're picked up."
      actions={
        data.total > 0 && (
          <span className={cx("text-sm font-medium tabular-nums", allGot ? "text-success" : "text-muted")}>
            {data.got} of {data.total} picked up
          </span>
        )
      }
    >
      {data.total === 0 ? (
        <p className="text-sm text-muted">Nothing on the list yet.</p>
      ) : (
        <>
          {data.got > 0 && (
            <div className="mb-2 flex justify-end">
              <button type="button" className="link text-sm" onClick={() => setHideGot((value) => !value)}>
                {hideGot ? "Show picked up" : `Hide picked up (${data.got})`}
              </button>
            </div>
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-success">Everything is picked up.</p>
          ) : (
            <ul className="space-y-1">
              {shown.map((item) =>
                editingId === item.id ? (
                  <li key={item.id}>
                    <EditForm
                      item={item}
                      busy={busyId === item.id}
                      onCancel={() => setEditingId(null)}
                      onSave={(fields) => save(item, fields)}
                    />
                  </li>
                ) : (
                  <MaterialRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onToggle={() => toggle(item)}
                    onEdit={() => setEditingId(item.id)}
                    onRemove={() => run(item.id, () => api(`${url}/${item.id}`, { method: "DELETE" }))}
                  />
                ),
              )}
            </ul>
          )}
        </>
      )}
      {data.can_add ? (
        <AddForm busy={busyId === "new"} onAdd={(body) => run("new", () => api(url, { method: "POST", body }))} />
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted">This job is cancelled, so nothing new can be added.</p>
      )}
      <ErrorMessage error={actionError} />
    </Card>
  );
}

function MaterialRow({ item, busy, onToggle, onEdit, onRemove }) {
  return (
    <li className="flex items-start gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.got}
        onClick={onToggle}
        disabled={busy}
        className="flex min-h-11 flex-1 items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
      >
        <span
          className={cx(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            item.got ? "border-success bg-success text-white" : "border-border-strong",
          )}
        >
          {item.got && <CheckIcon className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0">
          <span className={cx("block text-sm", item.got && "text-muted line-through")}>
            {item.name}
            {item.quantity && <span className="ml-2 font-medium text-muted">{item.quantity}</span>}
          </span>
          {item.note && <span className="block text-xs text-muted">{item.note}</span>}
          <span className="block text-xs text-muted">
            {item.got && item.got_by
              ? `Picked up by ${item.got_by.username} · ${when(item.got_at)}`
              : item.added_by && `Added by ${item.added_by.username}`}
          </span>
        </span>
      </button>
      {item.can_edit && (
        <>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.name}`}
            className="mt-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${item.name}`}
            className="mt-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </>
      )}
    </li>
  );
}

function EditForm({ item, busy, onCancel, onSave }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || "");
  const [note, setNote] = useState(item.note || "");

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), quantity: quantity.trim(), note: note.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-surface-2 p-2">
      <div className="flex gap-2">
        <input
          className="field"
          value={name}
          maxLength={MAX_NAME}
          onChange={(event) => setName(event.target.value)}
          aria-label="Item"
          autoFocus
        />
        <input
          className="field w-28 shrink-0"
          value={quantity}
          maxLength={MAX_QUANTITY}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Qty"
          aria-label="Quantity"
        />
      </div>
      <input
        className="field"
        value={note}
        maxLength={MAX_NOTE}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note (brand, color, size…)"
        aria-label="Note"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

function AddForm({ busy, onAdd }) {
  const [several, setSeveral] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState("");

  const lineList = lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function submit(event) {
    event.preventDefault();
    if (several) {
      if (!lineList.length) return;
      const added = await onAdd({ lines: lineList.slice(0, MAX_LINES) });
      if (added) setLines("");
    } else {
      if (!name.trim()) return;
      const added = await onAdd({ name: name.trim(), quantity: quantity.trim() });
      if (added) {
        setName("");
        setQuantity("");
      }
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-border pt-3">
      {several ? (
        <textarea
          className="field min-h-24"
          value={lines}
          onChange={(event) => setLines(event.target.value)}
          placeholder={"One item per line, for example:\nDrop cloths\nPainter's tape\n5 gal bucket"}
          aria-label="Materials, one per line"
        />
      ) : (
        <div className="flex gap-2">
          <input
            className="field"
            value={name}
            maxLength={MAX_NAME}
            onChange={(event) => setName(event.target.value)}
            placeholder="Add an item, like primer or 2x4s"
            aria-label="New item"
          />
          <input
            className="field w-24 shrink-0"
            value={quantity}
            maxLength={MAX_QUANTITY}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Qty"
            aria-label="Quantity"
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="link text-sm" onClick={() => setSeveral((value) => !value)}>
          {several ? "Add one at a time" : "Add several at once"}
        </button>
        <Button type="submit" variant="secondary" disabled={busy || (several ? !lineList.length : !name.trim())}>
          <PlusIcon />
          {several && lineList.length > 1 ? `Add ${Math.min(lineList.length, MAX_LINES)}` : "Add"}
        </Button>
      </div>
    </form>
  );
}
