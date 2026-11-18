import { Input } from "./Field";
import SmsConsentCheckbox from "./SmsConsentCheckbox";

// The public request form's way to reach the customer: their phone, with the box for consent
// to job texts right under it (unticked, never needed, with the Privacy Policy and Terms of
// Service beside it), then their email.
// onChange(name) and onBlur(name) return handlers for a field: the box is the field "sms_consent".
export default function RequestContactFields({ businessName, values, errors, onChange, onBlur }) {
  return (
    <>
      <div className="space-y-3">
        <Input
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={onChange("phone")}
          onBlur={onBlur("phone")}
          error={errors.phone}
          maxLength={30}
        />
        <SmsConsentCheckbox
          businessName={businessName}
          checked={values.sms_consent}
          onChange={onChange("sms_consent")}
          hint={
            values.sms_consent && !values.phone.trim()
              ? "Add your mobile number above to get texts."
              : "Optional. You can get service without agreeing to texts."
          }
          links
        />
      </div>
      <Input
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={values.email}
        onChange={onChange("email")}
        onBlur={onBlur("email")}
        error={errors.email}
        maxLength={254}
      />
      {errors.contact ? (
        <p className="-mt-2 text-xs font-medium text-danger" role="alert">{errors.contact}</p>
      ) : (
        <p className="-mt-2 text-xs text-muted">A phone number, an email address, or both.</p>
      )}
    </>
  );
}
