import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DESCRIPTION, isBlankLine, priceBookLine, splitDescription } from "../src/utils/quotes.js";

test("a price book item becomes a one-unit line with its name, detail, and price", () => {
  const line = priceBookLine({ name: "Gutter clean", description: "Two story", unit_price: "225.00" });
  assert.equal(line.description, "Gutter clean - Two story");
  assert.equal(line.quantity, "1");
  assert.equal(line.unit_price, "225.00");
  assert.ok(line.key);
  assert.equal(priceBookLine({ name: "Trip charge", description: null, unit_price: "40.00" }).description, "Trip charge");
});

test("a long detail goes under the name, and the whole line is cut to the limit", () => {
  const scope = "Repair of damaged drywall up to 1 square foot.\n\nExclusions: painting, priming.";
  const line = priceBookLine({ name: "Drywall patch", description: scope, unit_price: "269.06" });
  assert.equal(line.description, `Drywall patch\n${scope}`);
  assert.deepEqual(splitDescription(line.description), ["Drywall patch", scope]);
  // One long sentence goes under the name too.
  assert.equal(priceBookLine({ name: "Wash", description: "y".repeat(81), unit_price: "1" }).description, `Wash\n${"y".repeat(81)}`);
  assert.deepEqual(splitDescription("Gutter clean - Two story"), ["Gutter clean - Two story", ""]);
  assert.deepEqual(splitDescription(null), ["", ""]);

  const cut = priceBookLine({ name: "x".repeat(1500), description: "y".repeat(1500), unit_price: "1.00" });
  assert.equal(cut.description.length, MAX_DESCRIPTION);
});

test("only an untouched line counts as blank", () => {
  assert.equal(isBlankLine({ description: " ", quantity: "1", unit_price: "" }), true);
  assert.equal(isBlankLine({ description: "", quantity: "1", unit_price: "5" }), false);
  assert.equal(isBlankLine({ description: "Windows", quantity: "1", unit_price: "" }), false);
});
