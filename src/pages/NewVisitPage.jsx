import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Input, Select, TextArea } from "../components/Field";
import Loading from "../components/Loading";
import MapLink from "../components/MapLink";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { AlertIcon, CalendarIcon, CheckIcon, CopyIcon, MapPinIcon, UsersIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import { DURATION_PRESETS, formatDay, formatDuration, formatTimeRange, prettyTimeZone } from "../utils/format";
import { emailLooksValid, fieldErrors, phoneLooksValid } from "../utils/requests";
import { isOwner } from "../utils/roles";
import { addDays, businessToday } from "../utils/time";
import { overlaps } from "../utils/visits";

const EMPTY_CUSTOMER = { name: "", phone: "", address: "", email: "", notes: "" };
const WINDOW_STARTS = { morning: "09:00", afternoon: "13:00", evening: "17:00" };
const STEPS = [
  ["customer", "Customer"],
  ["visit", "Visit"],
  ["done", "Booked"],
];

function digitsOf(value) {
  return (value || "").replace(/\D/g, "");
}

// The first preferred time on a request that is still ahead, else tomorrow at 9.
function slotFromRequest(serviceRequest, today) {
  for (const option of serviceRequest.preferred_windows || []) {
    if (option.date >= today) return { date: option.date, time: WINDOW_STARTS[option.window] || "09:00" };
  }
  return { date: addDays(today, 1), time: "09:00" };
}

// The "New Quote" intake: who the customer is, when someone goes out to look at the
// work, and a confirmation of the date and time. It books an estimate visit with a
// draft quote (POST /api/visits). Owners and leads.
export default function NewVisitPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = businessToday(user.timezone);
  const presetClient = params.get("client_id");
  const presetRequest = params.get("request_id");

  const [step, setStep] = useState(presetClient || presetRequest ? "loading" : "customer");
  const [chosen, setChosen] = useState(null);
  const [serviceRequest, setServiceRequest] = useState(null);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [visit, setVisit] = useState(() => ({
    service_type: "",
    date: params.get("date") || addDays(today, 1),
    time: params.get("time") || "09:00",
    duration_minutes: 60,
    crew: isOwner(user) ? [] : [user.id],
    notes: "",
  }));
  const [errors, setErrors] = useState({});
  const [matches, setMatches] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [result, setResult] = useState(null);

  // Each step starts at the top, so a warning shown above the form is seen.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step, matches]);

  // Started from a client or a request: skip straight to picking the time.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (presetClient) {
          const client = await api(`/api/clients/${presetClient}`);
          if (!cancelled) setChosen(client);
        } else if (presetRequest) {
          const request = await api(`/api/requests/${presetRequest}`);
          if (cancelled) return;
          setServiceRequest(request);
          const slot = slotFromRequest(request, today);
          setVisit((current) => ({ ...current, ...slot, service_type: request.service_type || "" }));
        }
        if (!cancelled) setStep("visit");
      } catch (err) {
        if (!cancelled) {
          setLoadError(err);
          setStep("customer");
        }
      }
    }
    if (presetClient || presetRequest) load();
    return () => {
      cancelled = true;
    };
  }, [presetClient, presetRequest, today]);

  function pickClient(client) {
    setChosen(client);
    setServiceRequest(null);
    setMatches(null);
    setErrors({});
    setStep("visit");
  }

  function checkCustomer() {
    const found = {};
    if (!customer.name.trim()) found.name = "Enter the customer's name.";
    if (customer.phone.trim() && !phoneLooksValid(customer.phone.trim())) found.phone = "Enter a phone number, like (512) 555-0101.";
    if (customer.email.trim() && !emailLooksValid(customer.email.trim())) found.email = "Enter an email address, like pat@example.com.";
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function nextFromCustomer(event) {
    event.preventDefault();
    if (checkCustomer()) {
      setMatches(null);
      setStep("visit");
    }
  }

  async function book({ allowDuplicate = false } = {}) {
    setSubmitting(true);
    setSubmitError(null);
    const body = {
      date: visit.date,
      time: visit.time,
      duration_minutes: Number(visit.duration_minutes),
      employee_ids: visit.crew,
      notes: visit.notes.trim() || null,
    };
    if (visit.service_type.trim()) body.service_type = visit.service_type.trim();
    if (chosen) body.client_id = chosen.id;
    else if (serviceRequest) body.request_id = serviceRequest.id;
    else {
      body.client = Object.fromEntries(Object.entries(customer).map(([key, value]) => [key, value.trim() || null]));
      if (allowDuplicate) body.allow_duplicate = true;
    }
    try {
      const booked = await api("/api/visits", { method: "POST", body });
      setResult(booked);
      setStep("done");
    } catch (err) {
      if (err.status === 409 && err.data?.matches) {
        setMatches(err.data.matches);
        setStep("customer");
      } else {
        const clientErrors = err.data?.errors?.client;
        if (clientErrors && typeof clientErrors === "object" && !Array.isArray(clientErrors)) {
          setErrors(fieldErrors({ data: { errors: clientErrors } }));
          setStep("customer");
        } else {
          setErrors(fieldErrors(err));
        }
        setSubmitError(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setChosen(null);
    setServiceRequest(null);
    setCustomer(EMPTY_CUSTOMER);
    setVisit((current) => ({ ...current, service_type: "", notes: "" }));
    setResult(null);
    setMatches(null);
    setErrors({});
    setSubmitError(null);
    setStep("customer");
    navigate("/visits/new", { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="New quote"
        description="Book a visit to look at the job. The quote starts as a draft on the visit."
        back={{ to: isOwner(user) ? "/quotes" : "/my-jobs", label: isOwner(user) ? "Quotes" : "My jobs" }}
      />
      <Steps current={step} />
      <ErrorMessage error={loadError} />
      {step === "loading" && <Loading label="Loading…" />}
      {step === "customer" && (
        <CustomerStep
          customer={customer}
          setCustomer={setCustomer}
          errors={errors}
          matches={matches}
          submitting={submitting}
          onUseClient={pickClient}
          onAddAnyway={() => book({ allowDuplicate: true })}
          onNext={nextFromCustomer}
          canSkipVisit={isOwner(user)}
        />
      )}
      {step === "visit" && (
        <VisitStep
          user={user}
          today={today}
          who={chosen ? { ...chosen, existing: true } : serviceRequest ? { ...serviceRequest, request: true } : customer}
          visit={visit}
          setVisit={setVisit}
          errors={errors}
          submitting={submitting}
          submitError={submitError}
          onBack={() => {
            setChosen(null);
            setServiceRequest(null);
            setStep("customer");
          }}
          onBook={() => book()}
        />
      )}
      {step === "done" && result && <DoneStep user={user} result={result} onAnother={startOver} />}
    </div>
  );
}

function Steps({ current }) {
  const index = STEPS.findIndex(([key]) => key === current);
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Steps">
      {STEPS.map(([key, label], position) => {
        const done = index > position || (current === "done" && key === "done");
        const active = index === position || (current === "loading" && position === 0);
        return (
          <li key={key} className="flex items-center gap-2">
            {position > 0 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
            <span
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                done ? "bg-success text-white" : active ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
              )}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : position + 1}
            </span>
            <span className={cx(active ? "font-medium text-fg" : "text-muted")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Existing clients that look like the person being typed in, by name or phone.
function useSuggestions(customer) {
  const name = customer.name.trim();
  const digits = digitsOf(customer.phone);
  const query = digits.length >= 4 ? digits : name.length >= 2 ? name : "";
  const [state, setState] = useState({ query: "", items: [] });

  useEffect(() => {
    if (!query) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const page = await api(`/api/clients?q=${encodeURIComponent(query)}&per_page=5`);
        if (!cancelled) setState({ query, items: page.items });
      } catch {
        // Suggestions are a convenience: the form works without them.
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return query && state.query === query ? state.items : [];
}

function ClientChoice({ client, onUse, busy, label = "Use this client" }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-fg">
          {client.name} {client.archived && <Badge>Archived</Badge>}
        </p>
        {[client.address, client.phone, client.email].filter(Boolean).map((line) => (
          <p key={line} className="text-muted">
            {line}
          </p>
        ))}
      </div>
      {!client.archived && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onUse(client)}>
          {label}
        </Button>
      )}
    </li>
  );
}

function CustomerStep({ customer, setCustomer, errors, matches, submitting, onUseClient, onAddAnyway, onNext, canSkipVisit }) {
  const suggestions = useSuggestions(customer);
  const set = (key) => (event) => setCustomer((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form onSubmit={onNext} className="space-y-5">
      {matches && (
        <Alert tone="warning">
          <p className="font-medium">This looks like a client you already have.</p>
          <ul className="mt-3 space-y-2">
            {matches.map((client) => (
              <ClientChoice key={client.id} client={client} onUse={onUseClient} busy={submitting} label="Book for them" />
            ))}
          </ul>
          <Button className="mt-3" variant="ghost" size="sm" disabled={submitting} onClick={onAddAnyway}>
            No, add {customer.name.trim() || "them"} as a new client
          </Button>
        </Alert>
      )}
      <Card title="Who is the customer?">
        <div className="space-y-4">
          <Input
            label="Name"
            value={customer.name}
            onChange={set("name")}
            error={errors.name}
            autoComplete="off"
            autoFocus
            maxLength={120}
          />
          <Input
            label="Phone"
            type="tel"
            inputMode="tel"
            value={customer.phone}
            onChange={set("phone")}
            error={errors.phone}
            placeholder="(512) 555-0101"
            maxLength={40}
          />
          {suggestions.length > 0 && !matches && (
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="mb-2 text-sm font-medium text-fg">Already a client?</p>
              <ul className="space-y-2">
                {suggestions.map((client) => (
                  <ClientChoice key={client.id} client={client} onUse={onUseClient} />
                ))}
              </ul>
            </div>
          )}
          <Input
            label="Address"
            value={customer.address}
            onChange={set("address")}
            error={errors.address}
            autoComplete="street-address"
            placeholder="Street, city"
            maxLength={300}
          />
          <Input
            label="Email (optional)"
            type="email"
            inputMode="email"
            value={customer.email}
            onChange={set("email")}
            error={errors.email}
            maxLength={254}
          />
          <TextArea
            label="Notes (optional)"
            value={customer.notes}
            onChange={set("notes")}
            error={errors.notes}
            placeholder="What they need, gate codes, pets…"
            maxLength={2000}
          />
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canSkipVisit ? (
          <Link to="/quotes/new" className="link text-sm">
            Skip the visit and write the quote now
          </Link>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg">
          Next: pick a time
        </Button>
      </div>
    </form>
  );
}

function VisitStep({ user, today, who, visit, setVisit, errors, submitting, submitError, onBack, onBook }) {
  const { data, error } = useAsync(api, `/api/schedule/team?start=${visit.date}&end=${visit.date}`);
  const set = (key) => (event) => setVisit((current) => ({ ...current, [key]: event.target.value }));
  const employees = (data?.employees || []).filter((person) => person.is_active);
  const dayJobs = useMemo(
    () => (data?.jobs || []).filter((job) => job.date === visit.date && job.status !== "cancelled"),
    [data, visit.date],
  );
  const crewJobs = visit.crew.length
    ? dayJobs.filter((job) => job.assignees.some((person) => visit.crew.includes(person.id)))
    : dayJobs;
  const clashes = overlaps(dayJobs, {
    date: visit.date,
    time: visit.time,
    minutes: Number(visit.duration_minutes),
    crewIds: visit.crew,
  });
  const clashIds = new Set(clashes.map((job) => job.id));

  function toggle(id) {
    setVisit((current) => ({
      ...current,
      crew: current.crew.includes(id) ? current.crew.filter((other) => other !== id) : [...current.crew, id],
    }));
  }

  return (
    <div className="space-y-5">
      <Card
        title={who.name}
        description={who.existing ? "Existing client" : who.request ? "From a service request" : "New client"}
        actions={
          <button type="button" className="link text-sm" onClick={onBack}>
            Change
          </button>
        }
      >
        <div className="space-y-1 text-sm text-muted">
          {who.address && (
            <p className="flex flex-wrap items-center gap-x-2">
              <MapPinIcon className="h-3.5 w-3.5" /> {who.address} <MapLink address={who.address} />
            </p>
          )}
          {who.phone && <p>{who.phone}</p>}
        </div>
      </Card>
      <Card title="When should someone come out?" description={`Times are ${prettyTimeZone(user.timezone)} time.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Date" type="date" value={visit.date} min={today} onChange={set("date")} error={errors.date} />
          <Input label="Time" type="time" step={900} value={visit.time} onChange={set("time")} error={errors.time} />
          <Select label="How long" value={visit.duration_minutes} onChange={set("duration_minutes")} error={errors.duration_minutes}>
            {DURATION_PRESETS.filter((minutes) => minutes <= 240).map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </Select>
          <Input
            label="Service (optional)"
            value={visit.service_type}
            onChange={set("service_type")}
            error={errors.service_type}
            placeholder="Estimate"
            maxLength={120}
          />
        </div>
      </Card>
      <Card title="Who's going?" description="They'll see the visit on their jobs and calendar.">
        <ErrorMessage error={error} />
        {!data && !error && <p className="text-sm text-muted">Loading the team…</p>}
        {data && employees.length === 0 && <p className="text-sm text-muted">No crew yet. You can go yourself.</p>}
        {employees.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Crew">
            {employees.map((person) => {
              const on = visit.crew.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(person.id)}
                  className={cx(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-2.5 py-1 text-sm font-medium",
                    on ? "border-primary bg-primary/10 text-fg" : "border-border text-muted hover:text-fg",
                  )}
                >
                  <Avatar person={person} size="sm" />
                  {person.username}
                  {on && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
        {errors.employee_ids && <p className="mt-2 text-sm text-danger">{errors.employee_ids}</p>}
        {data && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatDay(visit.date, "long")}
              {visit.crew.length > 0 && " for who's going"}
            </p>
            {crewJobs.length === 0 ? (
              <p className="text-sm text-muted">Nothing else booked that day.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {crewJobs.map((job) => (
                  <li key={job.id} className={cx("flex items-center gap-2", clashIds.has(job.id) ? "text-warning" : "text-muted")}>
                    {clashIds.has(job.id) && <AlertIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="whitespace-nowrap tabular-nums">{formatTimeRange(job.time, job.duration_minutes)}</span>
                    <span className="truncate">
                      {job.kind === "estimate" ? "Estimate: " : ""}
                      {job.service_type}
                      {job.client_name && ` · ${job.client_name}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {clashes.length > 0 && (
              <p className="mt-2 text-sm font-medium text-warning">
                This overlaps {clashes.length === 1 ? "another booking" : `${clashes.length} other bookings`}. You can still book it.
              </p>
            )}
          </div>
        )}
      </Card>
      <Card title="Notes for the crew (optional)">
        <TextArea
          value={visit.notes}
          onChange={set("notes")}
          error={errors.notes}
          placeholder="What to look at, what to measure, where to park…"
          maxLength={2000}
          aria-label="Notes for the crew"
        />
      </Card>
      {submitError && !Object.keys(errors).length && <ErrorMessage error={submitError} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onBook} disabled={submitting || !visit.date || !visit.time}>
          {submitting ? "Booking…" : "Book the visit"}
        </Button>
      </div>
    </div>
  );
}

function DoneStep({ user, result, onAnother }) {
  const [copied, setCopied] = useState(false);
  const { visit, confirmation, client } = result;
  const path = isOwner(user) ? `/jobs/${visit.id}` : `/my-jobs/${visit.id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(confirmation.headline);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The browser refused the clipboard; the text is on screen to copy by hand.
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
            <CheckIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-muted">Visit booked</p>
          <p className="mt-2 text-2xl font-semibold text-fg sm:text-3xl">{formatDay(confirmation.date, "long")}</p>
          <p className="mt-1 text-xl font-medium text-fg">{formatTimeRange(confirmation.time, confirmation.duration_minutes)}</p>
          <p className="mt-1 text-sm text-muted">{prettyTimeZone(confirmation.timezone)} time</p>
          <p className="mt-5 max-w-md text-base text-fg">{confirmation.headline}</p>
        </div>
        <div className="mt-2 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-fg">{client.name}</p>
            {confirmation.address ? (
              <p className="flex flex-wrap items-center gap-x-2 text-muted">
                {confirmation.address} <MapLink address={confirmation.address} />
              </p>
            ) : (
              <p className="text-muted">No address yet</p>
            )}
          </div>
          <div>
            <p className="flex items-center gap-1.5 font-medium text-fg">
              <UsersIcon className="h-3.5 w-3.5" /> Who's going
            </p>
            {confirmation.crew.length ? (
              <p className="flex flex-wrap items-center gap-1.5 text-muted">
                {confirmation.crew.map((person) => (
                  <span key={person.id} className="inline-flex items-center gap-1">
                    <Avatar person={person} size="sm" /> {person.username}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-muted">Nobody assigned yet</p>
            )}
          </div>
        </div>
      </Card>
      {client.created && (
        <Alert tone="success">{client.name} was added to your clients.</Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <ButtonLink to={path} size="lg">
          Open the visit
        </ButtonLink>
        <Button variant="secondary" size="lg" onClick={onAnother}>
          Book another
        </Button>
        <Button variant="ghost" size="lg" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy details"}
        </Button>
      </div>
    </div>
  );
}
