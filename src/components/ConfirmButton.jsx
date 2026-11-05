import { useState } from "react";
import ErrorMessage from "./ErrorMessage";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Feedback";

// A two-step button for actions that cannot be undone, like replacing a calendar link.
export default function ConfirmButton({ label, confirmLabel, busyLabel, warning, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setConfirming(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {warning && <Alert tone="warning">{warning}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="danger-outline" size="sm" onClick={confirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}
