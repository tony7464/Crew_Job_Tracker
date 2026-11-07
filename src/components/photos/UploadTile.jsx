import { Spinner } from "../ui/Feedback";
import { AlertIcon, RefreshIcon, XIcon } from "../ui/Icons";
import { cx } from "../ui/styles";

// A photo still on its way to the server: a spinner, or the error with Retry.
export default function UploadTile({ item, onRetry, onRemove, removeLabel = "Remove photo" }) {
  const failed = item.status === "failed";
  const working = item.status === "preparing" || item.status === "uploading";
  return (
    <div
      className={cx(
        "relative aspect-square overflow-hidden rounded-lg border bg-surface-2",
        failed ? "border-danger" : "border-border",
      )}
    >
      {item.previewUrl && (
        <img src={item.previewUrl} alt="" className={cx("h-full w-full object-cover", working && "opacity-60")} />
      )}
      {working && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
          <span className="sr-only">{item.status === "preparing" ? "Preparing photo…" : "Uploading photo…"}</span>
        </span>
      )}
      {failed && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface/85 p-1.5 text-center">
          <AlertIcon className="h-4 w-4 text-danger" />
          <span className="line-clamp-3 text-[11px] font-medium leading-tight text-danger">{item.error}</span>
          {item.retry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs font-medium text-fg shadow-card hover:bg-surface-2"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </span>
      )}
      {(failed || item.status === "done") && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
