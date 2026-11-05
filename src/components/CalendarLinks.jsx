import { useState } from "react";
import ConfirmButton from "./ConfirmButton";
import { CalendarIcon, CheckIcon, CopyIcon, ExternalIcon } from "./ui/Icons";
import { buttonClass } from "./ui/styles";

const linkButton = buttonClass({ variant: "secondary", size: "md", className: "w-full sm:w-auto" });

// links: { feed_url, webcal_url, google_url } from the API.
export default function CalendarLinks({ links, onRegenerate }) {
  const [copied, setCopied] = useState(false);

  if (!links?.feed_url) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">No calendar link yet.</p>
        {onRegenerate && (
          <ConfirmButton
            label="Create calendar link"
            confirmLabel="Create link"
            busyLabel="Creating…"
            onConfirm={onRegenerate}
          />
        )}
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(links.feed_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the URL is in the box below to copy by hand.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href={links.google_url} target="_blank" rel="noopener noreferrer" className={linkButton}>
          <ExternalIcon />
          Add to Google Calendar
        </a>
        <a href={links.webcal_url} className={linkButton}>
          <CalendarIcon />
          Subscribe in Apple Calendar
        </a>
        <button type="button" onClick={copy} className={linkButton}>
          {copied ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon />}
          {copied ? "Copied" : "Copy feed URL"}
        </button>
      </div>
      <input
        readOnly
        value={links.feed_url}
        aria-label="Calendar feed URL"
        onFocus={(event) => event.target.select()}
        className="field font-mono text-xs sm:text-xs"
      />
      {onRegenerate && (
        <ConfirmButton
          label="Make a new link"
          confirmLabel="Replace link"
          busyLabel="Replacing…"
          warning="The current link stops working right away. Calendars subscribed to it will need the new link."
          onConfirm={onRegenerate}
        />
      )}
    </div>
  );
}
