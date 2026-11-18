import { FieldLabel } from "@puckeditor/core";
import { apiUrl } from "../api";
import { PANEL_BUTTON, PANEL_INPUT, PANEL_NOTE, PANEL_QUIET } from "./panelStyles";
import { usePhotos } from "./SiteContext";
import { photoPath } from "./siteUtils";

// The most photos one gallery holds (MAX_LIST in server/site_content.py).
const MAX_PHOTOS = 40;

function Thumb({ id, known, small = false }) {
  const size = small ? "h-12 w-12" : "h-16 w-16";
  if (!known) {
    return <span className={`flex ${size} shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500`}>{small ? "Gone" : "None"}</span>;
  }
  return <img src={apiUrl(photoPath(id, "thumb"))} alt="" className={`${size} shrink-0 rounded-lg object-cover`} />;
}

// A block's setting that holds one photo of the site's: shows it, and opens the site's photos to pick another.
export function PhotoField({ field, value, onChange, readOnly }) {
  const photos = usePhotos();
  const known = typeof value === "string" && photos.images.some((image) => image.id === value);

  async function pick() {
    const picked = await photos.choose({ several: false });
    if (picked?.length) onChange(picked[0]);
  }

  return (
    <FieldLabel label={field.label || "Photo"} el="div" readOnly={readOnly}>
      <div className="flex items-center gap-3">
        <Thumb id={value} known={known} />
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" className={PANEL_BUTTON} onClick={pick} disabled={readOnly}>
            {known ? "Change photo" : "Pick a photo"}
          </button>
          {value && (
            <button type="button" className={PANEL_QUIET} onClick={() => onChange("")} disabled={readOnly}>
              Remove
            </button>
          )}
        </div>
      </div>
    </FieldLabel>
  );
}

// A gallery's photos: a list of { image, caption }. Several can be added in one go.
export function PhotosField({ field, value, onChange, readOnly }) {
  const photos = usePhotos();
  const items = Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  const known = new Set(photos.images.map((image) => image.id));
  const room = MAX_PHOTOS - items.length;

  async function add() {
    const picked = await photos.choose({ several: true });
    if (!picked?.length) return;
    const fresh = picked.filter((id) => !items.some((item) => item.image === id)).slice(0, room);
    if (fresh.length) onChange([...items, ...fresh.map((image) => ({ image, caption: "" }))]);
  }

  const change = (index, caption) => onChange(items.map((item, at) => (at === index ? { ...item, caption } : item)));
  const remove = (index) => onChange(items.filter((_item, at) => at !== index));
  const move = (index, by) => {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  return (
    <FieldLabel label={field.label || "Photos"} el="div" readOnly={readOnly}>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${item.image}-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <Thumb id={item.image} known={known.has(item.image)} small />
            <div className="min-w-0 flex-1 space-y-1">
              <input
                type="text"
                value={typeof item.caption === "string" ? item.caption : ""}
                onChange={(event) => change(index, event.target.value)}
                maxLength={200}
                placeholder="A few words about it (optional)"
                aria-label={`Words for photo ${index + 1}`}
                disabled={readOnly}
                className={PANEL_INPUT}
              />
              <div className="flex flex-wrap">
                <button type="button" className={PANEL_QUIET} onClick={() => move(index, -1)} disabled={readOnly || index === 0} aria-label={`Move photo ${index + 1} earlier`} title="Earlier">↑</button>
                <button type="button" className={PANEL_QUIET} onClick={() => move(index, 1)} disabled={readOnly || index === items.length - 1} aria-label={`Move photo ${index + 1} later`} title="Later">↓</button>
                <button type="button" className={PANEL_QUIET} onClick={() => remove(index)} disabled={readOnly} aria-label={`Remove photo ${index + 1}`}>Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={PANEL_BUTTON} onClick={add} disabled={readOnly || room <= 0}>
          Add photos
        </button>
        {room <= 0 && <span className={PANEL_NOTE}>A gallery holds up to {MAX_PHOTOS} photos.</span>}
      </div>
    </FieldLabel>
  );
}
