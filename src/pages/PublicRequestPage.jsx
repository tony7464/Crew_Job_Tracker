import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Input, Select, TextArea } from "../components/Field";
import PhotoPicker from "../components/PhotoPicker";
import { BusinessHeading as BusinessHeadingBase, PublicShell, StatusCard } from "../components/PublicPage";
import { Button } from "../components/ui/Button";
import { Alert, Spinner } from "../components/ui/Feedback";
import { CheckIcon, PlusIcon, XIcon } from "../components/ui/Icons";
import {
  MAX_NOTES,
  MAX_PREFERRED_WINDOWS,
  TIME_WINDOWS,
  emailLooksValid,
  fieldErrors,
  localToday,
  phoneLooksValid,
} from "../utils/requests";

const FALLBACK_TITLE = "Request a service";
// The server treats a submit sooner than REQUEST_MIN_SECONDS (default 3) after the
// form loaded as a bot. People who fill in a form that fast (with autofill) wait a moment.
const MIN_FILL_MS = 3500;
const EMPTY = {
  name: "",
  phone: "",
  email: "",
  address: "",
  service_type: "",
  preferred_text: "",
  notes: "",
  website: "",
};
const FIELD_ORDER = ["name", "contact", "phone", "email", "address", "service_type", "preferred_windows", "photos"];

// End with one period, even when the business name already ends with one ("Co.").
function sentence(text) {
  return text.endsWith(".") ? text : `${text}.`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wait until at least MIN_FILL_MS have passed since loadedAt.
function waitForMinimumTime(loadedAt) {
  const early = MIN_FILL_MS - (Date.now() - loadedAt);
  return early > 0 ? wait(early) : Promise.resolve();
}

function fetchForm(token) {
  return api(`/api/public/requests/${encodeURIComponent(token)}`, { skipAuth: true });
}

function dayAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Checks done in the browser before sending. The server repeats every one.
function validate(values, windows) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!values.address.trim()) errors.address = "Enter the address for the job.";
  if (!values.service_type) errors.service_type = "Pick a service.";
  const phone = values.phone.trim();
  const email = values.email.trim();
  if (!phone && !email) errors.contact = "Enter a phone number or an email address so we can reach you.";
  if (phone && !phoneLooksValid(phone)) errors.phone = "Enter a phone number with 7 to 15 digits, like 555-123-4567.";
  if (email && !emailLooksValid(email)) errors.email = "Enter an email address like name@example.com.";
  if (windows.some((row) => !row.date)) errors.preferred_windows = "Pick a date for each preferred time, or remove it.";
  return errors;
}

function Shell({ title, children }) {
  return (
    <PublicShell title={title} footer="Request form by Crew Job Tracker">
      {children}
    </PublicShell>
  );
}

function BusinessHeading({ name, subtitle }) {
  return <BusinessHeadingBase name={name} fallback={FALLBACK_TITLE} subtitle={subtitle} />;
}

