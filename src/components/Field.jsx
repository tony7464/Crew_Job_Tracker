import { useId } from "react";
import { cx } from "./ui/styles";

// error: a message shown under the control in red; the control is marked invalid.
function Labeled({ label, hint, error, errorId, className, children }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {error ? (
        <span id={errorId} className="mt-1.5 block text-xs font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

function useErrorProps(error) {
  const errorId = useId();
  return [errorId, error ? { "aria-invalid": true, "aria-describedby": errorId } : {}];
}

export function Input({ label, hint, error, className, ...props }) {
  const [errorId, errorProps] = useErrorProps(error);
  return (
    <Labeled label={label} hint={hint} error={error} errorId={errorId} className={className}>
      <input {...props} {...errorProps} className={cx("field", error && "border-danger")} />
    </Labeled>
  );
}

export function TextArea({ label, hint, error, className, ...props }) {
  const [errorId, errorProps] = useErrorProps(error);
  return (
    <Labeled label={label} hint={hint} error={error} errorId={errorId} className={className}>
      <textarea {...props} {...errorProps} className={cx("field min-h-20", error && "border-danger")} />
    </Labeled>
  );
}

export function Select({ label, hint, error, className, children, ...props }) {
  const [errorId, errorProps] = useErrorProps(error);
  return (
    <Labeled label={label} hint={hint} error={error} errorId={errorId} className={className}>
      <select {...props} {...errorProps} className={cx("field", error && "border-danger")}>
        {children}
      </select>
    </Labeled>
  );
}

export function Checkbox({ label, description, className, ...props }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-3", className)}>
      <input type="checkbox" {...props} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded" />
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

// Right-aligned form buttons; stacked full width on phones.
export function FormActions({ children }) {
  return <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">{children}</div>;
}
