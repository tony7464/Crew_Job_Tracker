import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_BUSINESS_NAME, PLAN_OPTIONS, accessLength, ago, businessNameError, deletedThings, eventText, formatDate, formatWhen,
  planLabel, planName, sameName,
} from "../src/utils/admin.js";

test("a plan shows its price, and an agreed price beside the list price", () => {
  assert.equal(planLabel({ plan: null, plan_price_cents: null, list_price_cents: null }), "No plan");
  assert.equal(planLabel({ plan: "pro", plan_price_cents: null, list_price_cents: 9900 }), "Pro · $99.00 a month");
  assert.equal(planLabel({ plan: "crew", plan_price_cents: 1900, list_price_cents: 5900 }), "Crew · $19.00 a month (list $59.00)");
  // Free is a price too, and an agreed price equal to the list price needs no aside.
  assert.equal(planLabel({ plan: "solo", plan_price_cents: 0, list_price_cents: 2900 }), "Solo · $0.00 a month (list $29.00)");
  assert.equal(planLabel({ plan: "solo", plan_price_cents: 2900, list_price_cents: 2900 }), "Solo · $29.00 a month");
  assert.equal(planLabel({ plan: null, plan_price_cents: 1000, list_price_cents: null }), "No plan · $10.00 a month");
  assert.equal(planName("nope"), "No plan");
  assert.deepEqual(PLAN_OPTIONS.map(([value]) => value), ["", "solo", "crew", "pro"]);
});

test("how long ago something happened", () => {
  const now = Date.parse("2026-11-13T18:00:00Z");
  assert.equal(ago(null, now), "Never");
  assert.equal(ago("not a date", now), "Never");
  assert.equal(ago("2026-11-13T09:00:00+00:00", now), "Today");
  assert.equal(ago("2026-11-12T17:00:00+00:00", now), "Yesterday");
  assert.equal(ago("2026-11-01T18:00:00+00:00", now), "12 days ago");
  assert.equal(ago("2026-05-13T18:00:00+00:00", now), "6 months ago");
  assert.equal(ago("2023-11-13T18:00:00+00:00", now), "3 years ago");
  assert.equal(formatWhen(null), "");
  assert.equal(formatWhen("not a date"), "");
  assert.ok(formatWhen("2026-11-13T09:00:00+00:00").length > 5);
  // A calendar day keeps its day whatever the time zone.
  assert.equal(formatDate("2026-12-31"), "Dec 31, 2026");
  assert.equal(formatDate("2026-01-01"), "Jan 1, 2026");
  assert.equal(formatDate(null), "");
  assert.equal(formatDate("soon"), "");
});

test("support access lengths read as days", () => {
  assert.deepEqual([24, 72, 168].map(accessLength), ["1 day", "3 days", "7 days"]);
});

test("the record reads differently for the admin and for the owner", () => {
  const started = { action: "support_view_started", admin_name: "Root Owner", detail: null };
  assert.equal(eventText(started), "Root Owner started looking at this business");
  // The owner is never told which person.
  assert.equal(eventText(started, true), "Support started looking at your account");
  assert.equal(eventText({ action: "support_view_ended", admin_name: null }), "An admin stopped looking at this business");

  const on = { action: "support_access_on", detail: "For 3 days" };
  assert.equal(eventText(on), "The owner turned on support access for 3 days");
  assert.equal(eventText(on, true), "You turned on support access for 3 days");
  assert.equal(eventText({ action: "support_access_off" }, true), "You turned off support access");

  const reset = { action: "password_reset_sent", admin_name: "Root Owner", detail: "To Ann Owner" };
  assert.equal(eventText(reset), "Root Owner sent a password reset email to Ann Owner");
  assert.equal(eventText(reset, true), "Support sent a password reset email to Ann Owner");

  const plan = { action: "plan_changed", admin_name: "Root Owner", detail: "No plan -> Crew, $19.00 a month" };
  assert.equal(eventText(plan), "Root Owner changed the plan: No plan to Crew, $19.00 a month");
  assert.equal(eventText({ action: "admin_granted", detail: "ann (ann@example.com)" }), "Admin rights given to ann (ann@example.com)");
  assert.equal(eventText({ action: "admin_revoked", detail: null }), "Admin rights taken away");

  const down = { action: "site_unpublished", admin_name: "Root Owner", detail: "/site/ann-co" };
  assert.equal(eventText(down), "Root Owner took the website down (/site/ann-co)");
  assert.equal(eventText(down, true), "Support took your website down (/site/ann-co)");
  assert.equal(eventText({ action: "site_allowed", admin_name: "Root Owner", detail: "/site/ann-co" }, true), "Support allowed your website to be published again (/site/ann-co)");
  assert.equal(eventText({ action: "something_new", detail: null }), "something_new");
});

