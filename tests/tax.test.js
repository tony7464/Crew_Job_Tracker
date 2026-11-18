import assert from "node:assert/strict";
import { test } from "node:test";
import { breakdownText, isStale, rateForInput, sameRate, typedRate, zipFromAddress, zipLabel } from "../src/utils/tax.js";

test("the ZIP code is read out of an address the same way the server reads it", () => {
  assert.equal(zipFromAddress("1812 Madison Street, Omaha, Nebraska 68107"), "68107");
  assert.equal(zipFromAddress("77 Main Street, Suite 2, Bellevue, NE 68005-1234"), "68005");
  // A five-digit house number comes first; the ZIP code comes last.
  assert.equal(zipFromAddress("14493 County Road 35, Blair, Nebraska 68008"), "68008");
  assert.equal(zipFromAddress("14493 County Road 35, Blair, Nebraska"), null);
  assert.equal(zipFromAddress("14493 County Road 35"), null);
  assert.equal(zipFromAddress("68107"), "68107");
  assert.equal(zipFromAddress("68107-1234"), "68107");
  assert.equal(zipFromAddress("  Omaha   NE\n68107 "), "68107");
  // Phone numbers and longer numbers are not ZIP codes.
  assert.equal(zipFromAddress("Call 4025550101"), null);
  assert.equal(zipFromAddress("PO Box 123456"), null);
  assert.equal(zipFromAddress("12 Oak St"), null);
  assert.equal(zipFromAddress(""), null);
  assert.equal(zipFromAddress(null), null);
});

test("rates compare by value, however they are typed", () => {
  assert.equal(sameRate("7.5", "7.50"), true);
  assert.equal(sameRate(" 7.50 ", "7.5"), true);
  assert.equal(sameRate("0", "0.00"), true);
  assert.equal(sameRate("7", "7.50"), false);
  // Nothing typed is not the same as zero, and a missing rate matches nothing.
  assert.equal(sameRate("", "0.00"), false);
  assert.equal(sameRate("7.5", null), false);
  assert.equal(sameRate("seven", "7.00"), false);
  assert.equal(rateForInput("7.50"), "7.5");
  assert.equal(rateForInput("7.00"), "7");
  assert.equal(rateForInput(null), "");
});

test("only a rate that can be saved counts as typed", () => {
  assert.equal(typedRate("7.5"), "7.5");
  assert.equal(typedRate(" 0 "), "0");
  assert.equal(typedRate("100"), "100");
  for (const bad of ["", "7.123", "101", "-1", "seven", "7.", ".5", null]) assert.equal(typedRate(bad), null, String(bad));
});

test("a lookup reads as its parts, and gets old", () => {
  const parts = [
    { name: "Nebraska", rate: "5.50" },
    { name: "City of Omaha", rate: "2.00" },
  ];
  assert.equal(breakdownText(parts), "Nebraska 5.5% + City of Omaha 2%");
  assert.equal(breakdownText([]), "");
  assert.equal(breakdownText(null), "");

  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(isStale("2026-11-01T12:00:00+00:00", now), false);
  assert.equal(isStale("2026-07-01T12:00:00+00:00", now), true);
  assert.equal(isStale(null, now), false);
  assert.equal(isStale("not a date", now), false);
  assert.equal(zipLabel("68107", "Omaha, Nebraska"), "68107 (Omaha, Nebraska)");
  assert.equal(zipLabel("68107", ""), "68107");
});
