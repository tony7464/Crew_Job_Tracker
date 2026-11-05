import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalIcon } from "./ui/Icons";
import { buttonClass } from "./ui/styles";

// A public link in a read-only box, with Copy and Open buttons.
export default function CopyLink({ url, label = "Link", openLabel = "Open client page" }) {
  const [copied, setCopied] = useState(false);
  const linkButton = buttonClass({ variant: "secondary", className: "w-full sm:w-auto" });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the link is in the box to copy by hand.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(event) => event.target.select()}
        className="field font-mono text-xs sm:text-xs"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={copy} className={linkButton}>
          {copied ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkButton}>
          <ExternalIcon />
          {openLabel}
        </a>
      </div>
    </div>
  );
}
