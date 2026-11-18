// Class helpers shared by the UI components. Kept out of .jsx files so Fast Refresh
// only sees components there.

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_BASE =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold " +
  "transition duration-150 active:scale-[.97] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55";

const BUTTON_VARIANTS = {
  primary: "bg-brand text-primary-fg shadow-glow hover:-translate-y-px hover:brightness-110",
  secondary: "border border-border-strong bg-surface text-fg shadow-card hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  soft: "bg-primary-soft text-primary-soft-fg hover:bg-surface-3",
  danger: "bg-danger text-danger-fg shadow-card hover:bg-danger-hover",
  "danger-outline": "border border-danger/45 text-danger hover:bg-danger-soft",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-9 w-9",
};

export function buttonClass({ variant = "primary", size = "md", block = false, className } = {}) {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block && "w-full", className);
}

export const BADGE_TONES = {
  neutral: "bg-neutral-soft text-neutral-soft-fg",
  primary: "bg-primary-soft text-primary-soft-fg",
  success: "bg-success-soft text-success-soft-fg",
  warning: "bg-warning-soft text-warning-soft-fg",
  danger: "bg-danger-soft text-danger-soft-fg",
};

export const STATUS_TONES = {
  scheduled: "primary",
  completed: "success",
  cancelled: "neutral",
};

// Service request statuses.
export const REQUEST_STATUS_TONES = {
  new: "primary",
  quoted: "warning",
  won: "success",
  lost: "neutral",
};

// Quote statuses.
export const QUOTE_STATUS_TONES = {
  draft: "neutral",
  sent: "primary",
  accepted: "success",
  declined: "danger",
};

// Invoice statuses.
export const INVOICE_STATUS_TONES = {
  draft: "neutral",
  sent: "primary",
  paid: "success",
  void: "neutral",
};
