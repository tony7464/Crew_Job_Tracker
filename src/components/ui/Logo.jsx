import { cx } from "./styles";

// The brand mark: a map pin with a check, for "job done".
export function LogoMark({ className = "h-9 w-9" }) {
  return (
    <span className={cx("relative flex shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-glow", className)}>
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none" aria-hidden="true">
        <path
          d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="m8.8 10.2 2.3 2.3 4.2-4.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />
    </span>
  );
}
