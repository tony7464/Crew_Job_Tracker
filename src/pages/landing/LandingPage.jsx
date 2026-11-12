import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import { ButtonLink } from "../../components/ui/Button";
import {
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
import { LogoMark } from "../../components/ui/Logo";
import { CountUp, Reveal, TiltCard } from "../../components/ui/Motion";
import { cx } from "../../components/ui/styles";
import { prefersReducedMotion, usePrefersReducedMotion } from "../../components/ui/useMotion";
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

// three.js is large, so the 3D scene loads after the page is showing.
const CrewScene = lazy(() => import("../../components/three/CrewScene"));

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

// How wide each feature card is on a large screen (the grid has 4 columns), and its icon colours.
const FEATURE_SPANS = ["lg:col-span-2", "", "", "", "", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"];
const FEATURE_TINTS = [
  "bg-brand text-primary-fg",
  "bg-accent text-accent-fg",
  "bg-primary-soft text-primary-soft-fg",
  "bg-primary-soft text-primary-soft-fg",
  "bg-accent text-accent-fg",
  "bg-brand text-primary-fg",
  "bg-primary-soft text-primary-soft-fg",
  "bg-accent text-accent-fg",
];

const STEPS = [
  ["Request", "A customer fills out your online request form or calls you."],
  ["Visit", "Schedule a visit to see the job. The customer gets a text confirming the time."],
  ["Quote", "Price the work on site or from the office, and send the quote as a link."],
  ["Job", "When they accept, the job goes on your schedule with the visit's photos."],
  ["Paid", "Send the invoice. They pay by card, and the money goes straight to your bank."],
];
const STEP_SECONDS = 3.5;

const TRADES = [
  "Plumbers",
  "Cleaners",
  "Landscapers",
  "Handymen",
  "Painters",
  "Electricians",
  "Roofers",
  "Pressure washers",
  "Pool care",
  "Pest control",
  "Movers",
  "Window cleaners",
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

const NAV_LINK = "rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg";
const EYEBROW = "text-sm font-semibold uppercase tracking-widest text-primary";
const HEADING = "text-3xl font-bold tracking-tight text-fg sm:text-4xl";
const PANEL = "glass rounded-3xl border border-border shadow-card";

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-[17px] font-bold tracking-tight text-fg">
      <LogoMark className="h-9 w-9" />
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
    <header className="sticky top-0 z-30 px-2 pt-2 sm:px-4 sm:pt-3">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-border px-3 shadow-card sm:px-4">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Main">
          <SectionLink home={home} id="features" className={cx(NAV_LINK, "hidden md:inline")}>
            Features
          </SectionLink>
          <SectionLink home={home} id="pricing" className={cx(NAV_LINK, "hidden sm:inline")}>
            Pricing
          </SectionLink>
          <SectionLink home={home} id="faq" className={cx(NAV_LINK, "hidden md:inline")}>
            FAQ
          </SectionLink>
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          <Link to="/login" className="whitespace-nowrap rounded-xl px-2 py-2 text-sm font-medium text-fg hover:bg-surface-2 sm:px-3">
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
    <section className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1fr_1.1fr] lg:gap-4 lg:pb-16">
      <div className="animate-rise">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          For small service businesses
        </p>
        <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[1.04] tracking-tight text-fg sm:text-6xl">
          Run your whole service business <span className="text-gradient">from your phone.</span>
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
            className="glass inline-flex h-12 items-center rounded-xl border border-border-strong px-5 font-semibold text-fg transition hover:-translate-y-px hover:bg-surface-2"
          >
            See pricing
          </a>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CheckIcon className="h-4 w-4 text-success" /> {TRIAL_DAYS} days free. No card needed.
        </p>
      </div>
      <div className="relative h-[340px] sm:h-[440px] lg:h-[560px]">
        <Suspense fallback={<div className="absolute inset-8 animate-pulse rounded-full bg-primary-soft blur-2xl" aria-hidden="true" />}>
          <CrewScene />
        </Suspense>
      </div>
    </section>
  );
}

