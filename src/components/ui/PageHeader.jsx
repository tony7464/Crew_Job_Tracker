import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "./Icons";

// back: { to, label } for a link above the title.
export function PageHeader({ title, description, actions, back, children }) {
  return (
    <header className="mb-6 sm:mb-8">
      {back && (
        <Link
          to={back.to}
          className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-muted hover:text-fg"
        >
          <ChevronLeftIcon />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{title}</h1>
          {description && <div className="mt-1.5 text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function SectionHeader({ title, description, actions }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
