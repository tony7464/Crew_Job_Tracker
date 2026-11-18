// Run with: npm test (node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteJobCopy } from "../src/utils/deleteJob.js";

test("a regular job", () => {
  assert.deepEqual(deleteJobCopy({ kind: "work", series_id: null }), {
    label: "Delete job",
    description: "Removes this job, its notes log, and its photos. This cannot be undone.",
  });
});

test("an estimate visit keeps its quote", () => {
  const copy = deleteJobCopy({ kind: "estimate" });
  assert.equal(copy.label, "Delete visit");
  assert.match(copy.description, /Its quote stays as a draft\./);
  assert.match(copy.description, /This cannot be undone\.$/);
});

test("a visit in a repeating series says the rest of the series stays", () => {
  const copy = deleteJobCopy({ kind: "work", series_id: 7 });
  assert.match(copy.description, /Only this visit is removed; the rest of the repeating series stays\./);
  assert.match(copy.description, /This cannot be undone\.$/);
});

test("a job that has not loaded yet still gets safe wording", () => {
  assert.equal(deleteJobCopy(undefined).label, "Delete job");
});
