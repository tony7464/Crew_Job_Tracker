import { useEffect, useId, useRef, useState } from "react";
import { MAX_PHOTOS } from "../utils/requests";
import { PhotoError, shrinkPhoto } from "../utils/images";
import { Spinner } from "./ui/Feedback";
import { CameraIcon, XIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

// Pick up to MAX_PHOTOS photos. Each is shrunk in the browser to a JPEG before it is
// sent. photos: [{ key, dataUrl, previewUrl }]; onChange(nextPhotos).
export default function PhotoPicker({ photos, onChange, error, disabled = false }) {
  const inputId = useId();
  const [busy, setBusy] = useState(0);
  const [pickError, setPickError] = useState(null);
  // Free the preview URLs of photos still shown when the picker goes away.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  const room = MAX_PHOTOS - photos.length - busy;

  async function pick(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setPickError(null);
    if (!files.length) return;
    const accepted = files.slice(0, Math.max(0, room));
    const messages = [];
    if (files.length > accepted.length) messages.push(`You can add up to ${MAX_PHOTOS} photos.`);
    setBusy((count) => count + accepted.length);
    const added = [];
    for (const file of accepted) {
      try {
        const photo = await shrinkPhoto(file);
        added.push({ key: `${Date.now()}-${Math.random()}`, ...photo });
      } catch (err) {
        messages.push(err instanceof PhotoError ? `${file.name}: ${err.message}` : `${file.name} could not be added.`);
      } finally {
        setBusy((count) => count - 1);
      }
    }
    if (added.length) onChange([...photosRef.current, ...added]);
    if (messages.length) setPickError(messages.join(" "));
  }

  function remove(key) {
    const photo = photos.find((item) => item.key === key);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onChange(photos.filter((item) => item.key !== key));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-fg">
          Photos <span className="font-normal text-muted">(optional)</span>
        </label>
        <span className="text-xs text-muted">
          {photos.length} of {MAX_PHOTOS}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((photo, index) => (
          <li key={photo.key} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
            <img src={photo.previewUrl} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(photo.key)}
              disabled={disabled}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
        {Array.from({ length: busy }, (_, index) => (
          <li
            key={`busy-${index}`}
            className="flex aspect-square items-center justify-center rounded-lg border border-border bg-surface-2"
          >
            <Spinner />
            <span className="sr-only">Preparing photo…</span>
          </li>
        ))}
        {room > 0 && (
          <li className="aspect-square">
            <label
              htmlFor={inputId}
              className={cx(
                "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs font-medium text-muted transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-soft-fg",
                "has-focus-visible:ring-4 has-focus-visible:ring-ring",
                disabled && "pointer-events-none opacity-55",
              )}
            >
              <CameraIcon className="h-6 w-6" />
              Add photo
              <input
                id={inputId}
                type="file"
                accept="image/*"
                multiple
                onChange={pick}
                disabled={disabled}
                className="sr-only"
              />
            </label>
          </li>
        )}
      </ul>
      {pickError || error ? (
        <p className="mt-1.5 text-xs font-medium text-danger">{pickError || error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">Photos of the area help with a quote. JPEG, PNG, or WebP.</p>
      )}
    </div>
  );
}
