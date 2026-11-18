import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_IMPORT_BYTES, fileProblem, importLabel, importSummary } from "../src/utils/importFile.js";

test("only a CSV of a sensible size is sent", () => {
  assert.equal(fileProblem({ name: "Jobber Clients 1 of 1.csv", size: 40_000 }), null);
  assert.equal(fileProblem({ name: "CLIENTS.CSV", size: MAX_IMPORT_BYTES }), null);
  assert.match(fileProblem(null), /Choose a CSV file/);
  assert.match(fileProblem({ name: "clients.xlsx", size: 40_000 }), /not Excel/);
  assert.match(fileProblem({ name: "clients.csv", size: 0 }), /empty/);
  assert.match(fileProblem({ name: "clients.csv", size: MAX_IMPORT_BYTES + 1 }), /too large/);
});

test("a look at a client list says what will happen", () => {
  const look = {
    kind: "clients",
    dry_run: true,
    rows: 193,
    new: 189,
    existing: 2,
    skipped_count: 2,
    archived: 1,
  };
  assert.deepEqual(importSummary(look), {
    title: "189 clients to add",
    lines: [
      "2 are already here and will be left as they are.",
      "2 rows will be left out. The list is below.",
      "They will be texted only after they agree to job texts. Ask them, then tick the box on their client page.",
      "1 is archived in Jobber and will be archived here too.",
    ],
  });
  assert.equal(importLabel(look), "Import 189 clients");
  assert.equal(importLabel({ kind: "clients", new: 1 }), "Import 1 client");
});

test("after saving, it says what happened", () => {
  const saved = { kind: "clients", dry_run: false, rows: 4, new: 2, existing: 1, skipped_count: 1, archived: 2 };
  assert.deepEqual(importSummary(saved), {
    title: "Added 2 clients",
    lines: [
      "1 is already here and left as it is.",
      "1 row left out. The list is below.",
      "They are texted only after they agree to job texts. Ask them, then tick the box on their client page.",
      "2 are archived in Jobber and are archived here too.",
    ],
  });
});

test("a price book is summed up by type", () => {
  const look = {
    kind: "price_book",
    dry_run: true,
    rows: 29,
    new: 29,
    existing: 0,
    skipped_count: 0,
    by_kind: { service: 4, material: 12, labor: 1 },
    archived: 2,
    shortened: 1,
  };
  assert.deepEqual(importSummary(look), {
    title: "29 price book items to add",
    lines: [
      "4 services, 12 materials, 1 labor item.",
      "2 are inactive in Jobber and will be hidden here.",
      "1 has a name or description too long to keep whole. It is cut to fit.",
    ],
  });
  assert.equal(importLabel(look), "Import 29 price book items");
});

test("a file with nothing new, or nothing at all, says so", () => {
  const base = { kind: "price_book", dry_run: true, existing: 0, skipped_count: 0, by_kind: {}, archived: 0, shortened: 0 };
  assert.equal(importSummary({ ...base, rows: 12, new: 0, existing: 12 }).title, "Nothing new in this file");
  assert.equal(importSummary({ ...base, rows: 0, new: 0 }).title, "This file has no rows");
});
