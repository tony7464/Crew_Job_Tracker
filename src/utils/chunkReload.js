// Pages are loaded on first use, from files whose names change with every deploy. A tab
// opened before a deploy asks for files that are gone, and the page fails to load.
// Reloading gets the new version. This reloads once, and not again within a minute, so
// a file that is really missing cannot put the tab in a loop.

const KEY = "cjt.reloadedForNewVersionAt";
const MIN_GAP_MS = 60_000;

// What browsers say when a page's file cannot be loaded.
const CHUNK_ERRORS = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite, for a page's stylesheet
];

export function isChunkLoadError(error) {
  const message = typeof error === "string" ? error : error?.message || "";
  return CHUNK_ERRORS.some((pattern) => pattern.test(message));
}

// lastReloadAt: when this tab last reloaded itself (ms), or NaN if never.
export function shouldReload(lastReloadAt, now) {
  return !Number.isFinite(lastReloadAt) || now - lastReloadAt > MIN_GAP_MS;
}

// Reload the tab to pick up a new version. Returns whether it did.
// Without storage to remember the last reload there is no guard against a loop, so it does nothing.
export function reloadForNewVersion({
  storage = window.sessionStorage,
  now = Date.now(),
  reload = () => window.location.reload(),
} = {}) {
  try {
    const last = Number.parseInt(storage.getItem(KEY) || "", 10);
    if (!shouldReload(last, now)) return false;
    storage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}
