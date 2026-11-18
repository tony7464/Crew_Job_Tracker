import { useEffect, useState } from "react";
import { Input } from "../../components/Field";
import SmsConsentCheckbox from "../../components/SmsConsentCheckbox";
import { Button } from "../../components/ui/Button";
import { smsConfirmationText } from "../../utils/smsConsent";
import { LandingFooter, LandingHeader } from "./LandingPage";

const UPDATED = "November 16, 2026";

// Word for word what carriers are shown when business texting is registered (A2P 10DLC): the
// consent box every form in the app uses, and the confirmation text the app sends, both with
// "[Business]" for the name (utils/smsConsent.js). Keep them in step with the SMS Terms (LegalPage.jsx).
const CONFIRMATION = smsConfirmationText("[Business]");

// How a customer agrees to job texts, public so carriers can see it: a sample opt-in form, whose
// box starts unchecked and can be left that way, and the text that confirms the opt-in.
export default function SmsConsentPage() {
  const [tried, setTried] = useState(false);
  useEffect(() => {
    document.title = "SMS Consent: Crew Job Tracker";
    window.scrollTo({ top: 0 });
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, []);

  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-fg">SMS Consent</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
        <div className="mt-6 space-y-3 leading-relaxed text-muted">
          <p>
            Crew Job Tracker sends job update texts to customers on behalf of the service businesses that use it. Customers agree to them with the
            words and the optional box below, right under their phone number, in one of two ways:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>On the business&apos;s online request form, the customer ticks the box themselves.</li>
            <li>
              When a customer gives their number to the business in person or by phone, the business reads them these words and ticks the box on
              its client form only if they agree.
            </li>
          </ul>
          <p>In a real form, [Business] is the name of the business.</p>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-fg">Sample opt-in form</h2>
          <p className="mt-1 text-sm text-muted">A sample only: nothing typed here is sent or saved.</p>
          <form
            className="mt-4 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card"
            onSubmit={(event) => {
              event.preventDefault();
              setTried(true);
            }}
          >
            <div className="space-y-3">
              <Input label="Mobile phone number" type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="(555) 123-4567" />
              <SmsConsentCheckbox businessName="[Business]" hint="Optional. You can get service without agreeing to texts." links />
            </div>
            <Button type="submit">Submit</Button>
            {tried && (
              <p role="status" className="text-sm text-muted">
                This is a sample form, so nothing was sent.
              </p>
            )}
          </form>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-fg">The confirmation text</h2>
          <p className="mt-1 text-sm text-muted">After a customer opts in, the first text they get is this one:</p>
          <p className="mt-4 max-w-md rounded-2xl rounded-bl-md border border-border bg-surface-2 px-4 py-3 leading-relaxed text-fg">{CONFIRMATION}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-fg">Consent is optional</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Customers can leave the box unchecked and still get service. Consent is used only to send job updates, and is never used for marketing.
            Customers can reply STOP to any text to opt out, or HELP for help.
          </p>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
