import { useEffect, useState } from "react";
import { api } from "../../api";
import { KIND_LABELS, KIND_TONES, MAX_CAPTION, PHOTO_KINDS, photoSrc } from "../../utils/jobPhotos";
import ConfirmButton from "../ConfirmButton";
import ErrorMessage from "../ErrorMessage";
import { Input, Select } from "../Field";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/Icons";
import { Modal } from "../ui/Modal";

function formatStamp(value) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// One job photo at a time, with Previous and Next (also the arrow keys).
// People who may change the photo (can_edit) can set its kind and caption, or delete it.
export default function PhotoLightbox({ photos, index, onIndex, onClose, onChanged, onDeleted }) {
  const photo = photos[index];
  const many = photos.length > 1;
  const go = (step) => onIndex((index + step + photos.length) % photos.length);

  useEffect(() => {
    if (!many) return undefined;
    function onKey(event) {
      // Typing in the caption box should not change the photo.
      if (event.target.closest?.("input, select, textarea")) return;
      if (event.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, index, photos.length, onIndex]);

  if (!photo) return null;

  return (
    <Modal title={many ? `Photo ${index + 1} of ${photos.length}` : "Photo"} onClose={onClose} size="lg">
      <div className="flex items-center justify-center rounded-lg bg-surface-2">
        <img
          src={photoSrc(photo)}
          alt={photo.caption || `${KIND_LABELS[photo.kind]} photo`}
          width={photo.width}
          height={photo.height}
          className="max-h-[60dvh] w-auto max-w-full object-contain"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge tone={KIND_TONES[photo.kind]}>{KIND_LABELS[photo.kind]}</Badge>
        <span className="text-muted">
          {photo.uploader.username} · <time dateTime={photo.created_at}>{formatStamp(photo.created_at)}</time>
        </span>
      </div>
      {photo.caption && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{photo.caption}</p>}
      {many && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => go(-1)}>
            <ChevronLeftIcon />
            Previous
          </Button>
          <a href={photoSrc(photo)} target="_blank" rel="noopener" className="link text-sm">
            Open full size
          </a>
          <Button variant="secondary" onClick={() => go(1)}>
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      )}
      {photo.can_edit && (
        <PhotoEditor
          key={photo.id}
          photo={photo}
          onChanged={onChanged}
          onDeleted={() => {
            onDeleted(photo.id);
            if (photos.length <= 1) onClose();
            else if (index >= photos.length - 1) onIndex(index - 1);
          }}
        />
      )}
    </Modal>
  );
}

function PhotoEditor({ photo, onChanged, onDeleted }) {
  const [kind, setKind] = useState(photo.kind);
  const [caption, setCaption] = useState(photo.caption || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const changed = kind !== photo.kind || caption.trim() !== (photo.caption || "");
  const path = `/api/jobs/${photo.job_id}/photos/${photo.id}`;

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onChanged(await api(path, { method: "PATCH", body: { kind, caption } }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 space-y-4 border-t border-border pt-4">
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Select label="Kind" value={kind} onChange={(event) => setKind(event.target.value)}>
            {PHOTO_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Caption"
            value={caption}
            maxLength={MAX_CAPTION}
            placeholder="Optional, such as “Back patio”"
            onChange={(event) => setCaption(event.target.value)}
          />
        </div>
        <ErrorMessage error={error} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!changed || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
      <ConfirmButton
        label="Delete photo"
        confirmLabel="Delete photo"
        busyLabel="Deleting…"
        warning="This photo is deleted for everyone. This cannot be undone."
        onConfirm={async () => {
          await api(`/api/jobs/${photo.job_id}/photos/${photo.id}`, { method: "DELETE" });
          onDeleted();
        }}
      />
    </div>
  );
}
