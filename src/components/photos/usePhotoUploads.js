import { useEffect, useRef, useState } from "react";
import { api, apiUpload } from "../../api";
import { failureOf, putBlob, sendPhoto } from "../../utils/directUpload";
import { FULL_SIDE, THUMB_SIDE, shrinkPhoto } from "../../utils/images";

let nextKey = 0;

// Photos picked on this device, uploaded one at a time to basePath, such as
// /api/jobs/3/photos or /api/quotes/7/photos (each photo is then at basePath/<id>).
// Each item: { key, previewUrl, status: "preparing" | "uploading" | "failed" | "done", percent, error, photo }.
// percent: how much has been sent (direct uploads only; null when unknown).
// One request per photo, so a weak signal loses at most one, and Retry sends just that one again.
// onUploaded(photo) runs for each photo the server saved. keepDone: false drops saved
// photos from items (the caller shows them itself); true keeps them, to collect their ids.
// mode: "form" sends each photo through the API. "direct" sends it straight to storage with
// signed URLs (job photos, when the photo list says direct_upload). "auto" tries direct and
// uses the form if the server has no direct uploads.
export function usePhotoUploads(basePath, { onUploaded, keepDone = true, mode = "form" } = {}) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const sources = useRef(new Map());
  const queue = useRef(Promise.resolve());
  const onUploadedRef = useRef(onUploaded);
  const modeRef = useRef(mode);
  // Set once "auto" finds the server has no direct uploads, so later photos skip the try.
  const formOnly = useRef(false);
  useEffect(() => {
    itemsRef.current = items;
    onUploadedRef.current = onUploaded;
    modeRef.current = mode;
  });
  // Free preview URLs when the component goes away.
  useEffect(() => () => itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)), []);

  function patch(key, change) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  function sendForm(source) {
    const form = new FormData();
    form.append("photo", source.blob, "photo.jpg");
    Object.entries(source.fields).forEach(([name, value]) => form.append(name, value));
    return apiUpload(basePath, form);
  }

  async function send(key) {
    const source = sources.current.get(key);
    if (!source) return;
    const sendMode = formOnly.current ? "form" : modeRef.current;
    try {
      if (!source.blob) {
        patch(key, { status: "preparing", error: null });
        // Direct uploads keep a larger photo and bring their own thumbnail.
        const shrunk = await shrinkPhoto(
          source.file,
          sendMode === "form" ? undefined : { maxSide: FULL_SIDE, thumbSide: THUMB_SIDE },
        );
        Object.assign(source, { blob: shrunk.blob, thumb: shrunk.thumb, width: shrunk.width, height: shrunk.height });
        patch(key, { previewUrl: shrunk.previewUrl });
      }
      patch(key, { status: "uploading", error: null, percent: sendMode === "form" ? null : 0 });
      const photo = await sendPhoto(
        {
          mode: sendMode,
          basePath,
          source,
          onProgress: (percent) => patch(key, { percent }),
          onFallback: () => {
            formOnly.current = true;
            patch(key, { percent: null });
          },
        },
        { api, put: putBlob, form: sendForm },
      );
      if (!sources.current.has(key)) {
        // Removed while uploading: take it back off the job.
        api(`${basePath}/${photo.id}`, { method: "DELETE" }).catch(() => {});
        return;
      }
      if (keepDone) {
        patch(key, { status: "done", photo, percent: null });
      } else {
        sources.current.delete(key);
        setItems((current) => {
          const item = current.find((entry) => entry.key === key);
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return current.filter((entry) => entry.key !== key);
        });
      }
      onUploadedRef.current?.(photo);
    } catch (err) {
      if (!sources.current.has(key)) return; // removed while uploading
      const { message, retry } = failureOf(err);
      patch(key, { status: "failed", error: message, retry, percent: null });
    }
  }

  function enqueue(key) {
    queue.current = queue.current.then(() => send(key));
  }

  // files: a FileList or array. fields: extra form fields, such as { kind: "before" }.
  function add(files, fields = {}) {
    const added = [...files].map((file) => {
      const key = `upload-${(nextKey += 1)}`;
      sources.current.set(key, { file, fields, blob: null, name: file.name });
      return { key, previewUrl: null, status: "preparing", percent: null, error: null, name: file.name };
    });
    setItems((current) => [...current, ...added]);
    added.forEach((item) => enqueue(item.key));
  }

  function retry(key) {
    patch(key, { status: "uploading", error: null });
    enqueue(key);
  }

  // Forget an item. A photo already saved is deleted from the job when deleteSaved is true.
  function remove(key, { deleteSaved = false } = {}) {
    const item = itemsRef.current.find((entry) => entry.key === key);
    sources.current.delete(key);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (deleteSaved && item?.photo) {
      api(`${basePath}/${item.photo.id}`, { method: "DELETE" }).catch(() => {});
    }
    setItems((current) => current.filter((entry) => entry.key !== key));
  }

  // Forget every item without deleting anything (after posting a note, say).
  function clear() {
    itemsRef.current.forEach((item) => {
      sources.current.delete(item.key);
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
  }

  const busy = items.some((item) => item.status === "preparing" || item.status === "uploading");
  return { items, add, retry, remove, clear, busy };
}
