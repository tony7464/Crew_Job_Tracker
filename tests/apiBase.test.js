// Run with: npm test (node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import { joinApiBase } from "../src/utils/apiBase.js";

test("empty base keeps relative /api paths", () => {
  assert.equal(joinApiBase("", "/api/check_session"), "/api/check_session");
  assert.equal(joinApiBase(undefined, "/api/jobs?page=2"), "/api/jobs?page=2");
  assert.equal(joinApiBase("   ", "/api/jobs"), "/api/jobs");
});

test("a set base prefixes the path with no double slash", () => {
  const base = "https://api.crewjobtrack.com";
  assert.equal(joinApiBase(base, "/api/check_session"), "https://api.crewjobtrack.com/api/check_session");
  assert.equal(joinApiBase(base + "/", "/api/jobs/1"), "https://api.crewjobtrack.com/api/jobs/1");
  assert.equal(joinApiBase(base + "//", "/api/jobs?when=today"), "https://api.crewjobtrack.com/api/jobs?when=today");
  assert.equal(joinApiBase(" http://localhost:5555 ", "/api/health"), "http://localhost:5555/api/health");
});

test("absolute and non-API URLs are left alone", () => {
  const base = "https://api.crewjobtrack.com";
  for (const url of [
    "https://checkout.stripe.com/c/pay/cs_test_1",
    "https://connect.stripe.com/setup/e/acct_1/xyz",
    "webcal://api.crewjobtrack.com/api/calendar/abc.ics",
    "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fx",
    "//evil.example/api/x",
    "blob:https://crewjobtrack.com/1234",
  ]) {
    assert.equal(joinApiBase(base, url), url);
  }
});
