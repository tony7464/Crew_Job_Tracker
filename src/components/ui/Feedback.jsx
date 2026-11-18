import { AlertIcon, CheckIcon, InboxIcon, InfoIcon, XIcon } from "./Icons";
import { cx } from "./styles";

const ALERT_TONES = {
  danger: ["border-danger/30 bg-danger-soft text-danger-soft-fg", AlertIcon],
  success: ["border-success/30 bg-success-soft text-success-soft-fg", CheckIcon],
  warning: ["border-warning/30 bg-warning-soft text-warning-soft-fg", AlertIcon],
  info: ["border-primary/25 bg-primary-soft text-primary-soft-fg", InfoIcon],
};

export function Alert({ tone = "info", title, children, className }) {
  const [classes, Icon] = ALERT_TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm", classes, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("animate-spin text-primary", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-md bg-surface-3", className)} />;
}

export function EmptyState({ icon: Icon = InboxIcon, title, description, action, className }) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface/50 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 animate-float items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// A small message pinned to the bottom of the screen, for errors that should not
// block the page (such as a setting that did not save). action: a button element.
export function Toast({ tone = "danger", children, action, onClose }) {
  const [classes, Icon] = ALERT_TONES[tone];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role={tone === "danger" ? "alert" : "status"}
        className={cx(
          "pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-pop",
          classes,
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">{children}</div>
        {action}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="-mr-1 rounded-md p-1 opacity-75 hover:opacity-100"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
