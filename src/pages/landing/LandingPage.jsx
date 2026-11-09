import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import { ButtonLink } from "../../components/ui/Button";
import {
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  DollarIcon,
  InboxIcon,
  PhoneIcon,
  RepeatIcon,
  UsersIcon,
} from "../../components/ui/Icons";
import { cx } from "../../components/ui/styles";
import {
  ANNUAL_MONTHS_FREE,
  EVERY_PLAN,
  PLANS,
  PLATFORM_FEE_PERCENT,
  TRIAL_DAYS,
  annualMonthly,
  annualPrice,
  crewLabel,
} from "../../config/plans";

const FEATURES = [
  [InboxIcon, "New quote in a minute", "Enter the customer's name, phone, and address, pick a time, and they get a text confirming when you'll arrive."],
  [CheckIcon, "Quote on site", "Your crew prices the job on site and sends the quote. The customer can accept it right there on your phone."],
  [CalendarIcon, "Team schedule", "Every job and crew member on one calendar. Drag a job to move it, and see who's free at a glance."],
  [PhoneIcon, "An app for your crew", "Today's jobs, directions, \"on my way\" texts, and clocking in and out, all on the phone they already have."],
  [CameraIcon, "Photos, checklists, and materials", "Before-and-after photos, step-by-step checklists, and a list of materials to pick up, all saved with each job."],
  [DollarIcon, "Invoices and online payments", "Send an invoice and get paid by card, straight into your own Stripe account. Overdue reminders go out automatically."],
  [RepeatIcon, "Recurring jobs", "Set a job to repeat weekly, every few weeks, or monthly, and the visits are added to your schedule for you."],
  [ClockIcon, "Timesheets and reports", "Hours by employee and job, money owed, your top clients and services, and how many of your quotes are accepted."],
];

const STEPS = [
  ["Request", "A customer fills out your online request form or calls you."],
  ["Visit", "Schedule a visit to see the job. The customer gets a text confirming the time."],
  ["Quote", "Price the work on site or from the office, and send the quote as a link."],
  ["Job", "When they accept, the job goes on your schedule with the visit's photos."],
  ["Paid", "Send the invoice. They pay by card, and the money goes straight to your bank."],
];

const FAQ = [
  ["Do I need a credit card for the free trial?", `No. Try everything for ${TRIAL_DAYS} days without a card.`],
  [
    "How do my customers pay me?",
    `By card, through your own Stripe account, so the money goes straight to you. Crew Job Tracker takes ${PLATFORM_FEE_PERCENT}% of each payment; only Stripe's standard card fees apply. You can also connect a Stripe account you already have.`,
  ],
  [
    "Does my crew have to install an app?",
    "No. It works in the web browser on any phone, and they can add it to their home screen so it opens like an app.",
  ],
  [
    "Can my crew see what I charge?",
    "No. Employees never see job prices. You choose who can price and send quotes on site, and they only see quotes for the visits they're on.",
  ],
  ["Can I change plans or cancel?", "Yes, at any time. Your clients, jobs, and records always belong to you."],
  [
    "Will it text my customers?",
    "Only about their own visits and quotes, and never with prices. Every text explains how to opt out, and you can turn confirmations and reminders off in Settings.",
  ],
];

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-semibold text-fg">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <BriefcaseIcon className="h-5 w-5" />
      </span>
      {/* The smallest phones have room for the buttons or the name, so the name goes. */}
      <span className="hidden min-[400px]:inline">Crew Job Tracker</span>
      <span className="sr-only min-[400px]:hidden">Crew Job Tracker</span>
    </Link>
  );
}

