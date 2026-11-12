// Sending a job photo straight to storage (Cloudflare R2), in three steps:
//   1. ask the API for signed upload URLs (one for the photo, one for its thumbnail),
//   2. PUT the files to those URLs, which is where the bytes go: never through the API,
//   3. tell the API to confirm; it checks what arrived and the photo joins the job.
// The network calls are passed in (deps), so the steps can be tested without a browser.
import { PhotoError } from "./images.js";

const OFFLINE = "Could not upload. Check your connection and try again.";

// From the photo list's reply: "direct" (signed URLs), "form" (through the API, as in
// local development), or "off" (no photo storage: hide the uploader).
export function uploadMode(info) {
  if (!info?.enabled) return "off";
  return info.direct_upload ? "direct" : "form";
}

// The body for POST <basePath>/upload-url.
// source: { blob, thumb: { blob } | null, width, height, name, fields: { kind, caption } }.
export function startBody(source) {
  const body = {
    content_type: source.blob.type || "image/jpeg",
    size_bytes: source.blob.size,
    width: source.width,
    height: source.height,
    ...source.fields,
  };
  if (source.name) body.filename = source.name;
  if (source.thumb) {
    body.thumb = { content_type: source.thumb.blob.type || "image/jpeg", size_bytes: source.thumb.blob.size };
  }
  return body;
}

// A whole percent from bytes sent. Stops at 99: 100 means the API has confirmed the photo.
export function percentOf(loaded, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(99, Math.floor((loaded / total) * 100)));
}

// PUT a blob to a signed URL. target: { url, method, headers } from the API.
// onProgress(bytesSent). Signed URLs are secrets for a few minutes: never log them.
export function putBlob(target, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(target.method || "PUT", target.url);
    Object.entries(target.headers || {}).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => onProgress?.(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(blob.size);
        resolve();
      } else {
        reject(new Error("storage refused the upload"));
      }
    };
    request.onerror = () => reject(new Error("network error"));
    request.onabort = () => reject(new Error("upload stopped"));
    request.send(blob);
  });
}

// Upload one prepared photo and return the saved photo.
// deps: { api(path, options), put(target, blob, onProgress) }. onProgress(percent).
// source.saved remembers how far it got, so Retry after a lost confirm reply does not
// send the files again; a failed PUT starts over with fresh URLs (the old ones expire).
export async function sendDirect({ basePath, source, onProgress }, { api, put }) {
  if (!source.saved?.sent) {
    source.saved = null;
    const started = await api(`${basePath}/upload-url`, { method: "POST", body: startBody(source) });
    source.saved = { photoId: started.photo_id, sent: false };
    const parts = [[started.upload, source.blob]];
    if (started.thumb_upload && source.thumb) parts.push([started.thumb_upload, source.thumb.blob]);
    const total = parts.reduce((sum, [, blob]) => sum + blob.size, 0);
    const sent = parts.map(() => 0);
    for (const [index, [target, blob]] of parts.entries()) {
      await put(target, blob, (bytes) => {
        sent[index] = bytes;
        onProgress?.(percentOf(sent.reduce((sum, value) => sum + value, 0), total));
      });
    }
    source.saved.sent = true;
  }
  try {
    return await api(`${basePath}/${source.saved.photoId}/confirm`, { method: "POST" });
  } catch (err) {
    // The API answered and said no: this upload is over. No answer: confirm again on Retry.
    if (err.status) source.saved = null;
    throw err;
  }
}

// Upload one prepared photo the way the server allows.
// mode: "direct", "form", or "auto" (try direct; if the server has no direct uploads, use the form).
// deps: { api, put, form(source) } where form sends the photo through the API.
// onFallback() runs when "auto" had to use the form, so the caller can skip the try next time.
export async function sendPhoto({ mode, basePath, source, onProgress, onFallback }, deps) {
  if (mode === "form") return deps.form(source);
  try {
    return await sendDirect({ basePath, source, onProgress }, deps);
  } catch (err) {
    if (mode === "auto" && err.status === 503) {
      onFallback?.();
      return deps.form(source);
    }
    throw err;
  }
}

// What to show for a failed upload: { message, retry }.
export function failureOf(err) {
  // A photo the browser cannot open will never work.
  if (err instanceof PhotoError) return { message: err.message, retry: false };
  if (!err.status) return { message: OFFLINE, retry: true };
  // 400: the server refused this photo (type, size, or the job is full). 503: uploads are off.
  return { message: err.message, retry: err.status !== 400 && err.status !== 503 };
}
