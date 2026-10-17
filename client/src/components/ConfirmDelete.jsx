import { useState } from "react";
import ErrorMessage from "./ErrorMessage";

export default function ConfirmDelete({ label, onConfirm }) {
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
    <>
      <ErrorMessage error={error} />
      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={deleting}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="text-sm text-slate-600 hover:underline disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-700 hover:underline">
          {label}
        </button>
      )}
    </>
  );
}
