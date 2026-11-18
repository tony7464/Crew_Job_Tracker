import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "./api";
import { useAuth } from "./context/useAuth";
import { isOwner } from "./utils/roles";
import { PICKER_SIZE, clientSearchPath } from "./utils/clientSearch";
import { stripeLiveFrom } from "./utils/invoices";

// `load` must be a stable function (api or fetchAll), not an inline arrow.
// Change reloadKey to fetch the same path again.
export function useAsync(load, path, reloadKey = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    load(path)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [load, path, reloadKey]);

  return { data, setData, error };
}

export function usePaged(path, query = "") {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    let cancelled = false;
    api(`${path}?${params}`)
      .then((data) => {
        if (cancelled) return;
        // The last row on this page was deleted, so step back.
        if (data.items.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        // A load that worked clears the error of an earlier one (a dropped connection, say).
        setError(null);
        setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [path, query, page, reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function reset() {
    if (page !== 1) setPage(1);
    else reload();
  }

  return { page, setPage, result, setResult, error, reload, reset };
}

// Wait this long after the last change before searching clients.
const CLIENT_SEARCH_DELAY = 300;

// Active clients matching query (GET /api/clients?q=, see utils/clientSearch.js), searched a
// moment after typing stops. "" searches nothing. What comes back is for this query only:
// while a newer one waits or loads, items is empty and loading is true, so a slow answer to
// an earlier query never shows. error: this search failed (items is then empty); retry()
// searches the same words again.
export function useClientSearch(query, { perPage = PICKER_SIZE } = {}) {
  const path = clientSearchPath(query, perPage);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState({ key: "", items: [], total: 0, error: null });
  const key = path ? `${attempt} ${path}` : "";

  useEffect(() => {
    if (!path) return undefined;
    const searched = `${attempt} ${path}`;
    let cancelled = false;
    const timer = setTimeout(() => {
      api(path)
        .then((page) => {
          if (!cancelled) setAnswer({ key: searched, items: page.items, total: page.total, error: null });
        })
        .catch((error) => {
          if (!cancelled) setAnswer({ key: searched, items: [], total: 0, error });
        });
    }, CLIENT_SEARCH_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [path, attempt]);

  const current = Boolean(key) && answer.key === key;
  return {
    items: current ? answer.items : [],
    total: current ? answer.total : 0,
    error: current ? answer.error : null,
    loading: Boolean(key) && !current,
    retry: () => setAttempt((count) => count + 1),
  };
}

// Whether the business has any active clients, for a form that needs one: null until known.
// One client is asked for, not the whole list. A failed check counts as yes, so the form
// still shows and its client search says what went wrong. enabled false: true, nothing asked.
export function useHasClients(enabled = true) {
  const [has, setHas] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api("/api/clients?per_page=1")
      .then((page) => {
        if (!cancelled) setHas(page.total > 0);
      })
      .catch(() => {
        if (!cancelled) setHas(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? has : true;
}

export function useSubmit(onSubmit, resetOnSuccess) {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event, body) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(body);
      if (resetOnSuccess) event.target.reset();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return { error, submitting, handleSubmit };
}

// GET /api/schedule (or another schedule path, such as /api/schedule/team) for a
// { start, end } range (inclusive "YYYY-MM-DD" dates).
// Keeps the last data while the next range loads, so the calendar does not flash.
// Bump reloadKey to fetch the same range again.
export function useSchedule(range, reloadKey = 0, path = "/api/schedule") {
  const [state, setState] = useState({ key: null, data: null, error: null });
  const key = range ? `${path}|${range.start}|${range.end}|${reloadKey}` : null;

  useEffect(() => {
    if (!range) return undefined;
    const requestKey = `${path}|${range.start}|${range.end}|${reloadKey}`;
    let cancelled = false;
    api(`${path}?start=${range.start}&end=${range.end}`)
      .then((data) => {
        if (!cancelled) setState({ key: requestKey, data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState((current) => ({ ...current, key: requestKey, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey, path]);

  function setData(update) {
    setState((current) => ({ ...current, data: update(current.data) }));
  }

  return { data: state.data, error: state.error, loading: state.key !== key, setData };
}

const PREFS_PATH = "/api/me/schedule_preferences";
export const DEFAULT_SCHEDULE_PREFS = { view: null, hidden_employee_ids: [], show_unassigned: true, show_lunches: true };
// Wait this long after the last change before saving, so a run of clicks is one request.
const PREFS_SAVE_DELAY = 400;

// Sends PATCHes one at a time, each with every field changed since the last save.
function createPrefsSaver(onSaved, onError) {
  let pending = {};
  let timer = null;
  let saving = false;

  async function flush() {
    clearTimeout(timer);
    timer = null;
    if (saving || !Object.keys(pending).length) return;
    const body = pending;
    pending = {};
    saving = true;
    try {
      await api(PREFS_PATH, { method: "PATCH", body });
      onSaved();
    } catch (error) {
      // Keep the failed fields so Retry (or the next change) sends them again.
      pending = { ...body, ...pending };
      onError(error);
      return;
    } finally {
      saving = false;
    }
    if (Object.keys(pending).length) flush();
  }

  return {
    queue(patch) {
      Object.assign(pending, patch);
      clearTimeout(timer);
      timer = setTimeout(flush, PREFS_SAVE_DELAY);
    },
    flush,
    // On unmount: send anything still waiting, without waiting for the delay.
    flushPending() {
      if (timer) flush();
    },
  };
}

// The logged-in user's own team schedule settings, saved on the server.
// prefs is null until loaded; if loading fails, the defaults are used and loadError is set.
// update(patch) changes them right away and saves shortly after.
export function useSchedulePrefs() {
  const [prefs, setPrefs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saver] = useState(() => createPrefsSaver(() => setSaveError(null), setSaveError));

  useEffect(() => {
    let cancelled = false;
    api(PREFS_PATH)
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setPrefs(DEFAULT_SCHEDULE_PREFS);
        setLoadError(error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => saver.flushPending(), [saver]);

  function update(patch) {
    setPrefs((current) => ({ ...current, ...patch }));
    saver.queue(patch);
  }

  function dismissErrors() {
    setLoadError(null);
    setSaveError(null);
  }

  return { prefs, loadError, saveError, update, retry: saver.flush, dismissErrors };
}

function subscribeMedia(query) {
  return (onChange) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}

// True while the CSS media query matches; follows window resizes.
export function useMediaQuery(query) {
  const [subscribe] = useState(() => subscribeMedia(query));
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

// now() again every minute, for "now" lines.
export function useMinuteClock(now) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), 60000);
    return () => clearInterval(id);
  }, []);
  return now();
}

// A horizontal swipe on a touch screen: left for next, right for previous.
// Spread the returned handlers on the swipe area and give it touch-action: pan-y, so
// vertical scrolling still works. Mostly vertical moves, slow drags, mouse input,
// gestures that start inside a sideways-scrolling [data-noswipe] area, and calendar
// drags are ignored.
const SWIPE_MIN_PX = 56;
const SWIPE_MAX_MS = 800;

export function useSwipe({ onPrev, onNext, enabled = true }) {
  const start = useRef(null);
  return {
    onPointerDown(event) {
      start.current = null;
      if (!enabled || event.pointerType === "mouse" || !event.isPrimary) return;
      const scroller = event.target.closest?.("[data-noswipe]");
      if (scroller && scroller.scrollWidth > scroller.clientWidth) return;
      start.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    },
    onPointerUp(event) {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (Date.now() - from.time > SWIPE_MAX_MS) return;
      if (document.querySelector(".fc-event-dragging, .fc-event-resizing")) return;
      if (dx < 0) onNext();
      else onPrev();
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}

// The requests inbox badge. Pages call notifyRequestsChanged() after opening or
// changing a request, so the menu count updates without waiting for the next poll.
const REQUESTS_CHANGED = "cjt:requests-changed";
const UNREAD_POLL_MS = 60000;

export function notifyRequestsChanged() {
  window.dispatchEvent(new Event(REQUESTS_CHANGED));
}

// New requests nobody has opened, for people who can see the inbox. 0 otherwise.
// Re-checks when pathname changes, every minute, and on notifyRequestsChanged().
export function useUnreadRequests(enabled, pathname) {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const bump = () => setTick((value) => value + 1);
    const id = setInterval(bump, UNREAD_POLL_MS);
    window.addEventListener(REQUESTS_CHANGED, bump);
    return () => {
      clearInterval(id);
      window.removeEventListener(REQUESTS_CHANGED, bump);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api("/api/requests/unread_count")
      .then((data) => {
        if (!cancelled) setCount(data.count);
      })
      .catch(() => {
        // The badge is a hint; a failed check keeps the last count.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname, tick]);

  return enabled ? count : 0;
}

// Stable, for useAsync when nothing is to be fetched.
function nothing() {
  return Promise.resolve(null);
}

// GET /api/business/texting: how the business's texts to customers are doing (TextingAlert).
// Owners only: for anyone else, and with enabled false, it is null and nothing is asked, as
// the server would refuse it.
export function useTextingSummary(enabled = true) {
  const { user } = useAuth();
  const ask = enabled && isOwner(user);
  const { data } = useAsync(ask ? api : nothing, ask ? "/api/business/texting" : "");
  return ask ? data : null;
}

// The server's Stripe mode, from GET /api/business/stripe, the answer Settings shows
// (SettingsPaymentsCard), read as Settings reads it (stripeLiveFrom in utils/invoices.js):
// true when it takes real payments, false in test or mock mode, and null until it answers,
// when it cannot, or while Stripe is not configured. With enabled false it is null and
// nothing is asked, so a page only asks when a link needs it (needsServerMode).
export function useStripeLive(enabled = true) {
  const { data } = useAsync(enabled ? api : nothing, enabled ? "/api/business/stripe" : "");
  return enabled ? stripeLiveFrom(data) : null;
}
