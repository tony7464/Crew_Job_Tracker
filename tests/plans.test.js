import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// plans.js imports JSON the Vite way; read the same file here so the test needs no bundler.
const data = JSON.parse(readFileSync(new URL("../src/config/plans.json", import.meta.url)));

test("plans have unique ids, whole-dollar prices, and rising crew limits", () => {
  const ids = data.plans.map((plan) => plan.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["solo", "crew", "pro"]);
  for (const plan of data.plans) {
    assert.ok(Number.isInteger(plan.monthly) && plan.monthly > 0, plan.id);
    assert.ok(plan.features.length > 0, plan.id);
  }
  const limits = data.plans.map((plan) => plan.crewLimit ?? Infinity);
  assert.deepEqual([...limits].sort((a, b) => a - b), limits);
  assert.equal(data.plans.filter((plan) => plan.popular).length, 1);
  assert.ok(data.everyPlan.length >= 5);
});

test("a year costs the months that are not free", () => {
  assert.equal(data.trialDays, 14);
  assert.equal(data.annualMonthsFree, 2);
  assert.equal(data.platformFeePercent, 0);
  const prices = Object.fromEntries(data.plans.map((plan) => [plan.id, plan.monthly * (12 - data.annualMonthsFree)]));
  assert.deepEqual(prices, { solo: 290, crew: 590, pro: 990 });
});
