import assert from "node:assert/strict";
import test from "node:test";
import { failureOf, percentOf, sendDirect, sendPhoto, startBody, uploadMode } from "../src/utils/directUpload.js";
import { PhotoError } from "../src/utils/images.js";

const blob = (size, type = "image/jpeg") => ({ size, type });
const BASE = "/api/jobs/3/photos";
const STARTED = {
  photo_id: 41,
  upload: { url: "https://r2.example/full", method: "PUT", headers: { "Content-Type": "image/jpeg" } },
  thumb_upload: { url: "https://r2.example/thumb", method: "PUT", headers: { "Content-Type": "image/jpeg" } },
  expires_in: 300,
};
const SAVED = { id: 41, kind: "before" };

function newSource(extra = {}) {
  return {
    blob: blob(900),
    thumb: { blob: blob(100), width: 400, height: 300 },
    width: 2048,
    height: 1536,
    name: "IMG_1.jpg",
    fields: { kind: "before" },
    ...extra,
  };
}

function httpError(status, message = "refused") {
  return Object.assign(new Error(message), { status });
}

// Fake network. replies: what each call returns, or an Error to throw, by step name.
function fakeDeps(replies = {}) {
  const calls = [];
  const next = (name, fallback) => {
    const queue = replies[name] || [];
    const reply = queue.length ? queue.shift() : fallback;
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return {
    calls,
    async api(path, options) {
      calls.push([options.method, path, options.body]);
      return path.endsWith("/upload-url") ? next("start", STARTED) : next("confirm", SAVED);
    },
    async put(target, body, onProgress) {
      calls.push(["PUT", target.url, body.size]);
      onProgress(body.size / 2);
      next("put", null);
      onProgress(body.size);
    },
    async form(source) {
      calls.push(["FORM", source.name]);
      return next("form", SAVED);
    },
  };
}

test("uploadMode follows what the photo list says", () => {
  assert.equal(uploadMode(undefined), "off");
  assert.equal(uploadMode({ enabled: false, direct_upload: false }), "off");
  assert.equal(uploadMode({ enabled: true, direct_upload: false }), "form");
  assert.equal(uploadMode({ enabled: true, direct_upload: true }), "direct");
});

test("startBody describes the photo and its thumbnail, never the file's path", () => {
  assert.deepEqual(startBody(newSource()), {
    content_type: "image/jpeg",
    size_bytes: 900,
    width: 2048,
    height: 1536,
    kind: "before",
    filename: "IMG_1.jpg",
    thumb: { content_type: "image/jpeg", size_bytes: 100 },
  });
  assert.deepEqual(startBody(newSource({ thumb: null, name: "", fields: {} })), {
    content_type: "image/jpeg",
    size_bytes: 900,
    width: 2048,
    height: 1536,
  });
});

test("percentOf stays between 0 and 99 until the photo is confirmed", () => {
  assert.equal(percentOf(0, 1000), 0);
  assert.equal(percentOf(455, 1000), 45);
  assert.equal(percentOf(1000, 1000), 99);
  assert.equal(percentOf(5000, 1000), 99);
  assert.equal(percentOf(10, 0), 0);
});

test("a direct upload asks for URLs, sends both files, then confirms", async () => {
  const deps = fakeDeps();
  const source = newSource();
  const seen = [];
  const photo = await sendDirect({ basePath: BASE, source, onProgress: (percent) => seen.push(percent) }, deps);
  assert.deepEqual(photo, SAVED);
  assert.deepEqual(deps.calls, [
    ["POST", `${BASE}/upload-url`, startBody(source)],
    ["PUT", "https://r2.example/full", 900],
    ["PUT", "https://r2.example/thumb", 100],
    ["POST", `${BASE}/41/confirm`, undefined],
  ]);
  // Progress covers both files and only ever goes up.
  assert.deepEqual(seen, [45, 90, 95, 99]);
});

test("a photo with no thumbnail sends one file", async () => {
  const deps = fakeDeps({ start: [{ ...STARTED, thumb_upload: null }] });
  await sendDirect({ basePath: BASE, source: newSource({ thumb: null }) }, deps);
  assert.deepEqual(
    deps.calls.map(([method]) => method),
    ["POST", "PUT", "POST"],
  );
});

test("a refused request for URLs sends nothing", async () => {
  const deps = fakeDeps({ start: [httpError(400, "photo: Photos must be JPEG, PNG, WebP, or HEIC.")] });
  await assert.rejects(sendDirect({ basePath: BASE, source: newSource() }, deps), { status: 400 });
  assert.equal(deps.calls.length, 1);
});

test("retry after a failed PUT starts over with fresh URLs", async () => {
  const deps = fakeDeps({
    put: [null, new Error("network error")],
    start: [STARTED, { ...STARTED, photo_id: 42 }],
  });
  const source = newSource();
  await assert.rejects(sendDirect({ basePath: BASE, source }, deps), /network error/);
  assert.equal(source.saved.sent, false);
  await sendDirect({ basePath: BASE, source }, deps);
  assert.deepEqual(
    deps.calls.map(([method, where]) => `${method} ${where}`),
    [
      `POST ${BASE}/upload-url`,
      "PUT https://r2.example/full",
      "PUT https://r2.example/thumb",
      `POST ${BASE}/upload-url`,
      "PUT https://r2.example/full",
      "PUT https://r2.example/thumb",
      `POST ${BASE}/42/confirm`,
    ],
  );
});

test("retry after a lost confirm reply only confirms again", async () => {
  const deps = fakeDeps({ confirm: [new Error("network error")] });
  const source = newSource();
  await assert.rejects(sendDirect({ basePath: BASE, source }, deps), /network error/);
  assert.deepEqual(source.saved, { photoId: 41, sent: true });
  const before = deps.calls.length;
  assert.deepEqual(await sendDirect({ basePath: BASE, source }, deps), SAVED);
  assert.deepEqual(deps.calls.slice(before), [["POST", `${BASE}/41/confirm`, undefined]]);
});

test("a confirm the server refuses ends that upload, and retry sends the photo again", async () => {
  const deps = fakeDeps({ confirm: [httpError(422, "photo: not saved")], start: [STARTED, { ...STARTED, photo_id: 43 }] });
  const source = newSource();
  await assert.rejects(sendDirect({ basePath: BASE, source }, deps), { status: 422 });
  assert.equal(source.saved, null);
  await sendDirect({ basePath: BASE, source }, deps);
  assert.deepEqual(deps.calls.at(-1), ["POST", `${BASE}/43/confirm`, undefined]);
});

test("sendPhoto uses the form when told to, and never asks for URLs", async () => {
  const deps = fakeDeps();
  assert.deepEqual(await sendPhoto({ mode: "form", basePath: BASE, source: newSource() }, deps), SAVED);
  assert.deepEqual(deps.calls, [["FORM", "IMG_1.jpg"]]);
});

test("sendPhoto on auto falls back to the form when direct uploads are off", async () => {
  const deps = fakeDeps({ start: [httpError(503, "photo: Direct photo uploads are not set up.")] });
  let fellBack = 0;
  const photo = await sendPhoto(
    { mode: "auto", basePath: BASE, source: newSource(), onFallback: () => (fellBack += 1) },
    deps,
  );
  assert.deepEqual(photo, SAVED);
  assert.equal(fellBack, 1);
  assert.deepEqual(
    deps.calls.map(([method]) => method),
    ["POST", "FORM"],
  );
});

test("sendPhoto on direct does not fall back", async () => {
  const deps = fakeDeps({ start: [httpError(503)] });
  await assert.rejects(sendPhoto({ mode: "direct", basePath: BASE, source: newSource() }, deps), { status: 503 });
  assert.equal(deps.calls.length, 1);
});

test("failureOf says what went wrong and whether Retry can help", () => {
  assert.deepEqual(failureOf(new PhotoError("This photo could not be opened.")), {
    message: "This photo could not be opened.",
    retry: false,
  });
  assert.deepEqual(failureOf(new Error("network error")), {
    message: "Could not upload. Check your connection and try again.",
    retry: true,
  });
  assert.deepEqual(failureOf(httpError(400, "photo: too big")), { message: "photo: too big", retry: false });
  assert.deepEqual(failureOf(httpError(503, "off")), { message: "off", retry: false });
  assert.deepEqual(failureOf(httpError(422, "not saved")), { message: "not saved", retry: true });
  assert.deepEqual(failureOf(httpError(502, "storage")), { message: "storage", retry: true });
  assert.deepEqual(failureOf(httpError(429, "slow down")), { message: "slow down", retry: true });
});
