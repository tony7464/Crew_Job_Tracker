import { useEffect, useRef, useState } from "react";
import { api, apiUpload } from "../../api";
import { PhotoError, shrinkPhoto } from "../../utils/images";

let nextKey = 0;

// Photos picked on this device, uploaded to a job one at a time.
// Each item: { key, previewUrl, status: "preparing" | "uploading" | "failed" | "done", error, photo }.
// One request per photo, so a weak signal loses at most one, and Retry sends just that one again.
// onUploaded(photo) runs for each photo the server saved. keepDone: false drops saved
// photos from items (the caller shows them itself); true keeps them, to collect their ids.
export function usePhotoUploads(jobId, { onUploaded, keepDone = true } = {}) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const sources = useRef(new Map());
  const queue = useRef(Promise.resolve());
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    itemsRef.current = items;
    onUploadedRef.current = onUploaded;
  });
  // Free preview URLs when the component goes away.
  useEffect(() => () => itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)), []);

  function patch(key, change) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  async function send(key) {
    const source = sources.current.get(key);
    if (!source) return;
    try {
      if (!source.blob) {
        patch(key, { status: "preparing", error: null });
        const shrunk = await shrinkPhoto(source.file);
        source.blob = shrunk.blob;
        patch(key, { previewUrl: shrunk.previewUrl });
      }
      patch(key, { status: "uploading", error: null });
      const form = new FormData();
      form.append("photo", source.blob, "photo.jpg");
      form.append("kind", source.kind);
      const photo = await apiUpload(`/api/jobs/${jobId}/photos`, form);
      if (!sources.current.has(key)) {
        // Removed while uploading: take it back off the job.
        api(`/api/jobs/${jobId}/photos/${photo.id}`, { method: "DELETE" }).catch(() => {});
        return;
      }
      if (keepDone) {
        patch(key, { status: "done", photo });
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
      const message =
        err instanceof PhotoError
          ? err.message
          : err.status
            ? err.message
            : "Could not upload. Check your connection and try again.";
      // A photo the browser cannot open will never work; others can be retried.
      patch(key, { status: "failed", error: message, retry: !(err instanceof PhotoError) && err.status !== 400 });
    }
  }

  function enqueue(key) {
    queue.current = queue.current.then(() => send(key));
  }

  // files: a FileList or array. kind: before | after | progress | issue.
  function add(files, kind = "progress") {
    const added = [...files].map((file) => {
      const key = `upload-${(nextKey += 1)}`;
      sources.current.set(key, { file, kind, blob: null });
      return { key, previewUrl: null, status: "preparing", error: null, name: file.name };
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
      api(`/api/jobs/${jobId}/photos/${item.photo.id}`, { method: "DELETE" }).catch(() => {});
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
