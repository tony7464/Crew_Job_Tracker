import { useEffect, useId, useState } from "react";
import { api, apiUpload, apiUrl } from "../api";
import { Button } from "../components/ui/Button";
import { Alert, Spinner } from "../components/ui/Feedback";
import { CheckIcon, TrashIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { buttonClass, cx } from "../components/ui/styles";
import { PhotoError, shrinkPhoto } from "../utils/images";
import { photoPath } from "./siteUtils";

// The same size the server keeps (FULL_SIDE in server/routes/site_images.py).
const SEND_SIDE = 2000;
// How many job photos the server copies in one request (MAX_FROM_JOBS).
const COPY_AT_ONCE = 6;
// The largest PNG or WebP sent as it is (the server takes 6 MB at most).
const AS_IS_BYTES = 5 * 1024 * 1024;

function Tile({ src, label, picked, onPick, badge, disabled, children }) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-pressed={picked}
        aria-label={label}
        className={cx(
          "block aspect-square w-full overflow-hidden rounded-lg border-2 bg-surface-2 transition",
          picked ? "border-primary ring-2 ring-ring" : "border-transparent hover:border-border-strong",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      </button>
      {picked && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-fg">
          <CheckIcon className="h-4 w-4" />
        </span>
      )}
      {badge && <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">{badge}</span>}
      {children}
    </li>
  );
}

// Send one picked file to the site's photos. A PNG or WebP of modest size goes as it is,
// so a logo keeps its see-through background (the server redraws every photo anyway, and
// keeps nothing else of the file). Everything else is shrunk here first, as a JPEG, which
// is quicker to send; so is a PNG or WebP the server would not take as it is.
async function send(file) {
  const form = new FormData();
  const seeThrough = (file.type === "image/png" || file.type === "image/webp") && file.size <= AS_IS_BYTES;
  if (seeThrough) {
    form.append("photo", file, file.type === "image/png" ? "photo.png" : "photo.webp");
    try {
      return await apiUpload("/api/site/images", form);
    } catch (error) {
      if (error.status !== 400) throw error;
    }
  }
  const shrunk = await shrinkPhoto(file, { maxSide: SEND_SIDE });
  URL.revokeObjectURL(shrunk.previewUrl);
  const smaller = new FormData();
  smaller.append("photo", shrunk.blob, "photo.jpg");
  return apiUpload("/api/site/images", smaller);
}

// The site's own photos: add from this device, pick, delete.
function MyPhotos({ library, picked, onPick, onAdded, onDeleted, lookOnly }) {
  const inputId = useId();
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const room = library.max - library.images.length - busy;

  async function add(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setProblem(null);
    const taken = files.slice(0, Math.max(0, room));
    const said = [];
    if (files.length > taken.length) said.push(`A site holds up to ${library.max} photos. Delete some you no longer use to add more.`);
    setBusy((count) => count + taken.length);
    for (const file of taken) {
      try {
        onAdded(await send(file));
      } catch (error) {
        const why = error instanceof PhotoError ? error.message : error.data?.errors?.photo?.[0] || error.message || "It could not be added.";
        said.push(`${file.name}: ${why}`);
      } finally {
        setBusy((count) => count - 1);
      }
    }
    if (said.length) setProblem(said.join(" "));
  }

  async function remove(image) {
    setProblem(null);
    try {
      await api(`/api/site/images/${image.id}`, { method: "DELETE" });
      onDeleted(image.id);
      setDeleting(null);
    } catch (error) {
      setProblem(error.message);
    }
  }

  const asked = deleting && library.images.find((image) => image.id === deleting);
  return (
    <div className="space-y-3">
      {!library.enabled && <Alert tone="warning">Photo storage is not set up yet, so photos cannot be added.</Alert>}
      {problem && <Alert tone="danger">{problem}</Alert>}
      {asked && (
        <Alert tone="warning">
          <span className="block">
            Delete this photo for good?
            {asked.used_on.length > 0 && ` It is used on: ${asked.used_on.join(", ")}. It will be left out there, on your live site too.`}
          </span>
          <span className="mt-2 flex gap-2">
            <Button variant="danger" size="sm" onClick={() => remove(asked)}>Delete photo</Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Keep it</Button>
          </span>
        </Alert>
      )}
      {library.images.length === 0 && busy === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-8 text-center text-sm text-muted">
          No photos yet. Add some from this device, or pick from your job photos.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: busy }, (_, index) => (
            <li key={`busy-${index}`} className="flex aspect-square items-center justify-center rounded-lg bg-surface-2">
              <Spinner />
              <span className="sr-only">Adding a photo…</span>
            </li>
          ))}
          {library.images.map((image, index) => (
            <Tile
              key={image.id}
              src={apiUrl(photoPath(image.id, "thumb"))}
              label={`Photo ${index + 1}${picked.includes(image.id) ? ", picked" : ""}`}
              picked={picked.includes(image.id)}
              onPick={() => onPick(image.id)}
              badge={image.used_on.length ? "In use" : null}
            >
              {!lookOnly && (
                <button
                  type="button"
                  onClick={() => setDeleting(image.id)}
                  aria-label={`Delete photo ${index + 1}`}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </Tile>
          ))}
        </ul>
      )}
      {!lookOnly && library.enabled && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={inputId} className={cx(buttonClass({ variant: "secondary", size: "sm" }), "cursor-pointer", room <= 0 && "pointer-events-none opacity-55")}>
            Add photos from this device
            <input id={inputId} type="file" accept="image/*" multiple onChange={add} disabled={room <= 0} className="sr-only" />
          </label>
          <span className="text-xs text-muted">
            {library.images.length} of {library.max}. JPEG, PNG, or WebP.
          </span>
        </div>
      )}
    </div>
  );
}

