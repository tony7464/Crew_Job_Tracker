import assert from "node:assert/strict";
import test from "node:test";
import { isEstimate, overlaps } from "../src/utils/visits.js";

const job = (id, time, minutes, crew = [], extra = {}) => ({
  id,
  date: "2026-11-12",
  time,
  duration_minutes: minutes,
  status: "scheduled",
  assignees: crew.map((personId) => ({ id: personId })),
  ...extra,
});

test("overlaps finds bookings that share any minute", () => {
  const jobs = [job(1, "08:00:00", 60), job(2, "09:30:00", 30), job(3, "10:00:00", 60), job(4, "11:00:00", 60)];
  const found = overlaps(jobs, { date: "2026-11-12", time: "09:00", minutes: 90 });
  assert.deepEqual(found.map((item) => item.id), [2, 3]);
  // Touching end to start is not an overlap.
  assert.deepEqual(overlaps(jobs, { date: "2026-11-12", time: "10:00", minutes: 60 }).map((item) => item.id), [3]);
});

test("overlaps looks only at the chosen crew, the same day, and live jobs", () => {
  const jobs = [
    job(1, "09:00:00", 60, [7]),
    job(2, "09:00:00", 60, [8]),
    job(3, "09:00:00", 60, [7], { status: "cancelled" }),
    job(4, "09:00:00", 60, [7], { date: "2026-11-13" }),
  ];
  assert.deepEqual(overlaps(jobs, { date: "2026-11-12", time: "09:30", minutes: 30, crewIds: [7] }).map((item) => item.id), [1]);
  assert.deepEqual(overlaps(jobs, { date: "2026-11-12", time: "09:30", minutes: 30 }).map((item) => item.id), [1, 2]);
  assert.deepEqual(overlaps(jobs, { date: "2026-11-12", time: "09:30", minutes: 30, skipId: 1, crewIds: [7] }), []);
  assert.deepEqual(overlaps(jobs, { date: "", time: "09:30", minutes: 30 }), []);
});

test("isEstimate", () => {
  assert.equal(isEstimate({ kind: "estimate" }), true);
  assert.equal(isEstimate({ kind: "work" }), false);
  assert.equal(isEstimate(null), false);
});