function Section({ title, children }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function PreferredWindows({ rows, onChange, error, disabled }) {
  const today = localToday();
  const last = dayAfter(365);

  function update(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-fg">
        Preferred days <span className="font-normal text-muted">(optional, up to {MAX_PREFERRED_WINDOWS})</span>
      </p>
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2">
              <input
                type="date"
                value={row.date}
                min={today}
                max={last}
                onChange={(event) => update(index, { date: event.target.value })}
                aria-label={`Preferred day ${index + 1}`}
                aria-invalid={error && !row.date ? true : undefined}
                disabled={disabled}
                className="field min-w-0 flex-[3]"
              />
              <select
                value={row.window}
                onChange={(event) => update(index, { window: event.target.value })}
                aria-label={`Time of day for preferred day ${index + 1}`}
                disabled={disabled}
                className="field min-w-0 flex-[2]"
              >
                {TIME_WINDOWS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                aria-label={`Remove preferred day ${index + 1}`}
                disabled={disabled}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {rows.length < MAX_PREFERRED_WINDOWS && (
        <Button
          variant="soft"
          size="sm"
          className={rows.length ? "mt-2" : undefined}
          disabled={disabled}
          onClick={() =>
            onChange([...rows, { key: `${Date.now()}-${rows.length}`, date: "", window: "any" }])
          }
        >
          <PlusIcon />
          {rows.length ? "Add another day" : "Add a preferred day"}
        </Button>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export default function PublicRequestPage() {
  const { token } = useParams();
  return <PublicRequest key={token} token={token} />;
}

function PublicRequest({ token }) {
  // status: loading | missing | closed | open | sent | failed
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [windows, setWindows] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const loadedAt = useRef(0);
  const formRef = useRef(null);

  const applyForm = useCallback((data) => {
    loadedAt.current = Date.now();
    setForm(data);
    setStatus(data.accepting ? "open" : "closed");
  }, []);
  const applyLoadError = useCallback((err) => {
    setStatus(err.status === 404 ? "missing" : "failed");
  }, []);

  // Load again (after "Send another", or when the form changed while open).
  async function load() {
    try {
      const data = await fetchForm(token);
      applyForm(data);
      return data;
    } catch (err) {
      applyLoadError(err);
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchForm(token)
      .then((data) => {
        if (!cancelled) applyForm(data);
      })
      .catch((err) => {
        if (!cancelled) applyLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [token, applyForm, applyLoadError]);

  useEffect(() => {
    const name = form?.business_name;
    document.title = name ? `${name} · Request a service` : FALLBACK_TITLE;
    return () => {
      document.title = "Crew Job Tracker";
    };
  }, [form?.business_name]);

  // After a 429, keep Send off until the wait is over.
  useEffect(() => {
    if (!blockedUntil) return undefined;
    const id = setTimeout(() => setBlockedUntil(0), Math.max(0, blockedUntil - Date.now()));
    return () => clearTimeout(id);
  }, [blockedUntil]);

  function setValue(name) {
    return (event) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [name]: value }));
      setErrors((current) => {
        if (!current[name] && !(current.contact && (name === "phone" || name === "email"))) return current;
        const next = { ...current, [name]: undefined };
        if (name === "phone" || name === "email") next.contact = undefined;
        return next;
      });
    };
  }

  // Check one field when the person leaves it, so mistakes show before Send.
  function checkField(name) {
    return () => {
      // Empty fields are only flagged on Send, so tabbing past one is not an error.
      if (!values[name].trim()) return;
      const found = validate(values, windows);
      setErrors((current) => ({ ...current, [name]: found[name] }));
    };
  }

  function focusFirstError(found) {
    const first = FIELD_ORDER.find((key) => found[key]);
    if (!first) return;
    const name = first === "contact" ? "phone" : first;
    const element = formRef.current?.querySelector(`[name="${name}"]`);
    element?.focus();
  }

  async function submit(event) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const found = validate(values, windows);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      focusFirstError(found);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await waitForMinimumTime(loadedAt.current);
      const trimmed = (value) => value.trim() || null;
      await api(`/api/public/requests/${encodeURIComponent(token)}`, {
        method: "POST",
        skipAuth: true,
        body: {
          name: values.name.trim(),
          phone: trimmed(values.phone),
          email: trimmed(values.email),
          address: values.address.trim(),
          service_type: values.service_type,
          preferred_windows: windows.map(({ date, window }) => ({ date, window })),
          preferred_text: trimmed(values.preferred_text),
          notes: trimmed(values.notes),
          photos: photos.map((photo) => photo.dataUrl),
          website: values.website,
          form_token: form.form_token,
        },
      });
      // 201 (saved) and 202 both mean "sent" here.
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setStatus("sent");
      window.scrollTo({ top: 0 });
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleError(err) {
    const found = fieldErrors(err);
    if (err.status === 429) {
      setBlockedUntil(Date.now() + (err.retryAfter || 60) * 1000);
      setFormError(err.message);
      return;
    }
    if (err.status === 404) {
      // The form was turned off or its link replaced while this page was open.
      await load();
      return;
    }
    if (err.status === 413) {
      setErrors({ photos: found.body || "The photos are too large. Remove one or two and try again." });
      return;
    }
    if (found.form_token) {
      // An old form: get a fresh one, keep everything typed, and ask to send again.
      const fresh = await load();
      if (fresh?.accepting) setNotice("This form had been open a long time, so it was refreshed. Press Send request again.");
      return;
    }
    if (err.status === 400 && Object.keys(found).length) {
      const known = Object.fromEntries(FIELD_ORDER.filter((key) => found[key]).map((key) => [key, found[key]]));
      setErrors(known);
      const other = Object.entries(found).filter(([key]) => !FIELD_ORDER.includes(key));
      if (other.length) setFormError(other.map(([, message]) => message).join(" "));
      else setFormError("Please fix the highlighted fields.");
      focusFirstError(known);
      return;
    }
    setFormError(err.status ? err.message : "Could not send. Check your connection and try again.");
  }

  async function sendAnother() {
    setValues(EMPTY);
    setWindows([]);
    setPhotos([]);
    setErrors({});
    setFormError(null);
    setNotice(null);
    setStatus("loading");
    await load();
  }

  if (status === "loading") {
    return (
      <Shell>
        <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-muted">
          <Spinner />
          Loading the form…
        </div>
      </Shell>
    );
  }
  if (status === "missing") {
    return (
      <Shell title={<BusinessHeading name={null} />}>
        <StatusCard title="This link does not work">
          The request form may have moved to a new link. Ask the business for their current link.
        </StatusCard>
      </Shell>
    );
  }
  if (status === "failed") {
    return (
      <Shell title={<BusinessHeading name={null} />}>
        <StatusCard title="The form could not load">
          <p>Check your connection and try again.</p>
          <Button className="mt-4" variant="secondary" onClick={() => { setStatus("loading"); load(); }}>
            Try again
          </Button>
        </StatusCard>
      </Shell>
    );
  }
  if (status === "closed") {
    return (
      <Shell title={<BusinessHeading name={form.business_name} />}>
        <StatusCard title="Not accepting requests right now">
          {form.business_name || "This business"} is not taking new requests through this form at the moment. Please
          check back later, or contact them directly.
        </StatusCard>
      </Shell>
    );
  }
  if (status === "sent") {
    return (
      <Shell title={<BusinessHeading name={form?.business_name} />}>
        <StatusCard icon={CheckIcon} tone="success" title="Thanks, your request was sent">
          <p>
            {form?.business_name || "The business"} will get back to you
            {values.email.trim() && values.phone.trim() ? " by phone or email" : values.email.trim() ? " by email" : " by phone"}{" "}
            soon.
          </p>
          <Button className="mt-5" variant="secondary" onClick={sendAnother}>
            Send another request
          </Button>
        </StatusCard>
      </Shell>
    );
  }

  const sendDisabled = submitting || blockedUntil > 0;

  return (
    <Shell title={<BusinessHeading name={form.business_name} subtitle="Tell us about the job and we will get back to you." />}>
      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6"
      >
        <Section title="Your details">
          <Input
            label="Name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={setValue("name")}
            onBlur={checkField("name")}
            error={errors.name}
            maxLength={120}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={setValue("phone")}
              onBlur={checkField("phone")}
              error={errors.phone}
              maxLength={30}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              onChange={setValue("email")}
              onBlur={checkField("email")}
              error={errors.email}
              maxLength={254}
            />
          </div>
          {errors.contact ? (
            <p className="-mt-2 text-xs font-medium text-danger" role="alert">{errors.contact}</p>
          ) : (
            <p className="-mt-2 text-xs text-muted">A phone number, an email address, or both.</p>
          )}
        </Section>

        <Section title="The job">
          <Input
            label="Address"
            name="address"
            autoComplete="street-address"
            value={values.address}
            onChange={setValue("address")}
            onBlur={checkField("address")}
            error={errors.address}
            maxLength={300}
            required
          />
          <Select
            label="Service"
            name="service_type"
            value={values.service_type}
            onChange={setValue("service_type")}
            error={errors.service_type}
            required
          >
            <option value="" disabled>
              Pick a service
            </option>
            {form.service_types.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </Select>
        </Section>

        <Section title="When works for you">
          <PreferredWindows
            rows={windows}
            onChange={(rows) => {
              setWindows(rows);
              setErrors((current) => ({ ...current, preferred_windows: undefined }));
            }}
            error={errors.preferred_windows}
            disabled={submitting}
          />
          <Input
            label="Other timing"
            name="preferred_text"
            value={values.preferred_text}
            onChange={setValue("preferred_text")}
            placeholder="For example: weekday evenings after 5"
            maxLength={300}
          />
        </Section>

        <Section title="Anything else">
          <TextArea
            label="Notes"
            name="notes"
            rows="4"
            value={values.notes}
            onChange={setValue("notes")}
            placeholder="What needs doing, access, pets, parking…"
            maxLength={MAX_NOTES}
            hint={values.notes.length > MAX_NOTES - 200 ? `${MAX_NOTES - values.notes.length} characters left` : undefined}
          />
          <PhotoPicker
            photos={photos}
            onChange={(next) => {
              setPhotos(next);
              setErrors((current) => ({ ...current, photos: undefined }));
            }}
            error={errors.photos}
            disabled={submitting}
          />
        </Section>

        {/* A trap for bots: hidden from people and screen readers, never focused. */}
        <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={setValue("website")}
            />
          </label>
        </div>

        {notice && <Alert tone="info">{notice}</Alert>}
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Button type="submit" size="lg" block disabled={sendDisabled}>
          {submitting ? (
            <>
              <Spinner className="h-4 w-4 text-current" />
              Sending…
            </>
          ) : (
            "Send request"
          )}
        </Button>
        <p className="text-center text-xs text-muted">
          {sentence(`Your details go only to ${form.business_name || "this business"}`)}
        </p>
      </form>
    </Shell>
  );
}
