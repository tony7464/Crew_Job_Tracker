import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { KIND_LABELS, KIND_TONES, PHOTO_KINDS, photoSrc } from "../utils/jobPhotos";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";
import PhotoButtons from "./photos/PhotoButtons";
import PhotoLightbox from "./photos/PhotoLightbox";
import UploadTile from "./photos/UploadTile";
import { usePhotoUploads } from "./photos/usePhotoUploads";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { Alert } from "./ui/Feedback";
import { cx } from "./ui/styles";

const FILTERS = [["all", "All"], ...PHOTO_KINDS];

// A job's photos: take or choose photos, label them Before / After / Progress / Issue,
// and look through them. reloadKey: bump to fetch again (after a note with photos, say).
// onChange(photos) after every load or change; onPhotosChanged() after this card changes them.
export default function JobPhotos({ jobId, reloadKey = 0, defaultKind = "progress", onChange, onPhotosChanged }) {
  const { data, setData, error } = useAsync(api, `/api/jobs/${jobId}/photos`, reloadKey);
  const [kind, setKind] = useState(defaultKind);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const uploads = usePhotoUploads(jobId, {
    onUploaded(photo) {
      setData((current) => current && { ...current, photos: [...current.photos, photo] });
      onPhotosChanged?.();
    },
    keepDone: false,
  });

  const photos = data?.photos;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (photos) onChangeRef.current?.(photos);
  }, [photos]);

  // Saved uploads leave this list and appear in the grid as real photos.
  const pending = uploads.items;

  function replace(photo) {
    setData((current) => ({ ...current, photos: current.photos.map((item) => (item.id === photo.id ? photo : item)) }));
    onPhotosChanged?.();
  }

  function drop(photoId) {
    setData((current) => ({ ...current, photos: current.photos.filter((item) => item.id !== photoId) }));
    onPhotosChanged?.();
  }

  if (error) {
    return (
      <Card title="Photos">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="Photos">
        <Loading label="Loading photos…" />
      </Card>
    );
  }

  const counts = Object.fromEntries(PHOTO_KINDS.map(([value]) => [value, photos.filter((p) => p.kind === value).length]));
  const shown = filter === "all" ? photos : photos.filter((photo) => photo.kind === filter);
  const room = data.max_photos - photos.length - pending.length;

  return (
    <Card title="Photos" description="Before and after shots, progress, and anything the owner should see.">
      {data.enabled ? (
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-fg">New photos are</legend>
            <div className="flex flex-wrap gap-1.5">
              {PHOTO_KINDS.map(([value, label]) => (
                <label
                  key={value}
                  className={cx(
                    "cursor-pointer rounded-full border px-3 py-1 text-sm font-medium transition-colors has-focus-visible:ring-4 has-focus-visible:ring-ring",
                    kind === value
                      ? "border-primary bg-primary-soft text-primary-soft-fg"
                      : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <input
                    type="radio"
                    name={`photo-kind-${jobId}`}
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <PhotoButtons onFiles={(files) => uploads.add(files.slice(0, Math.max(0, room)), kind)} disabled={room <= 0} />
          {room <= 0 && <p className="text-xs text-muted">This job has the most photos it can hold ({data.max_photos}).</p>}
        </div>
      ) : (
        <Alert tone="info">Photo storage is not set up yet, so photos cannot be added. Ask the business owner.</Alert>
      )}

      {photos.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Show photos">
          {FILTERS.map(([value, label]) => {
            const count = value === "all" ? photos.length : counts[value];
            if (value !== "all" && !count) return null;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cx(
                  "rounded-lg px-2.5 py-1 text-xs font-medium",
                  filter === value ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {label} <span className="tabular-nums text-muted">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 && pending.length === 0 ? (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">
          {photos.length === 0 ? "No photos yet." : `No ${KIND_LABELS[filter].toLowerCase()} photos.`}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shown.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="relative block aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-2 transition hover:opacity-90"
                aria-label={`Open ${KIND_LABELS[photo.kind].toLowerCase()} photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
              >
                <img src={photoSrc(photo, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                <Badge tone={KIND_TONES[photo.kind]} className="absolute bottom-1 left-1 shadow-card">
                  {KIND_LABELS[photo.kind]}
                </Badge>
              </button>
            </li>
          ))}
          {pending.map((item) => (
            <li key={item.key}>
              <UploadTile item={item} onRetry={() => uploads.retry(item.key)} onRemove={() => uploads.remove(item.key)} />
            </li>
          ))}
        </ul>
      )}

      {open !== null && shown[open] && (
        <PhotoLightbox
          photos={shown}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onChanged={replace}
          onDeleted={drop}
        />
      )}
    </Card>
  );
}
