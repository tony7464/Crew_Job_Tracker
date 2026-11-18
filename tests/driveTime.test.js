import assert from "node:assert/strict";
import { test } from "node:test";
import { driveText, durationText, locationProblem, suggestEta, tightCount, tightText } from "../src/utils/driveTime.js";

test("durations read in minutes, then hours", () => {
  assert.deepEqual([0, 1, 12, 59, 60, 65, 120, 135].map(durationText), ["0 min", "1 min", "12 min", "59 min", "1 h", "1 h 5 min", "2 h", "2 h 15 min"]);
  assert.equal(durationText(null), "0 min");
  assert.equal(durationText(-5), "0 min");
});

test("a drive reads as time and miles, and says when it is a guess", () => {
  assert.equal(driveText({ minutes: 12, miles: 4.1, estimated: false }), "12 min drive · 4.1 mi");
  assert.equal(driveText({ minutes: 9, miles: "4.5", estimated: true }), "about 9 min drive · 4.5 mi");
  assert.equal(driveText({ minutes: 75, miles: 52, estimated: false }), "1 h 15 min drive · 52.0 mi");
  assert.equal(driveText({ minutes: 0, miles: 0, estimated: false }), "Same address");
});

test("a drive that does not fit between two jobs says how", () => {
  assert.equal(tightText({ tight: false, gap_minutes: 140 }), "");
  assert.equal(tightText({ tight: true, gap_minutes: 10 }), "Only 10 min between these jobs");
  assert.equal(tightText({ tight: true, gap_minutes: 0 }), "No time between these jobs");
  assert.equal(tightText({ tight: true, gap_minutes: -30 }), "These jobs overlap by 30 min");
  const people = [{ legs: [{ tight: true }, { tight: false }] }, { legs: [{ tight: true }] }, { legs: [] }];
  assert.equal(tightCount(people), 2);
  assert.equal(tightCount(null), 0);
});

test("the arrival time picked for a drive is the first choice long enough", () => {
  const choices = [10, 20, 30, 45, 60, 90];
  assert.deepEqual([0, 10, 11, 20, 44, 61, 90, 200].map((minutes) => suggestEta(minutes, choices)), [10, 10, 20, 20, 45, 90, 90, 90]);
  assert.equal(suggestEta(25, [60, 30, 10]), 30);
});

test("each reason a location is missing has its own words", () => {
  assert.match(locationProblem(1), /turned off/);
  assert.match(locationProblem(3), /too long/);
  assert.match(locationProblem(2), /could not be found/);
  assert.match(locationProblem(undefined), /could not be found/);
});