// home: on the landing page itself, so section links scroll instead of navigating.
function SectionLink({ home, id, className, children }) {
  if (home) {
    return (
      <a href={`#${id}`} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={id === "pricing" ? "/pricing" : `/#${id}`} className={className}>
      {children}
    </Link>
  );
}

function Header({ home = false }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <SectionLink home={home} id="features" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg md:inline">
            Features
          </SectionLink>
          <SectionLink home={home} id="pricing" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg sm:inline">
            Pricing
          </SectionLink>
          <SectionLink home={home} id="faq" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg md:inline">
            FAQ
          </SectionLink>
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          <Link to="/login" className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-fg hover:bg-surface-2 sm:px-3">
            Log in
          </Link>
          <ButtonLink to="/signup" size="sm" className="whitespace-nowrap">
            Start free trial
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-2 lg:pb-24">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">For small service businesses</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          Run your whole service business from your phone.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Book estimate visits, send quotes, schedule your crew, and get paid online, all in one app. Built for plumbers,
          cleaners, landscapers, handymen, and other home service businesses.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/signup" size="lg">
            Start your free trial
          </ButtonLink>
          <a
            href="#pricing"
            className="inline-flex h-12 items-center rounded-lg border border-border-strong px-5 font-medium text-fg hover:bg-surface-2"
          >
            See pricing
          </a>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CheckIcon className="h-4 w-4 text-success" /> {TRIAL_DAYS} days free. No card needed.
        </p>
      </div>
      <div className="relative">
        <img
          src="/marketing/dashboard-light.webp"
          alt="The owner's dashboard: this week's totals and the team schedule."
          width="1440"
          height="900"
          className="w-full rounded-xl border border-border shadow-pop"
        />
        <img
          src="/marketing/employee-my-jobs-mobile.webp"
          alt="A crew member's jobs for the week on a phone."
          width="585"
          height="1266"
          loading="lazy"
          className="absolute -bottom-10 -left-4 hidden w-32 rounded-2xl border-4 border-surface shadow-pop sm:block lg:-left-10 lg:w-40"
        />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-fg">Everything your business needs, in one place</h2>
        <p className="mt-3 max-w-2xl text-muted">
          From the first phone call to the money in your account, without spreadsheets, paperwork, or juggling several apps.
        </p>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([Icon, title, text]) => (
            <li key={title} className="rounded-xl border border-border bg-bg p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-fg">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="text-3xl font-bold tracking-tight text-fg">From first call to getting paid</h2>
          <ol className="mt-8 space-y-5">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-fg">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-fg">{title}</h3>
                  <p className="text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <img
          src="/marketing/quote-mobile.webp"
          alt="A quote on a customer's phone, ready to accept."
          width="585"
          height="1266"
          loading="lazy"
          className="mx-auto w-56 rounded-3xl border-4 border-surface shadow-pop lg:col-span-2"
        />
      </div>
    </section>
  );
}

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-border bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-fg">Simple pricing by crew size</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Every plan includes every feature. Try it free for {TRIAL_DAYS} days, no card needed.
          </p>
          <div className="mt-6 inline-flex rounded-full border border-border bg-bg p-1" role="group" aria-label="Billing period">
            {[
              [false, "Monthly"],
              [true, `Yearly (${ANNUAL_MONTHS_FREE} months free)`],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={yearly === value}
                onClick={() => setYearly(value)}
                className={cx(
                  "rounded-full px-4 py-1.5 text-sm font-medium",
                  yearly === value ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <li
              key={plan.id}
              className={cx(
                "relative flex flex-col rounded-2xl border bg-bg p-6",
                plan.popular ? "border-primary shadow-pop" : "border-border",
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-fg">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-fg">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-fg">
                  ${yearly ? annualMonthly(plan) : plan.monthly}
                </span>
                <span className="text-muted">/ month</span>
              </p>
              <p className="mt-1 h-5 text-sm text-muted">{yearly ? `$${annualPrice(plan)} billed once a year` : "Billed monthly"}</p>
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-fg">
                <UsersIcon className="h-4 w-4 text-primary" /> {crewLabel(plan)}
              </p>
              <ul className="mt-4 flex-1 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-fg">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>
              <ButtonLink
                to={`/signup?plan=${plan.id}${yearly ? "&billing=yearly" : ""}`}
                variant={plan.popular ? "primary" : "secondary"}
                className="mt-6 w-full"
              >
                Start free trial
              </ButtonLink>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-10 max-w-4xl rounded-xl border border-border bg-bg p-6">
          <h3 className="font-semibold text-fg">Every plan includes</h3>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {EVERY_PLAN.map((feature) => (
              <li key={feature} className="flex gap-2 text-fg">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-6 flex max-w-4xl items-start gap-3 rounded-xl border border-border bg-bg p-5">
          <DollarIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted">
            <span className="font-semibold text-fg">Your Stripe, your money.</span> Customers pay you by card straight into
            your own Stripe account. Crew Job Tracker takes {PLATFORM_FEE_PERCENT}% of each payment; only Stripe's standard card fees apply.
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-fg">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg">
                {question}
                <span className="text-muted transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="bg-primary py-14 text-primary-fg">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Spend less time on paperwork and more time on jobs.</h2>
          <p className="mt-2 opacity-90">
            Try every feature free for {TRIAL_DAYS} days. No card needed.
          </p>
        </div>
        <Link
          to="/signup"
          className="inline-flex h-12 items-center rounded-lg bg-surface px-6 font-semibold text-primary hover:opacity-90"
        >
          Start your free trial
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Crew Job Tracker</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link to="/pricing" className="hover:text-fg">
            Pricing
          </Link>
          <Link to="/terms" className="hover:text-fg">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link to="/login" className="hover:text-fg">
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

// The public home page at crewjobtrack.com, for people who are not logged in.
// section: "pricing" scrolls to the plans (the /pricing address).
export default function LandingPage({ section }) {
  const { hash } = useLocation();
  const target = section || hash.slice(1);
  useEffect(() => {
    document.title = "Crew Job Tracker: quotes, scheduling, and payments for service businesses";
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, []);
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView();
    else window.scrollTo({ top: 0 });
  }, [target]);

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>
      <Header home />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

export { Footer as LandingFooter, Header as LandingHeader };
