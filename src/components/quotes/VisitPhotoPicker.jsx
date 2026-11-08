import { useState } from "react";
import { api } from "../../api";
import { useAsync } from "../../hooks";
import { photoSrc } from "../../utils/jobPhotos";
import ErrorMessage from "../ErrorMessage";
import { Button } from "../ui/Button";
import { CheckIcon } from "../ui/Icons";
import { cx } from "../ui/styles";

// Photos from the quote's estimate visit, to show the customer on the quote. Those
// already on the quote are marked; tapping others selects them. Drafts only.
// onAdded(photos): the quote's photos after adding.
export default function VisitPhotoPicker({ quoteId, visitId, quotePhotos, maxPhotos = 10, onAdded }) {
  const { data, error } = useAsync(api, `/api/jobs/${visitId}/photos`);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const onQuote = new Set(quotePhotos.map((photo) => photo.source_job_photo_id).filter(Boolean));
  const room = Math.max(0, maxPhotos - quotePhotos.length);

  if (error) return <ErrorMessage error={error} />;
  if (!data) return <p className="text-sm text-muted">Loading the visit's photos…</p>;
  if (!data.photos.length) return <p className="text-sm text-muted">No photos on the visit yet. Take some on the visit's Photos card.</p>;

  function toggle(id) {
    setPicked((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : current.length < room ? [...current, id] : current,
    );
  }

  async function add() {
    setBusy(true);
    setAddError(null);
    try {
      const result = await api(`/api/quotes/${quoteId}/photos/from_visit`, {
        method: "POST",
        body: { job_photo_ids: picked },
      });
      setPicked([]);
      onAdded(result.photos);
    } catch (err) {
      setAddError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {data.photos.map((photo) => {
          const already = onQuote.has(photo.id);
          const on = picked.includes(photo.id);
          return (
            <li key={photo.id}>
              <button
                type="button"
                disabled={already}
                aria-pressed={already || on}
                aria-label={`${already ? "On the quote" : on ? "Selected" : "Select"}: ${photo.caption || photo.kind} photo`}
                onClick={() => toggle(photo.id)}
                className={cx(
                  "relative block aspect-square w-full overflow-hidden rounded-lg border-2",
                  on ? "border-primary" : "border-transparent",
                  already && "opacity-60",
                )}
              >
                <img src={photoSrc(photo, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                {(already || on) && (
                  <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-fg">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                )}
                {already && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[11px] text-white">On the quote</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {room === 0 ? `The quote has the most photos it can (${maxPhotos}).` : `Pick up to ${room} for the customer to see.`}
        </span>
        <Button size="sm" variant="secondary" disabled={!picked.length || busy} onClick={add}>
          {busy ? "Adding…" : picked.length ? `Add ${picked.length} to the quote` : "Add to the quote"}
        </Button>
      </div>
      <ErrorMessage error={addError} />
    </div>
  );
}
