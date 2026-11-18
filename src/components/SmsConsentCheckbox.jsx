import { useId } from "react";
import { smsConsentText } from "../utils/smsConsent";

// The box a customer ticks to agree to job texts. Put it right under their phone number, on
// the same form. It is never ticked for anyone, never required, and says the same words
// everywhere (utils/smsConsent.js). Pass checked/onChange, or defaultChecked, like any checkbox.
// hint: a line under it, starting "Optional". links: show the Privacy Policy and Terms of
// Service right there, as customer-facing forms must (they open in a new tab, so nothing typed
// is lost).
export default function SmsConsentCheckbox({ businessName, hint, links = false, className, ...props }) {
  const hintId = useId();
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="sms_consent"
          {...props}
          aria-describedby={hint || links ? hintId : undefined}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded"
        />
        <span className="text-sm leading-relaxed text-fg">{smsConsentText(businessName)}</span>
      </label>
      {(hint || links) && (
        <p id={hintId} className="mt-1.5 pl-7 text-xs text-muted">
          {hint}
          {hint && links && " "}
          {links && (
            <>
              See our{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="link">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="link">
                Terms of Service
              </a>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}
