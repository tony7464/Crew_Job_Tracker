// Run with: npm test (node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import { axisTop, beforeLabel, bucketLabel, formatRate, labelledIndexes, rateTrend, trend, trendText } from "../src/utils/stats.js";

test("a count or an amount goes up, down, or stays", () => {
  assert.deepEqual(trend(150, 100), { direction: "up", percent: 50 });
  assert.deepEqual(trend(75, 100), { direction: "down", percent: 25 });
  assert.deepEqual(trend(1002, 1000), { direction: "flat", percent: 0 });
  assert.deepEqual(trend(0, 40), { direction: "down", percent: 100 });
});

test("with nothing before there is no percent, and with nothing at all no trend", () => {
  assert.deepEqual(trend(300, 0), { direction: "new", percent: null });
  assert.deepEqual(trend(300, null), { direction: "new", percent: null });
  assert.deepEqual(trend(0, 0), { direction: "none", percent: null });
  assert.deepEqual(trend(null, null), { direction: "none", percent: null });
});

test("rates move in percentage points", () => {
  assert.deepEqual(rateTrend(0.5, 0.25), { direction: "up", points: 25 });
  assert.deepEqual(rateTrend(0.3, 0.31), { direction: "down", points: 1 });
  assert.deepEqual(rateTrend(0.501, 0.5), { direction: "flat", points: 0 });
  assert.deepEqual(rateTrend(null, 0.5), { direction: "none", points: null });
  assert.deepEqual(rateTrend(0.5, null), { direction: "none", points: null });
});

test("rates print as whole percents, or a dash when there is nothing to divide by", () => {
  assert.equal(formatRate(0.3333), "33%");
  assert.equal(formatRate(1), "100%");
  assert.equal(formatRate(0), "0%");
  assert.equal(formatRate(null), "–");
});

test("the sentence under a number names the period before", () => {
  assert.equal(beforeLabel(30), "the 30 days before");
  assert.equal(beforeLabel(7), "the 7 days before");
  assert.equal(beforeLabel(91), "the 13 weeks before");
  assert.equal(trendText(trend(150, 100), 30), "50% more than the 30 days before");
  assert.equal(trendText(trend(75, 100), 7), "25% less than the 7 days before");
  assert.equal(trendText(trend(100, 100), 30), "Same as the 30 days before");
  assert.equal(trendText(trend(5, 0), 91), "None in the 13 weeks before");
  assert.equal(trendText(trend(0, 0), 30), "");
  assert.equal(trendText(rateTrend(0.5, 0.25), 30), "25 points higher than the 30 days before");
  assert.equal(trendText(rateTrend(0.3, 0.31), 30), "1 point lower than the 30 days before");
  assert.equal(trendText(rateTrend(null, 0.31), 30), "");
});

test("bars are labelled by day, or by the week they cover", () => {
  assert.equal(bucketLabel({ start: "2026-11-03", end: "2026-11-03" }), "Nov 3");
  assert.equal(bucketLabel({ start: "2026-11-03", end: "2026-11-09" }), "Nov 3 – Nov 9");
});

test("the axis tops out at a round number at or above the largest bar", () => {
  assert.equal(axisTop(0), 1);
  assert.equal(axisTop(87), 100);
  assert.equal(axisTop(100), 100);
  assert.equal(axisTop(130), 200);
  assert.equal(axisTop(240), 250);
  assert.equal(axisTop(38000), 50000);
  assert.equal(axisTop(6), 10);
});

test("about six bars are labelled, always the first and the last", () => {
  assert.deepEqual([...labelledIndexes(7)].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6].slice(0, 7).filter((i) => labelledIndexes(7).has(i)));
  assert.equal(labelledIndexes(5).size, 5);
  const month = labelledIndexes(30);
  assert.ok(month.has(0) && month.has(29));
  assert.ok(month.size >= 4 && month.size <= 6, String(month.size));
  const gaps = [...month].sort((a, b) => a - b).map((value, index, all) => (index ? value - all[index - 1] : null)).slice(1);
  assert.ok(Math.min(...gaps) >= 3, `labels too close: ${gaps}`);
  assert.ok(labelledIndexes(13).has(12));
});