// Photos the crew took on jobs, to copy into the site's own photos.
function JobPhotos({ library, onCopied }) {
  // The pages of job photos asked for so far, and the ones that have arrived.
  const [wanted, setWanted] = useState(1);
  const [got, setGot] = useState({ pages: [], more: false, upTo: 0, problem: null });
  const [problem, setProblem] = useState(null);
  const [picked, setPicked] = useState([]);
  const [copying, setCopying] = useState(false);
  const photos = got.pages.flat();
  const loading = got.upTo !== wanted;
  const room = library.max - library.images.length;

  useEffect(() => {
    let cancelled = false;
    api(`/api/site/job-photos?page=${wanted}`)
      .then((data) => !cancelled && setGot((current) => ({ pages: [...current.pages.slice(0, wanted - 1), data.photos], more: data.more, upTo: wanted, problem: null })))
      .catch((error) => !cancelled && setGot((current) => ({ ...current, more: false, upTo: wanted, problem: error.message })));
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  const toggle = (id) => setPicked((current) => (current.includes(id) ? current.filter((each) => each !== id) : [...current, id]));

  async function copy() {
    setCopying(true);
    setProblem(null);
    const added = [];
    const said = [];
    try {
      // A few at a time: each one is downloaded, redrawn and saved by the server.
      for (let start = 0; start < picked.length; start += COPY_AT_ONCE) {
        const body = { job_photo_ids: picked.slice(start, start + COPY_AT_ONCE) };
        const data = await api("/api/site/images/from-jobs", { method: "POST", body });
        added.push(...data.images);
        said.push(...data.left_out.map((entry) => entry.why));
      }
    } catch (error) {
      said.push(error.message);
    }
    setCopying(false);
    setPicked([]);
    if (said.length) setProblem([...new Set(said)].join(" "));
    if (added.length) onCopied(added, said.length === 0);
  }

  const inSite = new Set(library.images.map((image) => image.id));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Pick the ones to show on your site. Each is copied into your site&apos;s photos, without where or when it was taken. Only use photos your
        customer is happy to have shown.
      </p>
      {(problem || got.problem) && <Alert tone="danger">{problem || got.problem}</Alert>}
      {photos.length === 0 && !loading ? (
        <p className="rounded-lg bg-surface-2 px-3 py-8 text-center text-sm text-muted">No job photos yet. Photos your crew adds to jobs show up here.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => {
            const there = photo.site_image && inSite.has(photo.site_image);
            return (
              <Tile
                key={photo.id}
                src={apiUrl(photo.thumb_url)}
                label={`${photo.job}, ${photo.date}${photo.caption ? `: ${photo.caption}` : ""}`}
                picked={picked.includes(photo.id)}
                onPick={() => toggle(photo.id)}
                disabled={!photo.can_use || there || copying}
                badge={there ? "In your photos" : photo.can_use ? null : "HEIC: cannot be shown"}
              />
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {loading && <Spinner />}
        {got.more && !loading && (
          <Button variant="ghost" size="sm" onClick={() => setWanted(wanted + 1)}>Show more</Button>
        )}
        <Button size="sm" onClick={copy} disabled={!picked.length || copying || picked.length > room}>
          {copying ? "Copying…" : picked.length ? `Add ${picked.length} to my photos` : "Add to my photos"}
        </Button>
        {picked.length > room && <span className="text-xs text-danger">Your site has room for {Math.max(0, room)} more.</span>}
      </div>
    </div>
  );
}

// The site's photos in a dialog. With choosing: pick one (or several) for a block and
// press Use; onChoose gets their ids. Without: just a place to add and delete photos.
// library: { images, max, enabled }. onLibrary(change) updates it: change(images) -> images.
export default function PhotoLibrary({ library, onLibrary, choosing = null, lookOnly = false, onChoose, onClose }) {
  const [tab, setTab] = useState("mine");
  const [picked, setPicked] = useState([]);
  const several = Boolean(choosing?.several);

  const pick = (id) =>
    setPicked((current) => {
      if (!choosing) return [];
      if (current.includes(id)) return current.filter((each) => each !== id);
      return several ? [...current, id] : [id];
    });

  const tabClass = (name) =>
    cx("rounded-lg px-3 py-1.5 text-sm font-medium", tab === name ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg");

  return (
    <Modal
      title={choosing ? (several ? "Pick photos" : "Pick a photo") : "Your site's photos"}
      description="Photos you add here are yours to use anywhere on your site."
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-4">
        {!lookOnly && (
          <div className="flex gap-1" role="tablist" aria-label="Where photos come from">
            <button type="button" role="tab" aria-selected={tab === "mine"} className={tabClass("mine")} onClick={() => setTab("mine")}>My site&apos;s photos</button>
            <button type="button" role="tab" aria-selected={tab === "jobs"} className={tabClass("jobs")} onClick={() => setTab("jobs")}>From my jobs</button>
          </div>
        )}
        {tab === "mine" ? (
          <MyPhotos
            library={library}
            picked={picked}
            onPick={pick}
            lookOnly={lookOnly}
            onAdded={(image) => {
              onLibrary((images) => [image, ...images]);
              // A photo just added is most likely the one wanted.
              if (choosing) setPicked((current) => (several ? [...current, image.id] : [image.id]));
            }}
            onDeleted={(id) => {
              onLibrary((images) => images.filter((image) => image.id !== id));
              setPicked((current) => current.filter((each) => each !== id));
            }}
          />
        ) : (
          <JobPhotos
            library={library}
            onCopied={(added, all) => {
              onLibrary((images) => [...added.filter((image) => !images.some((each) => each.id === image.id)), ...images]);
              if (choosing) setPicked((current) => (several ? [...new Set([...current, ...added.map((image) => image.id)])] : [added[0].id]));
              if (all) setTab("mine");
            }}
          />
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>{choosing ? "Cancel" : "Done"}</Button>
          {choosing && (
            <Button onClick={() => onChoose(picked)} disabled={!picked.length}>
              {several ? (picked.length ? `Use ${picked.length} ${picked.length === 1 ? "photo" : "photos"}` : "Use photos") : "Use this photo"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
