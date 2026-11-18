import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement as h } from "react";
import {
  PICKER_SIZE,
  clientDetail,
  clientLabel,
  clientMatches,
  clientSearchPath,
  isSearchShortcut,
  matchParts,
  phoneMatchParts,
  startingClient,
  startingNote,
  startingPick,
} from "../src/utils/clientSearch.js";
import { code, startVite, words } from "./ssr.js";

// Finding clients by what was typed (utils/clientSearch.js): the search the pickers send, where
// a job form's client picker starts, and what the client list marks as found.

let app;

before(async () => {
  app = await startVite();
});

after(async () => {
  await app?.close();
});

// The query string of an API path, as the server reads it.
function params(path) {
  return Object.fromEntries(new URLSearchParams(path.split("?")[1]));
}

test("a search asks for active clients matching the words, one short page of them", () => {
  const path = clientSearchPath("  Pat Rivera ");
  assert.match(path, /^\/api\/clients\?/);
  assert.deepEqual(params(path), { q: "Pat Rivera", per_page: String(PICKER_SIZE) });
  // The new-visit suggestions ask for 5.
  assert.deepEqual(params(clientSearchPath("5125550199", 5)), { q: "5125550199", per_page: "5" });
  // Whatever is typed reaches the server as typed.
  assert.equal(params(clientSearchPath("50% off & #2 +1 (512)")).q, "50% off & #2 +1 (512)");
  // Nothing typed, nothing asked.
  for (const blank of ["", "   ", null, undefined]) assert.equal(clientSearchPath(blank), "");
  // Never archived clients: nobody picks one for new work.
  assert.doesNotMatch(clientSearchPath("pat"), /archived/);
});

test("each match shows its address and phone, so two clients with the same name can be told apart", () => {
  assert.equal(clientDetail({ name: "Lee", address: "5 Elm St", phone: "402-555-0101" }), "5 Elm St · 402-555-0101");
  assert.equal(clientDetail({ name: "Lee", address: null, phone: "402-555-0102" }), "402-555-0102");
  assert.equal(clientDetail({ name: "Lee", address: "9 Pine Rd" }), "9 Pine Rd");
  assert.equal(clientDetail({ name: "Lee" }), "");
  assert.equal(clientLabel({ name: "Lee", archived: false }), "Lee");
  assert.equal(clientLabel({ name: "Lee", archived: true }), "Lee (archived)");
  assert.equal(clientLabel(null), "");
});

test("a job form starts from the job's own client, or from a client id in a link", () => {
  const job = {
    id: 3, client_id: 7, client_name: "Pat Rivera", client_address: "12 Oak St", client_phone: "(512) 555-0199",
  };
  assert.deepEqual(startingClient(job), { id: 7, name: "Pat Rivera", address: "12 Oak St", phone: "(512) 555-0199" });
  // /jobs?client=7 passes the id as text, and no name.
  assert.deepEqual(startingClient({ client_id: "7" }), { id: 7, name: null, address: null, phone: null });
  for (const none of [null, undefined, {}, { client_id: "" }, { client_id: "abc" }, { client_id: "0" }, { client_id: "-3" }, { client_id: "1.5" }]) {
    assert.equal(startingClient(none), null, JSON.stringify(none));
  }
});

test("editing a job keeps its client picked, archived or not, and says when it is archived", () => {
  const start = startingClient({ id: 3, client_id: 7, client_name: "Pat Rivera", client_address: "12 Oak St" });
  // Shown at once from the job, while the client loads.
  const loading = startingPick(start, null, true);
  assert.deepEqual(loading, { id: 7, name: "Pat Rivera", address: "12 Oak St", phone: null, archived: false });
  assert.equal(startingNote(start, null, loading), "");
  const archived = startingPick(start, { id: 7, name: "Pat Rivera", address: "12 Oak St", phone: null, archived: true }, true);
  assert.equal(archived.id, 7);
  assert.equal(clientLabel(archived), "Pat Rivera (archived)");
  // Could not be loaded: still the job's client, by the name the job has.
  const failed = startingPick(start, false, true);
  assert.equal(clientLabel(failed), "Pat Rivera");
  assert.equal(startingNote(start, false, failed), "");
});

test("a link to a client that no longer exists says so, instead of blaming the connection", () => {
  const start = startingClient({ client_id: "42" });
  assert.equal(startingPick(start, "missing", false), null);
  assert.equal(startingNote(start, "missing", null), "That client no longer exists. Search for another client.");
  // Editing a job keeps its client's name even then.
  const editing = startingClient({ id: 3, client_id: 42, client_name: "Pat Rivera" });
  assert.equal(startingPick(editing, "missing", true).name, "Pat Rivera");
});

