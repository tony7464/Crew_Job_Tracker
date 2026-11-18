import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LandingFooter, LandingHeader } from "./LandingPage";

const UPDATED = "November 16, 2026";

// The texting rules carriers read when they review business texting (A2P 10DLC). They match
// the consent box and the confirmation text on the SMS consent page (SmsConsentPage.jsx).
const SMS_TERMS = (
  <>
    <p>
      Crew Job Tracker sends text messages to the customers of the service businesses that use it, on behalf of those businesses. These terms
      apply to anyone who gets those texts.
    </p>
    <ul className="mt-3 list-disc space-y-1.5 pl-5">
      <li>
        Texts are transactional job texts only: appointment confirmations and reminders, on-the-way notices, schedule changes, and quote and
        invoice links. They are sent on behalf of the service business doing your job, and are never marketing.
      </li>
      <li>
        You opt in with an optional box next to your phone number: you tick it yourself on the business&apos;s request form or, when you give
        your number in person or by phone, the business reads you the same words and ticks it only if you agree. See our{" "}
        <Link to="/sms-consent" className="link">
          SMS Consent
        </Link>{" "}
        page. The first text you get confirms it.
      </li>
      <li>Message frequency varies.</li>
      <li>Message and data rates may apply.</li>
      <li>
        <strong className="font-semibold text-fg">Reply STOP to opt out at any time. Reply HELP for help.</strong> END, CANCEL,
        UNSUBSCRIBE, and QUIT also opt you out.
      </li>
      <li>Consent to receive texts is not required to get service.</li>
      <li>Carriers are not liable for delayed or undelivered messages.</li>
      <li>
        How we handle phone numbers and texting consent is explained in our{" "}
        <Link to="/privacy" className="link">
          Privacy Policy
        </Link>
        .
      </li>
    </ul>
  </>
);

const TERMS = [
  ["Who we are", "Crew Job Tracker is software that helps small service businesses book visits, quote, schedule their crew, and send invoices. \"We\" means Crew Job Tracker; \"you\" means the business that signs up and the people it adds."],
  ["Your account", "You are responsible for your account and for the employees you add. Keep your password private. Tell us if you think someone else has used your account."],
  ["Your data", "Your clients, jobs, quotes, photos, and records belong to you. We store them to run the service for you and do not sell them. You can ask us to export or delete them."],
  ["Payments from your customers", "Card payments go through your own Stripe account, under Stripe's terms. The money goes to you; Crew Job Tracker does not hold it. Refunds and disputes are handled in your Stripe account."],
  ["Texts and emails to your customers", "You may only add customer phone numbers and emails that customers gave you for your business. Messages are about their visits, quotes, and invoices, and customers can opt out of texts at any time by replying STOP."],
  ["SMS Terms", SMS_TERMS],
  ["Subscriptions", "After the free trial, a plan is needed to keep adding work. You can change plans or cancel at any time; cancelling stops future charges, and your records stay available to view and export."],
  ["Acceptable use", "Do not use the service to break the law, send spam, or harm others, or try to get into accounts that are not yours."],
  ["Changes and availability", "We improve the service over time and will tell you about changes that matter. We work to keep it running, but cannot promise it will never be interrupted."],
];

const PRIVACY = [
  ["What we collect", "Account details (name, email, password stored as a secure hash), your business settings, and what you add: clients, jobs, quotes, invoices, photos, notes, and times. We log basic technical details, such as when you sign in, to keep the service secure."],
  ["How we use it", "Only to run Crew Job Tracker for you: showing your data to you and your crew, sending the emails and texts you ask for, and keeping the service working and secure."],
  ["Customer phone numbers and texts", "Phone numbers are used only to send messages about a customer's own visits and quotes, such as confirmations and day-before reminders. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, or HELP for help. Mobile numbers and texting consent are never shared with or sold to third parties or affiliates for marketing or promotional purposes. We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes."],
  ["Who else sees it", "Service providers that run parts of the service for us, under their own privacy terms: hosting and database (Render), photo storage (Cloudflare), email (Resend), texts (Twilio), and payments (Stripe, through your own account). We do not sell personal information."],
  ["Keeping it safe", "Data is sent over encrypted connections. Photos are stored privately and shown through short-lived links. Employees only see what their role allows, and never your prices."],
  ["Your choices", "You can update or delete your clients and records at any time, and ask us to export or delete your account."],
];

const PAGES = {
  terms: { title: "Terms of Service", sections: TERMS },
  privacy: {
    title: "Privacy Policy",
    intro: "This Privacy Policy explains what information Crew Job Tracker collects, how it is used, and the choices you have.",
    sections: PRIVACY,
  },
};

// The public Terms and Privacy pages, linked from the landing page and needed to register business texting.
export default function LegalPage({ page }) {
  const { title, intro, sections } = PAGES[page];
  useEffect(() => {
    document.title = `${title}: Crew Job Tracker`;
    window.scrollTo({ top: 0 });
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, [title]);

  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
        {intro && <p className="mt-6 leading-relaxed text-muted">{intro}</p>}
        <div className="mt-8 space-y-7">
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold text-fg">{heading}</h2>
              <div className="mt-2 leading-relaxed text-muted">{typeof body === "string" ? <p>{body}</p> : body}</div>
            </section>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
