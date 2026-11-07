import { useState } from "react";
import { photoSrc } from "../utils/jobPhotos";
import PhotoButtons from "./photos/PhotoButtons";
import PhotoLightbox from "./photos/PhotoLightbox";
import UploadTile from "./photos/UploadTile";
import { usePhotoUploads } from "./photos/usePhotoUploads";

// The photos on a quote, as a grid that opens a lightbox.
// editable (owner, draft quote): add, caption, and remove photos; needs quoteId, and
// onChange(nextPhotos) after every change. Otherwise read-only, as on the client's page.
export default function QuotePhotos({ photos, quoteId, editable = false, enabled = true, maxPhotos = 10, onChange }) {
  const [open, setOpen] = useState(null);
  const basePath = `/api/quotes/${quoteId}/photos`;
  const uploads = usePhotoUploads(basePath, {
    keepDone: false,
    onUploaded: (photo) => onChange?.((current) => [...current, photo]),
  });
  const room = maxPhotos - photos.length - uploads.items.length;

  if (!editable && photos.length === 0) return null;

  return (
    <div className="space-y-3">
      {photos.length === 0 && uploads.items.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">No photos on this quote.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="block aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-2 transition hover:opacity-90"
                aria-label={`Open photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
              >
                <img src={photoSrc(photo, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
          {uploads.items.map((item) => (
            <li key={item.key}>
              <UploadTile item={item} onRetry={() => uploads.retry(item.key)} onRemove={() => uploads.remove(item.key)} />
            </li>
          ))}
        </ul>
      )}
      {editable &&
        (enabled ? (
          <>
            <PhotoButtons onFiles={(files) => uploads.add(files.slice(0, Math.max(0, room)))} disabled={room <= 0} size="sm" />
            <p className="text-xs text-muted">
              {room <= 0
                ? `A quote can have up to ${maxPhotos} photos.`
                : "The client sees these photos on the quote. When they accept, the crew gets them on the job."}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">Photo storage is not set up yet, so photos cannot be added.</p>
        ))}
      {open !== null && photos[open] && (
        <PhotoLightbox
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          canEdit={() => editable}
          pathFor={(photo) => `${basePath}/${photo.id}`}
          onChanged={(photo) => onChange?.((current) => current.map((item) => (item.id === photo.id ? photo : item)))}
          onDeleted={(photoId) => onChange?.((current) => current.filter((item) => item.id !== photoId))}
        />
      )}
    </div>
  );
}