test("a new job from a link loads the client's name, and never starts on an archived client", () => {
  const start = startingClient({ client_id: "7" });
  assert.equal(startingPick(start, null, false), null);
  assert.equal(startingNote(start, null, null), "Loading the client…");
  const loaded = { id: 7, name: "Pat Rivera", address: "12 Oak St", phone: "(512) 555-0199", archived: false, jobs: [] };
  const picked = startingPick(start, loaded, false);
  assert.deepEqual(picked, { id: 7, name: "Pat Rivera", address: "12 Oak St", phone: "(512) 555-0199", archived: false });
  assert.equal(startingNote(start, loaded, picked), "");
  // Archived: not picked, and the form says why.
  const archived = { ...loaded, archived: true };
  assert.equal(startingPick(start, archived, false), null);
  assert.match(startingNote(start, archived, null), /archived/);
  // Not found (or another business's): unknown, so the person searches instead.
  assert.equal(startingPick(start, false, false), null);
  assert.equal(startingNote(start, false, null), "That client could not be loaded. Search for them instead.");
  // Picking someone else ends the note.
  assert.equal(startingNote(start, false, { id: 9, name: "Lee" }), "");
  // No client to start from: nothing picked, nothing to say.
  assert.equal(startingPick(null, null, false), null);
  assert.equal(startingNote(null, null, null), "");
});

test("a job's own archived client, which no search returns, is matched as the server would match it", () => {
  const old = {
    id: 6, name: "Old Co", address: "1 Old Rd", phone: "+1 (512) 555-0606", email: "old@example.com", notes: "Tags: VIP",
  };
  for (const query of ["old co", " OLD RD ", "old@ex", "tags: vip", "5125550606", "555-0606", "1-512-555-0606"]) {
    assert.equal(clientMatches(old, query), true, query);
  }
  // Too few digits to search phones by, or nothing of theirs.
  for (const query of ["", "  ", "new", "55", "0707"]) assert.equal(clientMatches(old, query), false, query);
  assert.equal(clientMatches(null, "old"), false);
  assert.equal(clientMatches({ id: 7, name: "Kim", phone: null }, "555"), false);
});

// The parts as text, with the marked ones in [brackets].
function shown(parts) {
  return parts.map((part) => (part.match ? `[${part.text}]` : part.text)).join("");
}

test("the client list marks every match, in any case", () => {
  assert.equal(shown(matchParts("Ann Lee, Ann's place", "ANN")), "[Ann] Lee, [Ann]'s place");
  assert.equal(shown(matchParts("Company: Acme Roofing", " acme ")), "Company: [Acme] Roofing");
  assert.equal(shown(matchParts("Ann Lee", "")), "Ann Lee");
  assert.equal(shown(matchParts("Ann Lee", "zzz")), "Ann Lee");
  assert.deepEqual(matchParts("", "ann"), []);
  assert.deepEqual(matchParts(null, "ann"), []);
});

test("what was typed is matched as text, never as a pattern", () => {
  assert.equal(shown(matchParts("a.b and axb", "a.b")), "[a.b] and axb");
  assert.equal(shown(matchParts("Unit (B) 2", "(b)")), "Unit [(B)] 2");
  assert.equal(shown(matchParts("c++ and c", "c++")), "[c++] and c");
  assert.equal(shown(matchParts("50% off, 500 off", "50%")), "[50%] off, 500 off");
  for (const typed of ["[", "(", "\\", "$1", "*", "?", "^", "|", "{2}"]) {
    const text = `x ${typed} y`;
    assert.equal(shown(matchParts(text, typed)), `x [${typed}] y`, typed);
  }
  // Every part put together is the text, unchanged.
  const text = "Tags: VIP, Gutters\nCompany: Acme";
  assert.equal(matchParts(text, "a").map((part) => part.text).join(""), text);
});

test("a phone is marked where its digits match, however either one is written", () => {
  assert.equal(shown(phoneMatchParts("(512) 555-0101", "5550101")), "(512) [555-0101]");
  assert.equal(shown(phoneMatchParts("(512) 555-0101", "512-555-0101")), "([512) 555-0101]");
  // A US or Canada 1 in front is dropped from an 11-digit query, as on the server.
  assert.equal(shown(phoneMatchParts("(512) 555-0101", "1-512-555-0101")), "([512) 555-0101]");
  // ...and is not part of the number either: "1512" is not in +1 512 555 0101.
  assert.equal(shown(phoneMatchParts("+1 512 555 0101", "1512")), "+1 512 555 0101");
  assert.equal(shown(phoneMatchParts("+1 512 555 0101", "512")), "+1 [512] 555 0101");
  // Fewer than 3 digits, or none: phones are not searched, so nothing is marked.
  assert.equal(shown(phoneMatchParts("(512) 555-0101", "55")), "(512) 555-0101");
  assert.equal(shown(phoneMatchParts("(512) 555-0101", "Ann")), "(512) 555-0101");
  assert.deepEqual(phoneMatchParts("", "555"), []);
});

