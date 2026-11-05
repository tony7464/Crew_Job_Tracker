import { cx } from "./styles";

// A surface with an optional header. flush drops the body padding, for lists and tables.
export function Card({ title, description, actions, children, className, bodyClassName, flush = false, as = "section" }) {
  const Tag = as;
  const hasHeader = Boolean(title || actions);
  return (
    <Tag className={cx("rounded-xl border border-border bg-surface shadow-card", className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
            {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div
        className={cx(
          flush ? hasHeader && "mt-4 border-t border-border" : "p-4 sm:p-5",
          !flush && hasHeader && "pt-4 sm:pt-4",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
