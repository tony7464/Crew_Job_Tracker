// Run with: npm test (node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import { isChunkLoadError, reloadForNewVersion, shouldReload } from "../src/utils/chunkReload.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

test("a page file that fails to load is recognised in every browser's wording", () => {
  const messages = [
    "Failed to fetch dynamically imported module: https://crewjobtrack.com/assets/InvoicesPage-abc.js",
    "error loading dynamically imported module: https://crewjobtrack.com/assets/InvoicesPage-abc.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/InvoicesPage-abc.css",
  ];
  for (const message of messages) {
    assert.equal(isChunkLoadError(new TypeError(message)), true, message);
    assert.equal(isChunkLoadError(message), true, message);
  }
});

test("ordinary errors are not treated as a new version", () => {
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'name')")), false);
  assert.equal(isChunkLoadError(new Error("Failed to fetch")), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError({}), false);
});

test("reload when the tab has not reloaded itself in the last minute", () => {
  assert.equal(shouldReload(NaN, 1_000_000), true);
  assert.equal(shouldReload(1_000_000 - 61_000, 1_000_000), true);
  assert.equal(shouldReload(1_000_000 - 59_000, 1_000_000), false);
  assert.equal(shouldReload(1_000_000, 1_000_000), false);
});

test("the first failure reloads once and remembers when", () => {
  const storage = fakeStorage();
  let reloads = 0;
  const reload = () => {
    reloads += 1;
  };
  assert.equal(reloadForNewVersion({ storage, now: 5_000_000, reload }), true);
  assert.equal(reloads, 1);
  // The file is still missing after the reload: do not loop.
  assert.equal(reloadForNewVersion({ storage, now: 5_002_000, reload }), false);
  assert.equal(reloads, 1);
  // A later deploy, well after the first: reload again.
  assert.equal(reloadForNewVersion({ storage, now: 5_000_000 + 10 * 60_000, reload }), true);
  assert.equal(reloads, 2);
});

test("without working storage nothing reloads, because nothing could stop a loop", () => {
  let reloads = 0;
  const blocked = {
    getItem: () => {
      throw new Error("storage is blocked");
    },
    setItem: () => {
      throw new Error("storage is blocked");
    },
  };
  assert.equal(reloadForNewVersion({ storage: blocked, now: 1, reload: () => (reloads += 1) }), false);
  const readOnly = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.equal(reloadForNewVersion({ storage: readOnly, now: 1, reload: () => (reloads += 1) }), false);
  assert.equal(reloads, 0);
});
