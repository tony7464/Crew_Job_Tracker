import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { FormActions, Input, Select } from "../components/Field";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import {
  MAX_BUSINESS_NAME,
  PLAN_OPTIONS,
  ago,
  businessNameError,
  deletedThings,
  eventText,
  formatDate,
  formatWhen,
  planLabel,
  sameName,
} from "../utils/admin";
import { formatMoney } from "../utils/format";
import { companyRoleName } from "../utils/roles";

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Overview({ business }) {
  return (
    <Card title="Overview">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Fact label="Owner">{business.owner_name}</Fact>
        <Fact label="Email">
          {business.email || "None"}
          {business.email && !business.email_verified && " (not verified)"}
        </Fact>
        <Fact label="Joined">{business.created_at ? formatWhen(business.created_at) : "Before records began"}</Fact>
        <Fact label="Owner last logged in">{ago(business.last_login_at)}</Fact>
        <Fact label="People">{business.crew + 1}</Fact>
        <Fact label="Clients">{business.clients}</Fact>
        <Fact label="Jobs">{business.jobs}</Fact>
        <Fact label="Latest job">{formatDate(business.last_job_date) || "None yet"}</Fact>
      </dl>
    </Card>
  );
}

// The name the business's customers see in texts, emails and its public pages. An owner from
// before signup asked for one (or who cleared it) has none, and customers then read "your
// service provider".
function NameCard({ business, onChanged }) {
  const [name, setName] = useState(business.business_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [shownError, setShownError] = useState("");
  const serverError = error?.data?.errors?.business_name?.[0];

  async function submit(event) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const problem = businessNameError(name);
    setShownError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const next = await api(`/api/admin/businesses/${business.id}/name`, { method: "PATCH", body: { business_name: name.trim() } });
      onChanged(next);
      setName(next.business_name || "");
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Business name"
      description="What customers see in texts, emails, and quote and invoice pages. Change it only if the owner asked, or left it empty."
    >
      <form onSubmit={submit} className="space-y-3">
        {!business.business_name && (
          <Alert tone="warning">This business has no name, so its customers read "your service provider" instead.</Alert>
        )}
        <Input
          label="Business name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setShownError("");
            setSaved(false);
          }}
          maxLength={MAX_BUSINESS_NAME}
          error={shownError || serverError}
        />
        {error && !serverError && <ErrorMessage error={error} />}
        <FormActions>
          {saved && <span className="self-center text-sm text-muted" role="status">Saved</span>}
          <Button type="submit" disabled={saving || name.trim() === (business.business_name || "")}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}

