// Run with: npm test (node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendLines,
  billQuantity,
  filterPriceBook,
  hoursFromMinutes,
  kindLabel,
  kindsIn,
  laborLine,
  materialLines,
} from "../src/utils/priceBook.js";
import { MAX_ITEMS, blankItem } from "../src/utils/quotes.js";

const BOOK = [
  { name: "Window cleaning", kind: "service", category: "Windows", unit: "window" },
  { name: "Gutter guard", kind: "material", category: "Gutters", description: "3 ft section" },
  { name: "Crew labor", kind: "labor", unit: "hour" },
  { name: "Old item with no kind" },
];

test("kinds have labels, and an unknown kind reads as a service", () => {
  assert.equal(kindLabel("material"), "Material");
  assert.equal(kindLabel("labor"), "Labor");
  assert.equal(kindLabel(undefined), "Service");
});

test("only the kinds in use are offered, in a fixed order", () => {
  assert.deepEqual(kindsIn(BOOK), ["service", "material", "labor"]);
  assert.deepEqual(kindsIn([BOOK[2], BOOK[1]]), ["material", "labor"]);
  assert.deepEqual(kindsIn([]), []);
});

test("filtering by kind and by every word typed", () => {
  const names = (options) => filterPriceBook(BOOK, options).map((item) => item.name);
  assert.deepEqual(names({ kind: "material" }), ["Gutter guard"]);
  assert.deepEqual(names({ kind: "service" }), ["Window cleaning", "Old item with no kind"]);
  assert.deepEqual(names({ query: "GUTTER 3 ft" }), ["Gutter guard"]);
  assert.deepEqual(names({ query: "hour", kind: "service" }), []);
  assert.equal(names({}).length, 4);
});

test("the number at the start of a free-text quantity becomes the line quantity", () => {
  assert.equal(billQuantity("2 gal"), "2");
  assert.equal(billQuantity(" 1.5 boxes"), "1.5");
  assert.equal(billQuantity("10 x 2x4x8"), "10");
  assert.equal(billQuantity(".5 lb"), "0.5");
  assert.equal(billQuantity("3.00"), "3");
  for (const none of ["", null, undefined, "a few", "0", "0.00 gal", "box of 12"]) {
    assert.equal(billQuantity(none), "1", String(none));
  }
});

test("a job's materials become lines; tools are left out", () => {
  const lines = materialLines([
    { name: "Gutter guard", quantity: "4 sections", kind: "material", unit_price: "12.50" },
    { name: "Extension ladder", quantity: "1", kind: "tool", unit_price: null },
    { name: "Rags", quantity: null, kind: "material", unit_price: null },
  ]);
  assert.deepEqual(
    lines.map(({ description, quantity, unit_price }) => [description, quantity, unit_price]),
    [
      ["Gutter guard", "4", "12.50"],
      ["Rags", "1", ""],
    ],
  );
  assert.ok(lines[0].key && lines[0].key !== lines[1].key);
  assert.deepEqual(materialLines(undefined), []);
});

test("clocked minutes become hours to two decimals", () => {
  assert.equal(hoursFromMinutes(90), "1.5");
  assert.equal(hoursFromMinutes(120), "2");
  assert.equal(hoursFromMinutes(50), "0.83");
  assert.equal(hoursFromMinutes(0), "0.01");
  const line = laborLine({ name: "Crew labor", description: "Two people", unit_price: "65.00" }, 135);
  assert.deepEqual([line.description, line.quantity, line.unit_price], ["Crew labor - Two people", "2.25", "65.00"]);
});

test("added lines replace an untouched last line and stop at the limit", () => {
  const typed = { ...blankItem(), description: "Gutter clean", unit_price: "150" };
  const extra = [{ ...blankItem(), description: "Sealant" }, { ...blankItem(), description: "Rags" }];

  const first = appendLines([typed, blankItem()], extra);
  assert.deepEqual(first.items.map((line) => line.description), ["Gutter clean", "Sealant", "Rags"]);
  assert.equal(first.added, 2);

  const full = Array.from({ length: MAX_ITEMS - 1 }, () => typed);
  const capped = appendLines(full, extra);
  assert.equal(capped.items.length, MAX_ITEMS);
  assert.equal(capped.added, 1);

  const none = appendLines([typed], []);
  assert.equal(none.added, 0);
  assert.deepEqual(none.items, [typed]);
});
