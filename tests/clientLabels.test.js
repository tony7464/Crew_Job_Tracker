import assert from "node:assert/strict";
import { test } from "node:test";
import { clientLabels } from "../src/utils/clientLabels.js";

test("clients who share a name are told apart by address, then phone", () => {
  const labels = clientLabels([
    { id: 1, name: "Lee Landlord", address: "5 Elm Street, Omaha", phone: "402-555-0101" },
    { id: 2, name: "lee landlord ", address: "9 Pine Road, Lincoln", phone: "402-555-0101" },
    { id: 3, name: "Lee Landlord", address: null, phone: "402-555-0102" },
    { id: 4, name: "Lee Landlord", address: null, phone: null },
    { id: 5, name: "Pat Example", address: "12 Oak Street", phone: null },
  ]);
  assert.equal(labels.get(1), "Lee Landlord (5 Elm Street, Omaha)");
  assert.equal(labels.get(2), "lee landlord  (9 Pine Road, Lincoln)");
  assert.equal(labels.get(3), "Lee Landlord (402-555-0102)");
  assert.equal(labels.get(4), "Lee Landlord");
  // A name nobody shares stays as it is.
  assert.equal(labels.get(5), "Pat Example");
  assert.equal(clientLabels([]).size, 0);
});