test('"/" jumps to the search box, but not while typing in a field', () => {
  const press = (target, extra = {}) => isSearchShortcut({ key: "/", target, ...extra });
  assert.equal(press({ tagName: "BODY" }), true);
  assert.equal(press({ tagName: "BUTTON" }), true);
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) assert.equal(press({ tagName }), false, tagName);
  assert.equal(press({ tagName: "DIV", isContentEditable: true }), false);
  for (const held of ["ctrlKey", "metaKey", "altKey", "isComposing", "defaultPrevented"]) {
    assert.equal(press({ tagName: "BODY" }, { [held]: true }), false, held);
  }
  assert.equal(isSearchShortcut({ key: "?", target: { tagName: "BODY" } }), false);
});

test("the client picker is a combobox with a list of options, and a hidden field with the picked id", async () => {
  const { default: ClientSearchPicker } = await app.load("/src/components/ClientSearchPicker.jsx");
  const html = await app.render(h(ClientSearchPicker, { name: "client_id" }));
  const input = html.match(/<input[^>]*role="combobox"[^>]*>/)?.[0] ?? "";
  assert.ok(input, "no combobox");
  assert.match(input, /aria-autocomplete="list"/);
  assert.match(input, /aria-expanded="false"/);
  assert.match(input, /maxLength="100"|maxlength="100"/);
  assert.match(input, /min-h-11/);
  const listId = input.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(listId, "no aria-controls");
  const list = html.match(/<ul[^>]*role="listbox"[^>]*>/)?.[0] ?? "";
  assert.ok(list.includes(` id="${listId}"`), `the listbox is not ${listId}: ${list}`);
  // The label names the field.
  const inputId = input.match(/\sid="([^"]+)"/)?.[1];
  const label = html.match(/<label[^>]*>Client<\/label>/)?.[0] ?? "";
  assert.ok(label.includes(` for="${inputId}"`), `the label is not for ${inputId}: ${label}`);
  assert.match(html, /<input type="hidden" name="client_id" value=""\/>/);
  // Each option is tall enough to tap, and only active clients are searched.
  const picker = code("src/components/ClientSearchPicker.jsx");
  assert.match(picker, /role="option"/);
  assert.match(picker, /"flex min-h-11 cursor-pointer/);
  assert.doesNotMatch(picker, /include_archived/);
});

test("the job form keeps a job's client picked, by id, and asks no client list", async () => {
  const { default: JobForm } = await app.load("/src/components/JobForm.jsx");
  const job = {
    id: 3, client_id: 7, client_name: "Pat Rivera", client_address: "12 Oak St", client_phone: "(512) 555-0199",
    service_type: "Windows", date: "2026-11-20", time: "09:00", duration_minutes: 60, price: "120.00",
    status: "scheduled", paid: false, assignees: [],
  };
  const html = await app.render(h(JobForm, { employees: [], initial: job, onSubmit() {}, submitLabel: "Save changes" }));
  assert.match(html.match(/<input[^>]*role="combobox"[^>]*>/)?.[0] ?? "", /value="Pat Rivera"/);
  assert.match(html, /<input type="hidden" name="client_id" value="7"\/>/);
  assert.match(words(html), /12 Oak St · \(512\) 555-0199/);
  assert.doesNotMatch(html, /<select[^>]*name="client_id"/);
  // A new job starts with nobody picked.
  const blank = await app.render(h(JobForm, { employees: [], initial: null, onSubmit() {}, submitLabel: "Add job" }));
  assert.match(blank, /<input type="hidden" name="client_id" value=""\/>/);
  // Nothing loads every client for a job or quote form any more.
  for (const path of ["src/components/JobForm.jsx", "src/pages/JobsPage.jsx", "src/pages/JobDetail.jsx", "src/pages/QuoteDetail.jsx", "src/components/calendar/TeamSchedule.jsx"]) {
    assert.doesNotMatch(code(path), /fetchAll\(\s*"\/api\/clients"/, path);
  }
});
