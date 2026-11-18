// Helpers for the Import and export page. The API works out what a file is and what is
// new in it (server/routes/data_transfer.py); these check the file before it is sent and
// put the API's answer into words.

// The API takes requests up to 1 MB. This leaves room for the rest of the upload.
export const MAX_IMPORT_BYTES = 980_000;

// Why this file cannot be sent, or null when it can.
export function fileProblem(file) {
  if (!file) return "Choose a CSV file.";
  if (!/\.csv$/i.test(file.name || "")) {
    return "Choose a CSV file (its name ends in .csv). In Jobber, export as CSV, not Excel.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_IMPORT_BYTES) {
    return "This file is too large (over 1 MB). Split it into smaller files and import each one.";
  }
  return null;
}

const NOUNS = {
  clients: ["client", "clients"],
  price_book: ["price book item", "price book items"],
};
const KIND_NOUNS = [
  ["service", "service", "services"],
  ["material", "material", "materials"],
  ["labor", "labor item", "labor items"],
];

function count(number, one, many) {
  return `${number} ${number === 1 ? one : many}`;
}

// 1 of something "is", more "are".
function are(number) {
  return number === 1 ? "is" : "are";
}

// The API's answer as { title, lines }: what will happen (a look) or what happened (saved).
export function importSummary(result) {
  const [one, many] = NOUNS[result.kind];
  const saved = !result.dry_run;
  const lines = [];

  if (result.kind === "price_book" && result.new > 0) {
    const kinds = KIND_NOUNS.filter(([kind]) => result.by_kind?.[kind]).map(([kind, single, plural]) =>
      count(result.by_kind[kind], single, plural),
    );
    if (kinds.length) lines.push(`${kinds.join(", ")}.`);
  }
  if (result.existing > 0) {
    lines.push(
      `${result.existing} ${are(result.existing)} already here and ${saved ? "left" : "will be left"} as ${result.existing === 1 ? "it is" : "they are"}.`,
    );
  }
  if (result.skipped_count > 0) {
    lines.push(`${count(result.skipped_count, "row", "rows")} ${saved ? "left out" : "will be left out"}. The list is below.`);
  }
  if (result.kind === "clients" && result.new > 0) {
    lines.push(
      `${saved ? "They are" : "They will be"} texted only after they agree to job texts. Ask them, then tick the box on their client page.`,
    );
  }
  if (result.archived > 0) {
    lines.push(
      result.kind === "clients"
        ? `${result.archived} ${are(result.archived)} archived in Jobber and ${saved ? are(result.archived) : "will be"} archived here too.`
        : `${result.archived} ${are(result.archived)} inactive in Jobber and ${saved ? are(result.archived) : "will be"} hidden here.`,
    );
  }
  if (result.shortened > 0) {
    lines.push(`${result.shortened} ${result.shortened === 1 ? "has" : "have"} a name or description too long to keep whole. It is cut to fit.`);
  }

  let title;
  if (result.new === 0) title = result.rows === 0 ? "This file has no rows" : "Nothing new in this file";
  else title = saved ? `Added ${count(result.new, one, many)}` : `${count(result.new, one, many)} to add`;
  return { title, lines };
}

// The label of the button that saves a look.
export function importLabel(result) {
  const [one, many] = NOUNS[result.kind];
  return `Import ${count(result.new, one, many)}`;
}