test("the record says what happened to a website's own address", () => {
  const admin = { admin_name: "Root Owner", detail: "www.ann-windows.com" };
  assert.equal(eventText({ action: "site_domain_connected", ...admin }), "Root Owner connected the website to its own address (www.ann-windows.com)");
  assert.equal(eventText({ action: "site_domain_connected", ...admin }, true), "Support connected your website to its own address (www.ann-windows.com)");
  assert.equal(eventText({ action: "site_domain_disconnected", ...admin }, true), "Support disconnected your website from its own address (www.ann-windows.com)");
  // Given up by the owner: the admin is reminded the address is still attached at the host.
  assert.equal(eventText({ action: "site_domain_released", detail: "www.ann-windows.com" }), "The owner gave up the website's own address (www.ann-windows.com). Remove it at the host");
  assert.equal(eventText({ action: "site_domain_released", detail: "www.ann-windows.com" }, true), "Your website stopped using its own address (www.ann-windows.com)");
});

test("deleting a business: its name has to be typed, and what goes is listed", () => {
  assert.ok(sameName("Ann Co", "Ann Co"));
  // Capitals and extra spaces aside.
  assert.ok(sameName("  ann   co ", "Ann Co"));
  for (const typed of ["", "Ann", "Ann Co.", "AnnCo", "Bob Co", null, undefined]) assert.ok(!sameName(typed, "Ann Co"), String(typed));
  // A business with no name to type is never matched by typing nothing.
  assert.ok(!sameName("", ""));
  assert.ok(!sameName("", null));

  const summary = { people: 3, clients: 6, jobs: 26, quotes: 1, invoices: 3, photos: 2, website: true, domain: null, stripe: true, keep_login: [] };
  assert.deepEqual(deletedThings(summary), [
    "3 people (the owner and the crew)",
    "6 clients",
    "26 jobs, with their notes and hours",
    "1 quote",
    "3 invoices, with their payments",
    "2 photos",
    "Its website",
  ]);
  // What a business does not have is not listed.
  const empty = { people: 1, clients: 0, jobs: 0, quotes: 0, invoices: 0, photos: 0, website: false, stripe: false, keep_login: [] };
  assert.deepEqual(deletedThings(empty), ["1 person (the owner)"]);

  const gone = { action: "business_deleted", admin_name: "Root Owner", detail: "Ann Co (business 12)" };
  assert.equal(eventText(gone), "Root Owner deleted a business for good: Ann Co (business 12)");
});

test("a business name must have words in it and fit the owner's own Settings limit", () => {
  assert.equal(MAX_BUSINESS_NAME, 80);
  assert.equal(businessNameError(""), "Enter the business's name.");
  assert.equal(businessNameError("   "), "Enter the business's name.");
  assert.equal(businessNameError(null), "Enter the business's name.");
  assert.equal(businessNameError("Jose's Gutters"), "");
  // Spaces at either end are trimmed before the length counts.
  assert.equal(businessNameError(` ${"x".repeat(80)} `), "");
  assert.equal(businessNameError("x".repeat(81)), "Use at most 80 characters.");
});

test("the record says when an admin set the business name, for the admin and the owner", () => {
  const renamed = { action: "business_renamed", admin_name: "Root Owner", detail: "(none) -> Jose's Gutters" };
  assert.equal(eventText(renamed), "Root Owner set the business name: (none) to Jose's Gutters");
  assert.equal(eventText(renamed, true), "Support set the business name: (none) to Jose's Gutters");
  assert.equal(eventText({ action: "business_renamed", admin_name: "Root Owner", detail: null }), "Root Owner set the business name");
});
