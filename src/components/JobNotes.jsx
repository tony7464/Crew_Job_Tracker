import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { MAX_NOTE_PHOTOS, photoSrc } from "../utils/jobPhotos";
import ErrorMessage from "./ErrorMessage";
import { TextArea } from "./Field";
import Loading from "./Loading";
import PhotoButtons from "./photos/PhotoButtons";
import PhotoLightbox from "./photos/PhotoLightbox";
import UploadTile from "./photos/UploadTile";
import { usePhotoUploads } from "./photos/usePhotoUploads";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

const MAX_NOTE = 2000;

function formatStamp(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The timestamped notes log on a job, shared by the owner and assigned employees.
// A note can carry photos: each is uploaded to the job as soon as it is picked, and
// posting the note attaches them (photosEnabled false hides the photo buttons, as when
// photo storage is off). reloadKey: bump to fetch again. onPhotosChanged():
// after this log adds, changes, or deletes photos, so the Photos card can catch up.
export default function JobNotes({ jobId, reloadKey = 0, photosEnabled = true, onPhotosChanged }) {
  const { data: notes, setData, error } = useAsync(api, `/api/jobs/${jobId}/notes`, reloadKey);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [open, setOpen] = useState(null);
  const uploads = usePhotoUploads(`/api/jobs/${jobId}/photos`, { onUploaded: () => onPhotosChanged?.() });

  const saved = uploads.items.filter((item) => item.status === "done");
  const room = MAX_NOTE_PHOTOS - uploads.items.length;
  const canPost = (body.trim() || saved.length) && !uploads.busy && !submitting;

  async function submit(event) {
    event.preventDefault();
    if (!canPost) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const note = await api(`/api/jobs/${jobId}/notes`, {
        method: "POST",
        body: { body: body.trim(), photo_ids: saved.map((item) => item.photo.id) },
      });
      setData((current) => [...(current || []), note]);
      setBody("");
      uploads.clear();
      if (note.photos.length) onPhotosChanged?.();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function updatePhoto(photo) {
    setData((current) =>
      current.map((note) => ({ ...note, photos: note.photos.map((item) => (item.id === photo.id ? photo : item)) })),
    );
    onPhotosChanged?.();
  }

  function dropPhoto(photoId) {
    setData((current) => current.map((note) => ({ ...note, photos: note.photos.filter((item) => item.id !== photoId) })));
    onPhotosChanged?.();
  }

  const failed = uploads.items.some((item) => item.status === "failed");

  return (
    <Card title="Notes log" description="Updates from the crew and the owner. Notes cannot be edited.">
      {error ? (
        <ErrorMessage error={error} />
      ) : !notes ? (
        <Loading label="Loading notes…" />
      ) : notes.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">No notes yet.</p>
      ) : (
        <ol className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3">
              <Avatar person={note.author} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  <span className="font-semibold text-fg">{note.author.name}</span>{" "}
                  <time dateTime={note.created_at}>{formatStamp(note.created_at)}</time>
                </p>
                {note.body && (
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-lg rounded-tl-sm bg-surface-2 px-3 py-2 text-sm">
                    {note.body}
                  </p>
                )}
                {note.photos?.length > 0 && (
                  <ul className="mt-2 grid grid-cols-4 gap-1.5">
                    {note.photos.map((photo, index) => (
                      <li key={photo.id}>
                        <button
                          type="button"
                          onClick={() => setOpen({ noteId: note.id, index })}
                          className="block aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-2 hover:opacity-90"
                          aria-label={`Open photo ${index + 1} on this note`}
                        >
                          <img src={photoSrc(photo, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="mt-5 space-y-3 border-t border-border pt-4">
        <TextArea
          label="Add a note"
          name="body"
          rows="3"
          maxLength={MAX_NOTE}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          hint={uploads.items.length ? "Photos on their own are fine too." : undefined}
        />
        {uploads.items.length > 0 && (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {uploads.items.map((item) => (
              <li key={item.key}>
                <UploadTile
                  item={item}
                  onRetry={() => uploads.retry(item.key)}
                  onRemove={() => {
                    uploads.remove(item.key, { deleteSaved: true });
                    if (item.photo) onPhotosChanged?.();
                  }}
                  removeLabel="Take this photo off the note"
                />
              </li>
            ))}
          </ul>
        )}
        {failed && <p className="text-xs font-medium text-danger">Retry or remove the photos that did not upload.</p>}
        <ErrorMessage error={submitError} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {photosEnabled ? (
            <PhotoButtons onFiles={(files) => uploads.add(files.slice(0, Math.max(0, room)))} disabled={room <= 0} size="sm" />
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!canPost || failed} className="w-full sm:w-auto">
            {submitting ? "Adding…" : uploads.busy ? "Uploading photos…" : "Add note"}
          </Button>
        </div>
      </form>
      {open && (() => {
        const photos = notes?.find((note) => note.id === open.noteId)?.photos || [];
        if (!photos[open.index]) return null;
        return (
          <PhotoLightbox
            photos={photos}
            index={open.index}
            onIndex={(index) => setOpen({ ...open, index })}
            onClose={() => setOpen(null)}
            onChanged={updatePhoto}
            onDeleted={dropPhoto}
          />
        );
      })()}
    </Card>
  );
}
