import { useId } from "react";
import { cx } from "./styles";

// An on/off switch with a label and an optional description beside it.
export function Switch({ checked, onChange, label, description, disabled = false }) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-fg">{label}</p>
        {description && <p id={descriptionId} className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-55",
          checked ? "bg-primary" : "bg-surface-3 ring-1 ring-inset ring-border-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-block h-5 w-5 rounded-full bg-surface shadow-card transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
