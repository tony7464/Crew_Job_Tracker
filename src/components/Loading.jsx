import { Skeleton, Spinner } from "./ui/Feedback";

// variant "page": a centered spinner. "list": placeholder rows while a list loads.
export default function Loading({ variant = "page", label = "Loading…" }) {
  if (variant === "list") {
    return (
      <div role="status" className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <span className="sr-only">{label}</span>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}
