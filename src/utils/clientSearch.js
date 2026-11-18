// Finding clients by what was typed, for the client list and the client pickers. The server
// (GET /api/clients?q=, server/routes/clients.py) matches a client's name, address, email, or
// notes in any case, and their phone by its digits.

// How many clients a picker lists at once (the API sends at most 50).
export const PICKER_SIZE = 8;

// The search for clients matching query, as an API path, or "" when there is nothing to search
// for. Archived clients are never asked for: nobody picks one for new work.
export function clientSearchPath(query, perPage = PICKER_SIZE) {
  const q = String(query ?? "").trim();
  if (!q) return "";
  return `/api/clients?${new URLSearchParams({ q, per_page: String(perPage) })}`;
}

// The line under a client's name in a picker: their address and phone, so two clients with
// the same name can be told apart.
export function clientDetail(client) {
  return [client?.address, client?.phone].filter(Boolean).join(" · ");
}

// A picked client's name. An archived one (only ever a job's own client) says so.
export function clientLabel(client) {
  if (!client) return "";
  return client.archived ? `${client.name} (archived)` : client.name;
}

// The client a job form starts with, from its initial values (the job being edited, or prefill
// values such as { client_id } from a link): { id, name, address, phone }, or null. name is
// null when only the id is known; the picker loads the rest.
export function startingClient(initial) {
  const id = Number(initial?.client_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    id,
    name: initial.client_name || null,
    address: initial.client_address || null,
    phone: initial.client_phone || null,
  };
}

// The client a picker shows as picked before anyone picks one, from start (startingClient) and
// loaded: that client from GET /api/clients/<id>, null while it loads, false when it could not
// be loaded, or "missing" when there is no such client (deleted). keepArchived: the form edits
// a job already on this client, so an archived one stays picked; new work never goes to an
// archived client.
export function startingPick(start, loaded, keepArchived) {
  if (!start) return null;
  if (loaded === "missing" && !keepArchived) return null;
  if (loaded && typeof loaded === "object") {
    if (loaded.archived && !keepArchived) return null;
    return {
      id: loaded.id,
      name: loaded.name,
      address: loaded.address || null,
      phone: loaded.phone || null,
      archived: Boolean(loaded.archived),
    };
  }
  // Not loaded (yet): a name already known shows as it is, an id alone shows nothing.
  return start.name ? { ...start, archived: false } : null;
}

// Why a picker's starting client is not shown as picked, or "" when nothing needs saying.
export function startingNote(start, loaded, picked) {
  if (!start || picked) return "";
  if (loaded === null) return "Loading the client…";
  if (loaded === false) return "That client could not be loaded. Search for them instead.";
  if (loaded === "missing") return "That client no longer exists. Search for another client.";
  if (loaded.archived) return "That client is archived, so new jobs cannot be added for them. Search for another client.";
  return "";
}

// server/models.py phone_digits: the digits, without a US or Canada 1 in front of eleven.
function searchDigits(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return (digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits).slice(0, 20);
}

// Whether client matches query as the server's search would: name, address, email, or notes
// containing it in any case, or a phone with its digits (3 or more). For the one client a
// search never returns but a picker may still offer: the archived client a job is already on.
export function clientMatches(client, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!client || !needle) return false;
  const texts = [client.name, client.address, client.email, client.notes];
  if (texts.some((value) => String(value ?? "").toLowerCase().includes(needle))) return true;
  const digits = searchDigits(needle);
  return digits.length >= 3 && searchDigits(client.phone).includes(digits);
}

// The characters that mean something in a RegExp, so typed text is matched as it is.
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// text cut where pattern (a global RegExp) matches, from index from on.
function splitAt(text, pattern, from = 0) {
  const parts = [];
  let last = 0;
  pattern.lastIndex = from;
  for (let found = pattern.exec(text); found; found = pattern.exec(text)) {
    if (found.index > last) parts.push({ text: text.slice(last, found.index), match: false });
    parts.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

// text in parts, each match of query (any case, as typed, never as a pattern) marked, for
// showing what a search found: [{ text, match }]. No parts for no text.
export function matchParts(text, query) {
  const value = String(text ?? "");
  const needle = String(query ?? "").trim();
  if (!value) return [];
  if (!needle) return [{ text: value, match: false }];
  return splitAt(value, new RegExp(escapeRegExp(needle), "gi"));
}

// The same for a phone number, matched only by digits, as the server matches phones: with 3
// digits or more in the query, "5550101" marks "555-0101" however either one is written. A US
// or Canada 1 in front of the number's 11 digits is not part of it, as on the server.
export function phoneMatchParts(phone, query) {
  const value = String(phone ?? "");
  if (!value) return [];
  const digits = searchDigits(query);
  if (digits.length < 3) return [{ text: value, match: false }];
  const own = value.replace(/[^0-9]/g, "");
  const from = own.length === 11 && own.startsWith("1") ? value.search(/[0-9]/) + 1 : 0;
  return splitAt(value, new RegExp(digits.split("").join("\\D*"), "g"), from);
}

// Whether a key press is "/" to jump to the search box: not while typing in a field (an input,
// a text area, a select, or editable text), and not with Ctrl, Alt, or Cmd held.
export function isSearchShortcut(event) {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.defaultPrevented || event.isComposing) return false;
  const target = event.target;
  if (target?.isContentEditable) return false;
  return !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
}
