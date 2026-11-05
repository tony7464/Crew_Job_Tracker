import { useState } from "react";
import ErrorMessage from "./ErrorMessage";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

// A "danger zone" card with a two-step delete.
export default function ConfirmDelete({ label, description, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }

  return (
    <Card className="border-danger/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-fg">{label}</p>
          <p className="mt-0.5 text-sm text-muted">{description || "This cannot be undone."}</p>
        </div>
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} disabled={deleting}>
              {deleting ? "Deleting…" : "Confirm delete"}
            </Button>
          </div>
        ) : (
          <Button variant="danger-outline" onClick={() => setConfirming(true)}>
            {label}
          </Button>
        )}
      </div>
      <ErrorMessage error={error} className="mt-3" />
    </Card>
  );
}
