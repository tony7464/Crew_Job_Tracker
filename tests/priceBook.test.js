import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DESCRIPTION, isBlankLine, priceBookLine } from "../src/utils/quotes.js";

test("a price book item becomes a one-unit line with its name, detail, and price", () => {
  const line = priceBookLine({ name: "Gutter clean", description: "Two story", unit_price: "225.00" });
  assert.equal(line.description, "Gutter clean - Two story");
  assert.equal(line.quantity, "1");
  assert.equal(line.unit_price, "225.00");
  assert.ok(line.key);
  assert.equal(priceBookLine({ name: "Trip charge", description: null, unit_price: "40.00" }).description, "Trip charge");
});

test("long names are cut to the line limit", () => {
  const line = priceBookLine({ name: "x".repeat(150), description: "y".repeat(150), unit_price: "1.00" });
  assert.equal(line.description.length, MAX_DESCRIPTION);
});

test("only an untouched line counts as blank", () => {
  assert.equal(isBlankLine({ description: " ", quantity: "1", unit_price: "" }), true);
  assert.equal(isBlankLine({ description: "", quantity: "1", unit_price: "5" }), false);
  assert.equal(isBlankLine({ description: "Windows", quantity: "1", unit_price: "" }), false);
});
