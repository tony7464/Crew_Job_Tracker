import { joinApiBase } from "./utils/apiBase";

const FORBIDDEN = "You do not have access to this. Ask the business owner if you need it.";

// VITE_API_BASE is read when the client is BUILT, not at runtime: it is baked into
// the static files. Empty (the default) keeps relative /api paths, for the Vite
// proxy and the Flask-served app. Set it, such as https://api.crewjobtrack.com, to
// call an API on another host; changing that host means rebuilding the client.
const API_BASE = import.meta.env.VITE_API_BASE || "";

// The URL for an API path ("/api/..."), on VITE_API_BASE when it is set.
// Use it for API URLs the browser loads directly, such as <img src>.
export function apiUrl(path) {
  return joinApiBase(API_BASE, path);
}

function retryAfterSeconds(response) {
  const seconds = Number.parseInt(response.headers.get("Retry-After") || "", 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function messageFrom(data, status, retryAfter) {
  // 429: too many attempts (logins, forms, reminders, "on my way"). Show the server's message as written.
  if (status === 429) {
    const limited = data.errors && Object.values(data.errors).flat();
    if (limited?.length) return limited.join(" ");
    return retryAfter
      ? `Too many attempts. Try again in ${retryAfter} ${retryAfter === 1 ? "second" : "seconds"}.`
      : "Too many attempts. Wait a minute and try again.";
  }
  // The owner has not verified their email yet: the server's sentence, without a field prefix.
  if (status === 403 && data.code === "email_unverified" && data.errors?.email) {
    return [].concat(data.errors.email).join(" ");
  }
  // A bare 403 has no useful detail; specific 403s (such as the job status rule) keep theirs.
  const auth = data.errors?.auth;
  if (status === 403 && (!auth || (auth.length === 1 && auth[0] === "Forbidden"))) return FORBIDDEN;
  if (status === 403 && auth) return [].concat(auth).join(" ");
  if (data.errors) {
    return Object.entries(data.errors)
      .flatMap(([field, messages]) =>
        [].concat(messages).map((message) => `${field}: ${message}`),
      )
      .join(" ");
  }
  return data.error || "Something went wrong";
}

let onUnauthorized = () => {};
let onForbidden = () => {};

// 401: the session ended (logged out, deactivated, or password changed elsewhere).
export function setOnUnauthorized(handler) {
  onUnauthorized = handler;
}

// 403: still logged in but not allowed, often because the owner just changed this
// person's access. The handler re-checks the session so the menu catches up.
export function setOnForbidden(handler) {
  onForbidden = handler;
}

export async function api(path, { method = "GET", body, skipAuth = false } = {}) {
  // Every write says it is JSON, even with no body: the API refuses other writes
  // with 415 (a CSRF guard; see server/app.py).
  const write = method !== "GET" && method !== "HEAD";
  const response = await fetch(apiUrl(path), {
    method,
    credentials: "include",
    headers: write || body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(response, skipAuth);
}

// POST a FormData body as multipart/form-data, such as one job photo. The browser
// sets the Content-Type (with its boundary); the API accepts multipart writes.
export async function apiUpload(path, formData, { method = "POST" } = {}) {
  const response = await fetch(apiUrl(path), { method, credentials: "include", body: formData });
  return handleResponse(response, false);
}

async function handleResponse(response, skipAuth) {
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !skipAuth) onUnauthorized();
  if (response.status === 403 && !skipAuth) onForbidden();
  if (!response.ok) {
    const retryAfter = response.status === 429 ? retryAfterSeconds(response) : null;
    const error = new Error(messageFrom(data, response.status, retryAfter));
    error.status = response.status;
    // The parsed body, so forms can show each field's errors next to the field.
    error.data = data;
    // Seconds until another attempt is allowed (429 only).
    if (retryAfter) error.retryAfter = retryAfter;
    throw error;
  }
  return data;
}

// per_page 50 is the API maximum, so a short list is one request.
export async function fetchAll(path) {
  const first = await api(`${path}?per_page=50`);
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await api(`${path}?per_page=50&page=${page}`);
    items.push(...next.items);
  }
  return items;
}