function PlanCard({ business, onChanged }) {
  const [plan, setPlan] = useState(business.plan || "");
  const [price, setPrice] = useState(business.plan_price ?? "");
  const [note, setNote] = useState(business.plan_note || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const errors = error?.data?.errors || {};
  const list = business.plans.find((item) => item.id === plan)?.list_price_cents;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const body = { plan: plan || null, plan_price: String(price).trim() || null, plan_note: note.trim() || null };
      const next = await api(`/api/admin/businesses/${business.id}`, { method: "PATCH", body });
      onChanged(next);
      // Show what was saved, as the server wrote it ("19" becomes "19.00").
      setPlan(next.plan || "");
      setPrice(next.plan_price ?? "");
      setNote(next.plan_note || "");
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Plan and price"
      description="A record of what this business is on and what you agreed to charge it. Nothing is charged from here yet: billing for memberships is not built."
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-fg">
          Now: <span className="font-medium">{planLabel(business)}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Plan" value={plan} onChange={(event) => setPlan(event.target.value)} error={errors.plan?.[0]}>
            {PLAN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Agreed price a month"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder={Number.isInteger(list) ? `List price ${formatMoney(list)}` : "0.00"}
            hint="Leave empty to use the plan's list price. 0 is free."
            error={errors.plan_price?.[0]}
          />
        </div>
        <Input
          label="Note (only admins see it)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          placeholder="Founding customer, half price for a year"
          error={errors.plan_note?.[0]}
        />
        {error && !Object.keys(errors).length && <ErrorMessage error={error} />}
        <FormActions>
          {saved && <span className="self-center text-sm text-muted" role="status">Saved</span>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}

// The business's public website: where it is, and taking it down when it should not be on this address.
function SiteCard({ business, onChanged }) {
  const { site } = business;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(what) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await api(`/api/admin/businesses/${business.id}/site/${what}`, { method: "POST" }));
      setConfirming(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Website" description="The public site this business built. Taking it down keeps what they built, and they cannot publish it again until you allow it.">
      <div className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
          {site.published ? (
            <a href={site.url} target="_blank" rel="noreferrer" className="link [overflow-wrap:anywhere]">{site.url.replace(/^https?:\/\//, "")}</a>
          ) : (
            <span className="[overflow-wrap:anywhere]">{site.url.replace(/^https?:\/\//, "")}</span>
          )}
          {site.taken_down ? <Badge tone="danger">Taken down</Badge> : site.published ? <Badge tone="success">Live</Badge> : <Badge>Not published</Badge>}
        </p>
        {site.published && <p className="text-xs text-muted">Published {formatWhen(site.published_at)}</p>}
        {error && <ErrorMessage error={error} />}
        {site.taken_down ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => act("allow")}>
            {busy ? "Working…" : "Allow publishing again"}
          </Button>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg">Take this website down? The owner is told in their Settings.</span>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => act("unpublish")}>
              {busy ? "Working…" : "Yes, take it down"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            {site.published ? "Take the site down" : "Block publishing"}
          </Button>
        )}
        {site.domain.name && <SiteAddress business={business} onChanged={onChanged} />}
      </div>
    </Card>
  );
}

// A web address of their own that the owner asked to use for the site, and connecting it.
function SiteAddress({ business, onChanged }) {
  const { domain, domain_also_asked_by: others } = business.site;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [found, setFound] = useState(null);

  async function act(what) {
    setBusy(true);
    setError(null);
    try {
      if (what === "check") {
        setFound(await api(`/api/admin/businesses/${business.id}/site/domain/check`));
      } else {
        // Connect names the address looked at here, so one the owner changed meanwhile is not connected unseen.
        const body = what === "connect" ? { domain: domain.name } : undefined;
        onChanged(await api(`/api/admin/businesses/${business.id}/site/domain/${what}`, { method: "POST", body }));
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const said = (value, yes, no) => (value === true ? yes : value === false ? no : "could not be read just now");
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
        <span className="text-muted">Own address:</span>
        <span className="font-medium [overflow-wrap:anywhere]">{domain.name}</span>
        {domain.connected ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Waiting</Badge>}
      </p>
      {!domain.connected && (
        <p className="text-xs text-muted">
          Read the address letter by letter: it should plainly be this business&apos;s own. Then add it to the web service at the host, wait until the
          host shows its certificate as issued, and press Connect. Connect works only once the owner&apos;s TXT record proves the address is theirs.
        </p>
      )}
      {domain.connected && (
        <p className="text-xs text-muted">After disconnecting, remove the address at the host too. Until then it answers nothing.</p>
      )}
      {others.length > 0 && (
        <p className="text-xs text-warning-soft-fg">
          Also asked for by: {others.map((other) => other.business_name || `business ${other.business_id}`).join(", ")}. Only the one who runs the
          address can prove it.
        </p>
      )}
      {found && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
          <li>Proved theirs (TXT record): {said(found.proved, "yes", "not yet")}.</li>
          <li>
            Points here (CNAME to <span className="[overflow-wrap:anywhere]">{found.target}</span>):{" "}
            {said(found.points_here, "yes", "not yet, or it is behind another company's proxy")}.
          </li>
        </ul>
      )}
      {error && <ErrorMessage error={error} />}
      <div className="flex flex-wrap gap-2">
        {domain.connected ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => act("disconnect")}>Disconnect</Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => act("check")}>Check its records</Button>
            <Button size="sm" disabled={busy} onClick={() => act("connect")}>Connect</Button>
          </>
        )}
      </div>
    </div>
  );
}

function PersonRow({ business, person, onSent }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = person.id === business.id ? {} : { user_id: person.id };
      setResult(await api(`/api/admin/businesses/${business.id}/password_reset`, { method: "POST", body }));
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
            <span className="[overflow-wrap:anywhere]">{person.name}</span>
            <Badge>{companyRoleName(person.role)}</Badge>
            {person.pending && <Badge tone="warning">Waiting for approval</Badge>}
            {!person.is_active && !person.pending && <Badge tone="danger">Turned off</Badge>}
          </p>
          <p className="text-sm text-muted [overflow-wrap:anywhere]">
            {person.email || "No email"} · Last login: {ago(person.last_login_at).toLowerCase()}
          </p>
        </div>
        {person.email ? (
          <Button variant="secondary" size="sm" onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Email a password reset"}
          </Button>
        ) : (
          <p className="text-xs text-muted">The owner sets this password, from Employees.</p>
        )}
      </div>
      {result && (
        <Alert tone={result.email_delivery === "resend" ? "success" : "warning"} className="mt-2">
          {result.email_delivery === "resend"
            ? `A reset link is on its way to ${result.name}. Their password stays the same until they use it.`
            : `Email is not set up on this server, so the link for ${result.name} was only written to the server log.`}
        </Alert>
      )}
      {error && <div className="mt-2"><ErrorMessage error={error} /></div>}
    </li>
  );
}

function SupportViewCard({ business }) {
  const { startSupportView } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const on = Boolean(business.support_access_until);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await startSupportView(business.id);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Card
      title="See what they see"
      description="Open this business as its owner sees it, to help them. You can look at every page, and change, send, or download nothing."
    >
      <div className="space-y-3">
        {on ? (
          <Alert tone="info" title={`The owner has allowed this until ${formatWhen(business.support_access_until)}`}>
            They can see in Settings each time you look, and can turn it off at any moment.
          </Alert>
        ) : (
          <Alert tone="warning" title="The owner has not allowed this">
            Ask them to open Settings, find Support access, and turn it on for a day or more. Then come back here.
          </Alert>
        )}
        {error && <ErrorMessage error={error} />}
        <Button onClick={start} disabled={!on || busy || !business.is_active}>
          {busy ? "Opening…" : "Look at this business"}
        </Button>
      </div>
    </Card>
  );
}

// The server's own sentences, without the field names in front.
function said(error) {
  const lines = Object.values(error?.data?.errors || {}).flat();
  return lines.length ? lines.join(" ") : error.message;
}

// Deleting the business for good, in two steps that the server checks too: its name typed
// out, then the admin's own password. plan is the server's answer to the first press: what
// would go, and a token that lets this admin delete this one business for a few minutes.
function DeleteDialog({ business, plan, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const errors = error?.data?.errors || {};
  const { summary } = plan;
  const named = sameName(name, plan.name);
  // A dialog puts the cursor on its close button when it opens. Here it belongs in the name box.
  const nameBox = useRef(null);
  useEffect(() => {
    nameBox.current?.focus();
  }, []);

  function next(event) {
    event.preventDefault();
    if (!named) return;
    setError(null);
    setStep(2);
  }

  async function remove(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { token: plan.token, name, password };
      const done = await api(`/api/admin/businesses/${business.id}/delete/confirm`, { method: "POST", body });
      navigate("/admin", { replace: true, state: { deleted: done.name, domain: done.domain, emailed: done.emailed } });
    } catch (err) {
      setError(err);
      setPassword("");
      if (err.data?.errors?.name) setStep(1);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Delete ${plan.name}?`} description={`Step ${step} of 2`} onClose={busy ? () => {} : onClose} size="sm">
      {step === 1 ? (
        <form onSubmit={next} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-fg">This deletes, for good:</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-fg">
              {deletedThings(summary).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          {summary.keep_login.length > 0 && (
            <p className="text-sm text-muted [overflow-wrap:anywhere]">
              Also in another company, so they keep their login and lose only this business: {summary.keep_login.join(", ")}.
            </p>
          )}
          {summary.domain && (
            <p className="text-sm text-muted [overflow-wrap:anywhere]">
              Its website stops answering at {summary.domain}. Remove that address at the host afterwards.
            </p>
          )}
          {summary.stripe && (
            <p className="text-sm text-muted">Its Stripe account is the business&apos;s own. It stays open at Stripe.</p>
          )}
          <p className="text-sm text-muted">The owner is emailed that the account was deleted. It cannot be undone.</p>
          <Input
            label={
              <>
                Type <strong className="[overflow-wrap:anywhere]">{plan.name}</strong> to go on
              </>
            }
            ref={nameBox}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
            error={errors.name?.[0]}
          />
          <FormActions>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!named}>
              Continue
            </Button>
          </FormActions>
        </form>
      ) : (
        <form onSubmit={remove} className="space-y-4">
          <p className="text-sm text-fg">
            Last step. Enter your own password to delete <strong className="[overflow-wrap:anywhere]">{plan.name}</strong> and everything in it.
            This cannot be undone.
          </p>
          <Input
            label="Your password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            error={errors.password?.[0]}
          />
          {error && !errors.password && <Alert tone="danger">{said(error)}</Alert>}
          <FormActions>
            <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant="danger" disabled={busy || !password}>
              {busy ? "Deleting…" : "Delete for good"}
            </Button>
          </FormActions>
        </form>
      )}
    </Modal>
  );
}

function DeleteCard({ business }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Asks what would be deleted. Nothing is deleted by this.
  async function begin() {
    setBusy(true);
    setError(null);
    try {
      setPlan(await api(`/api/admin/businesses/${business.id}/delete/start`, { method: "POST" }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-fg">Delete this account</p>
          <p className="mt-0.5 text-sm text-muted">
            The business, its people, and everything in it, for good. You see what goes first, and nothing is deleted until you have typed
            its name and your own password.
          </p>
        </div>
        <Button variant="danger-outline" className="shrink-0" onClick={begin} disabled={busy}>
          {busy ? "Checking…" : "Delete this account"}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" className="mt-3">
          {said(error)}
        </Alert>
      )}
      {plan && <DeleteDialog business={business} plan={plan} onClose={() => setPlan(null)} />}
    </Card>
  );
}

// One business: who is in it, its plan, password resets, the support view, and deleting it.
export default function AdminBusiness() {
  const { id } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const { data: business, setData, error } = useAsync(api, `/api/admin/businesses/${id}`, reloadKey);

  if (error) return <ErrorMessage error={error} />;
  if (!business) return <Loading variant="list" label="Loading the business…" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ to: "/admin", label: "Admin" }}
        title={business.business_name || "No business name"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {business.owner_name}
            {!business.is_active && <Badge tone="danger">Turned off</Badge>}
            {business.support_access_until && <Badge tone="primary">Support access on</Badge>}
          </span>
        }
      />
      <div className="space-y-6">
        <Overview business={business} />
        <SupportViewCard business={business} />
        <NameCard key={business.business_name || ""} business={business} onChanged={setData} />
        <PlanCard business={business} onChanged={setData} />
        {business.site && <SiteCard business={business} onChanged={setData} />}
        <Card title="People" description="Email someone a link to choose a new password. You never see the link or a password.">
          <ul className="-my-3 divide-y divide-border">
            {business.people.map((person) => (
              <PersonRow key={person.id} business={business} person={person} onSent={() => setReloadKey((key) => key + 1)} />
            ))}
          </ul>
        </Card>
        <Card title="Record" description="What admins did here and what the owner allowed, newest first.">
          {business.events.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {business.events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                  <span className="min-w-0 text-fg [overflow-wrap:anywhere]">{eventText(event)}</span>
                  <span className="shrink-0 text-xs text-muted">{formatWhen(event.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <DeleteCard business={business} />
      </div>
    </div>
  );
}
