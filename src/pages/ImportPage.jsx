import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { apiUpload, apiUrl } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert, Spinner } from "../components/ui/Feedback";
import { ExternalIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { buttonClass, cx } from "../components/ui/styles";
import { formatMoney } from "../utils/format";
import { fileProblem, importLabel, importSummary } from "../utils/importFile";
import { kindLabel } from "../utils/priceBook";

// The server's own sentence for a file it cannot use, without the "file:" in front.
function messageOf(error) {
  if (error.status === 413) return "This file is too large (over 1 MB). Split it into smaller files and import each one.";
  return error.data?.errors?.file?.[0] || error.message;
}

function send(file, dryRun) {
  const form = new FormData();
  form.append("file", file);
  form.append("dry_run", dryRun ? "true" : "false");
  return apiUpload("/api/import/jobber", form);
}

// The first few rows that will be added, so the owner can see the file was read right.
function Sample({ result }) {
  if (!result.sample?.length) return null;
  const clients = result.kind === "clients";
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {result.new > result.sample.length ? `The first ${result.sample.length}` : "What comes in"}
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {result.sample.map((row) => (
          <li key={row.row} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block font-medium text-fg [overflow-wrap:anywhere]">{row.name}</span>
              <span className="block text-xs text-muted [overflow-wrap:anywhere]">
                {clients
                  ? [row.address, row.phone, row.email].filter(Boolean).join(" · ") || "No address, phone, or email"
                  : kindLabel(row.kind)}
              </span>
            </span>
            {!clients && <span className="shrink-0 tabular-nums text-fg">{formatMoney(row.unit_price_cents)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Skipped({ result }) {
  if (!result.skipped_count) return null;
  return (
    <details className="rounded-lg border border-border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-fg">
        Rows left out ({result.skipped_count})
      </summary>
      <ul className="mt-2 space-y-1.5 text-muted">
        {result.skipped.map((row) => (
          <li key={row.row} className="[overflow-wrap:anywhere]">
            <span className="font-medium text-fg">
              Row {row.row}
              {row.name ? `, ${row.name}` : ""}:
            </span>{" "}
            {row.reason}
          </li>
        ))}
      </ul>
      {result.skipped_count > result.skipped.length && (
        <p className="mt-2 text-xs text-muted">And {result.skipped_count - result.skipped.length} more.</p>
      )}
    </details>
  );
}

function ImportCard() {
  const inputId = useId();
  const [file, setFile] = useState(null);
  // null, "reading" (a look), or "saving".
  const [busy, setBusy] = useState(null);
  const [look, setLook] = useState(null);
  const [done, setDone] = useState(null);
  const [problem, setProblem] = useState(null);

  async function choose(event) {
    const picked = event.target.files?.[0] || null;
    // Clear the box so the same file can be chosen again after fixing it.
    event.target.value = "";
    if (!picked) return;
    setLook(null);
    setDone(null);
    setFile(null);
    const wrong = fileProblem(picked);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    setProblem(null);
    setBusy("reading");
    try {
      setLook(await send(picked, true));
      setFile(picked);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("saving");
    setProblem(null);
    try {
      setDone(await send(file, false));
      setLook(null);
      setFile(null);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  const shown = done || look;
  const summary = shown && importSummary(shown);
  const destination = shown?.kind === "clients" ? ["/clients", "See your clients"] : ["/price-book", "See your price book"];

  return (
    <Card
      title="Import from Jobber"
      description="Choose the CSV of your client list, or of your Products and Services, exported from Jobber. You see what will be added before anything is saved."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={inputId}
            className={cx(
              buttonClass({ variant: shown ? "secondary" : "primary" }),
              "cursor-pointer has-focus-visible:ring-4 has-focus-visible:ring-ring",
              busy && "pointer-events-none opacity-55",
            )}
          >
            {shown ? "Choose another file" : "Choose a CSV file"}
            <input id={inputId} type="file" accept=".csv,text/csv" onChange={choose} disabled={Boolean(busy)} className="sr-only" />
          </label>
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <Spinner className="h-4 w-4" />
              {busy === "reading" ? "Reading the file…" : "Importing…"}
            </p>
          )}
          {file && !busy && <p className="min-w-0 text-sm text-muted [overflow-wrap:anywhere]">{file.name}</p>}
        </div>

        {problem && <Alert tone="danger">{problem}</Alert>}

        {shown && (
          <div className="space-y-4">
            <Alert tone={done ? "success" : "info"} title={summary.title}>
              {summary.lines.length > 0 && (
                <ul className="space-y-0.5">
                  {summary.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </Alert>
            {look && <Sample result={look} />}
            <Skipped result={shown} />
            {look && look.new > 0 && (
              <Button onClick={save} disabled={Boolean(busy)}>
                {importLabel(look)}
              </Button>
            )}
            {done && done.new > 0 && (
              <Link to={destination[0]} className={buttonClass({ variant: "secondary" })}>
                {destination[1]}
              </Link>
            )}
          </div>
        )}

        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-medium text-fg">What comes over</summary>
          <div className="mt-2 space-y-2">
            <p>
              <span className="font-medium text-fg">Clients.</span> Name, address, phone, and email. Jobber lists a
              client once for each service address; here each address with a street becomes its own client, because a
              job is done at its client&apos;s address. Other phones and emails, the company, the property name, tags, and the
              lead source go in the client&apos;s notes. Archived clients stay archived.
            </p>
            <p>
              <span className="font-medium text-fg">Price book.</span> Name, description, price, and type (Material,
              Labor, or Service). Inactive items come in hidden. Unit cost, duration, quantity limits, and taxable are
              not kept: there is no place for them here yet.
            </p>
            <p>
              An import only adds. What is already here is left as it is, so the same file can be imported twice, and a
              newer export only adds what is new.
            </p>
          </div>
        </details>
      </div>
    </Card>
  );
}

function ExportCard() {
  return (
    <Card
      title="Export"
      description="Download your clients or your price book as a CSV, to keep as a backup or open in a spreadsheet. The files use Jobber's columns, and can be imported here again."
    >
      <div className="flex flex-wrap gap-2">
        <a href={apiUrl("/api/export/clients.csv")} className={buttonClass({ variant: "secondary" })}>
          <ExternalIcon />
          Download clients
        </a>
        <a href={apiUrl("/api/export/price_book.csv")} className={buttonClass({ variant: "secondary" })}>
          <ExternalIcon />
          Download price book
        </a>
      </div>
    </Card>
  );
}

// Bring clients and the price book over from Jobber, and download them as CSV files. Owner only.
export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Import and export"
        description="Bring your clients and price book over from Jobber, or download them as CSV files."
      />
      <div className="space-y-6">
        <ImportCard />
        <ExportCard />
      </div>
    </div>
  );
}
