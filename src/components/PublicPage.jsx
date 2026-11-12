import ThemeToggle from "./ThemeToggle";
import { CheckIcon, InfoIcon } from "./ui/Icons";

// The frame for pages clients open from a link (request form, quote, invoice): no menu,
// no login, a theme toggle, and a small footer.
export function PublicShell({ title, footer, children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-xl items-center justify-end px-4 pt-3 print:hidden sm:px-6">
        <ThemeToggle />
      </div>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 sm:px-6">
        {title}
        {children}
      </main>
      <footer className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-subtle">
        {footer}
      </footer>
    </div>
  );
}

// The business's initial and name, or fallback when it has not set a name.
export function BusinessHeading({ name, fallback, subtitle }) {
  return (
    <header className="mb-5 flex items-center gap-3 sm:mb-6">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand font-display text-xl font-bold text-primary-fg shadow-glow"
      >
        {name ? name.trim().charAt(0).toUpperCase() : <CheckIcon className="h-6 w-6" />}
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-fg [overflow-wrap:anywhere] sm:text-2xl">{name || fallback}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
    </header>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

// A centered message card: thank-you, link not found, and so on.
export function StatusCard({ icon: Icon = InfoIcon, tone = "neutral", title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 text-center shadow-card sm:p-8">
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-fg">{title}</h2>
      <div className="mt-2 text-sm text-muted">{children}</div>
    </section>
  );
}