function Trades() {
  const row = (
    <ul className="flex shrink-0 items-center gap-3 pr-3">
      {TRADES.map((trade) => (
        <li key={trade} className="glass whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-semibold text-fg">
          {trade}
        </li>
      ))}
    </ul>
  );
  return (
    <div
      className="overflow-hidden py-4"
      aria-hidden="true"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}
    >
      <div className="animate-marquee flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className={EYEBROW}>Features</p>
          <h2 className={cx(HEADING, "mt-2")}>Everything your business needs, in one place</h2>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            From the first phone call to the money in your account, without spreadsheets, paperwork, or juggling several apps.
          </p>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([Icon, title, text], index) => (
            <Reveal as="li" key={title} delay={(index % 4) * 70} className={FEATURE_SPANS[index]}>
              <TiltCard className={cx(PANEL, "tilt-lift h-full p-6")}>
                <span className={cx("flex h-11 w-11 items-center justify-center rounded-2xl shadow-card", FEATURE_TINTS[index])}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-fg">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
              </TiltCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

// The dashboard screenshot. It starts leaned back and stands up as it scrolls into view.
function Showcase() {
  const frameRef = useRef(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || prefersReducedMotion()) return undefined;
    let queued = 0;
    const place = () => {
      queued = 0;
      const box = frame.getBoundingClientRect();
      // 0 when the top of the picture enters the bottom of the screen, 1 once it is well into view.
      const seen = Math.min(1, Math.max(0, (window.innerHeight - box.top) / (window.innerHeight * 0.75)));
      frame.style.setProperty("--lean", `${((1 - seen) * 22).toFixed(2)}deg`);
      frame.style.setProperty("--size", (0.9 + seen * 0.1).toFixed(3));
    };
    const onScroll = () => {
      queued ||= requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(queued);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className={EYEBROW}>The owner's view</p>
          <h2 className={cx(HEADING, "mt-2")}>Your whole week on one screen</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">
            This week's totals, who is working where, and what still needs a price, the moment you open the app.
          </p>
        </Reveal>
        <div className="mt-10" style={{ perspective: "1400px" }}>
          <div
            ref={frameRef}
            className="ring-brand origin-bottom overflow-hidden rounded-3xl shadow-pop will-change-transform"
            style={{ transform: "rotateX(var(--lean, 0deg)) scale(var(--size, 1))" }}
          >
            <img
              src="/marketing/dashboard-light.webp"
              alt="The owner's dashboard: this week's totals and the team schedule."
              width="1440"
              height="900"
              loading="lazy"
              className="block w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = usePrefersReducedMotion();
  const moving = !paused && !still;

  // Moves to the next step by itself until someone hovers, focuses, or picks a step.
  useEffect(() => {
    if (!moving) return undefined;
    const timer = setTimeout(() => setActive((step) => (step + 1) % STEPS.length), STEP_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [moving, active]);

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-5">
        <div
          className="lg:col-span-3"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <Reveal>
            <p className={EYEBROW}>How it works</p>
            <h2 className={cx(HEADING, "mt-2")}>From first call to getting paid</h2>
          </Reveal>
          <ol className="mt-8 space-y-2">
            {STEPS.map(([title, text], index) => {
              const current = index === active;
              return (
                <li key={title}>
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    onClick={() => setActive(index)}
                    className={cx(
                      "relative flex w-full gap-4 overflow-hidden rounded-2xl border p-4 text-left transition duration-300",
                      current ? "glass border-border-strong shadow-card" : "border-transparent hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold transition duration-300",
                        current ? "bg-brand text-primary-fg shadow-glow" : index < active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
                      )}
                    >
                      {index < active ? <CheckIcon className="h-5 w-5" /> : index + 1}
                    </span>
                    <span>
                      <span className="block font-display text-lg font-bold text-fg">{title}</span>
                      <span className={cx("block transition-colors", current ? "text-fg" : "text-muted")}>{text}</span>
                    </span>
                    {current && moving && (
                      <span
                        key={active}
                        aria-hidden="true"
                        className="step-timer absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
                        style={{ animationDuration: `${STEP_SECONDS}s` }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <Reveal className="relative mx-auto lg:col-span-2" delay={120}>
          <div className="absolute -inset-6 rounded-full bg-brand opacity-25 blur-3xl" aria-hidden="true" />
          <TiltCard max={10} className="relative w-56 rounded-[2rem] sm:w-60">
            <img
              src="/marketing/quote-mobile.webp"
              alt="A quote on a customer's phone, ready to accept."
              width="585"
              height="1266"
              loading="lazy"
              className="w-full rounded-[2rem] border-4 border-surface shadow-pop"
            />
          </TiltCard>
          <p
            key={active}
            aria-hidden="true"
            className="glass animate-pop absolute -left-6 top-10 rounded-2xl border border-border px-3 py-2 text-sm font-semibold text-fg shadow-pop sm:-left-10"
          >
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">
              Step {active + 1} of {STEPS.length}
            </span>
            {STEPS[active][0]}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className={EYEBROW}>Pricing</p>
          <h2 className={cx(HEADING, "mt-2")}>Simple pricing by crew size</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
            Every plan includes every feature. Try it free for {TRIAL_DAYS} days, no card needed.
          </p>
          <div className="glass mt-6 inline-flex rounded-full border border-border p-1" role="group" aria-label="Billing period">
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
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                  yearly === value ? "bg-brand text-primary-fg shadow-glow" : "text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Reveal>
        <ul className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal as="li" key={plan.id} delay={index * 90} className={cx("relative", plan.popular && "lg:-mt-4 lg:mb-4")}>
              {plan.popular && (
                <span className="absolute -top-3 left-6 z-10 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-fg shadow-card">
                  Most popular
                </span>
              )}
              <TiltCard
                max={4}
                className={cx(
                  "tilt-lift glass flex h-full flex-col rounded-3xl p-6",
                  plan.popular ? "ring-brand shadow-pop" : "border border-border shadow-card",
                )}
              >
                <h3 className="text-xl font-bold text-fg">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums text-fg">
                    $<CountUp value={yearly ? annualMonthly(plan) : plan.monthly} duration={450} />
                  </span>
                  <span className="text-muted">/ month</span>
                </p>
                <p className="mt-1 h-5 text-sm text-muted">{yearly ? `$${annualPrice(plan)} billed once a year` : "Billed monthly"}</p>
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-fg">
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
              </TiltCard>
            </Reveal>
          ))}
        </ul>
        <Reveal className={cx(PANEL, "mx-auto mt-10 max-w-4xl p-6")}>
          <h3 className="text-lg font-bold text-fg">Every plan includes</h3>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {EVERY_PLAN.map((feature) => (
              <li key={feature} className="flex gap-2 text-fg">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {feature}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className={cx(PANEL, "mx-auto mt-6 flex max-w-4xl items-start gap-3 p-5")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <DollarIcon className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted">
            <span className="font-semibold text-fg">Your Stripe, your money.</span> Customers pay you by card straight into
            your own Stripe account. Crew Job Tracker takes {PLATFORM_FEE_PERCENT}% of each payment; only Stripe's standard card fees apply.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <p className={EYEBROW}>FAQ</p>
          <h2 className={cx(HEADING, "mt-2")}>Frequently asked questions</h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {FAQ.map(([question, answer], index) => (
            <Reveal key={question} delay={index * 50}>
              <details className="group glass rounded-2xl border border-border px-5 py-4 shadow-card open:border-border-strong">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg">
                  {question}
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg leading-none text-primary-soft-fg transition duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="px-4 pb-16 sm:px-6">
      <Reveal className="bg-brand relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-12 text-primary-fg shadow-pop sm:px-12 sm:py-16">
        <div className="bg-dots absolute inset-0 opacity-25" aria-hidden="true" />
        <div className="animate-float absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent opacity-30 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Spend less time on paperwork and more time on jobs.
            </h2>
            <p className="mt-3 text-lg opacity-90">Try every feature free for {TRIAL_DAYS} days. No card needed.</p>
          </div>
          <Link
            to="/signup"
            className="inline-flex h-14 shrink-0 items-center rounded-2xl bg-accent px-7 text-lg font-bold text-accent-fg shadow-pop transition hover:-translate-y-0.5 hover:bg-accent-hover active:scale-[.97]"
          >
            Start your free trial
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />© {new Date().getFullYear()} Crew Job Tracker
        </p>
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
    <div className="min-h-screen overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>
      <Header home />
      <main id="main">
        <Hero />
        <Trades />
        <Features />
        <Showcase />
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
