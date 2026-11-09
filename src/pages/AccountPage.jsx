import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { ResendVerification } from "../components/VerifyEmail";
import { FormActions, Input } from "../components/Field";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { MonitorIcon, MoonIcon, SunIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";
import { useSubmit } from "../hooks";
import { prettyTimeZone } from "../utils/format";
import { isOwner, roleLabel } from "../utils/roles";
import CompaniesCard from "./AccountCompanies";
import { NameForm } from "./EmployeesPage";

const MIN_PASSWORD = 8;

const THEMES = [
  ["light", "Light", SunIcon],
  ["dark", "Dark", MoonIcon],
  ["system", "Match system", MonitorIcon],
];

function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  return (
    <Card title="Appearance" description="Saved on this device. Match system follows your phone or computer setting.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {THEMES.map(([value, label, Icon]) => (
          <label
            key={value}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border-strong bg-surface px-2 py-3 text-center text-sm font-medium transition-colors hover:bg-surface-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-fg has-focus-visible:ring-4 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <Icon className="h-5 w-5" />
            {label}
          </label>
        ))}
      </div>
    </Card>
  );
}

function NameCard() {
  const { user, refresh } = useAuth();
  const [saved, setSaved] = useState(false);
  return (
    <Card
      title="Your name"
      description="Your team sees it on jobs and notes, and customers see your first name in visit texts."
    >
      <NameForm
        key={`${user.first_name}-${user.last_name}`}
        person={user}
        onSubmit={async (body) => {
          setSaved(false);
          await api("/api/me/name", { method: "PATCH", body });
          await refresh();
          setSaved(true);
        }}
      />
      {saved && <Alert tone="success" className="mt-3">Saved.</Alert>}
    </Card>
  );
}

function EmailCard() {
  const { user, refresh, setVerification } = useAuth();
  const owner = isOwner(user);
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const { error, submitting, handleSubmit } = useSubmit(async (body) => {
    setSaved(false);
    const next = await api("/api/me/email", { method: "PATCH", body });
    // A new email starts unverified; the server sends it a link.
    setVerification(next.verification || null);
    await refresh();
    setPassword("");
    setSaved(true);
  }, false);
  const unchanged = email.trim().toLowerCase() === (user.email || "");

  return (
    <Card
      title="Email"
      description={
        owner
          ? "New requests from your request form are emailed here."
          : "Optional. Your business owner can see it."
      }
    >
      {owner && !user.email && (
        <Alert tone="warning" className="mb-4">
          Add an email to get notified when a client sends a request. Without one, requests still show up in
          Requests, but no email is sent.
        </Alert>
      )}
      <form
        onSubmit={(event) => handleSubmit(event, { email: email.trim() || null, current_password: password })}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSaved(false);
          }}
          maxLength={254}
          className="flex-1"
        />
        {!unchanged && (
          <Input
            label="Current password"
            name="email_current_password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="flex-1"
          />
        )}
        <Button type="submit" disabled={submitting || unchanged}>
          {submitting ? "Saving…" : user.email && !email.trim() ? "Remove email" : "Save email"}
        </Button>
      </form>
      {!unchanged && <p className="mt-2 text-xs text-muted">Enter your current password to change your email.</p>}
      <ErrorMessage error={error} className="mt-3" />
      {saved && <Alert tone="success" className="mt-3">{user.email ? "Email saved." : "Email removed."}</Alert>}
      {user.email && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={user.email_verified ? "success" : "warning"}>
            {user.email_verified ? "Verified" : "Not verified"}
          </Badge>
          {!user.email_verified && (
            <span className="text-muted">
              {owner
                ? "Open the link we emailed you (see the banner above) to add clients, jobs, quotes, and invoices."
                : "Open the link we emailed you to confirm it."}
            </span>
          )}
        </div>
      )}
      {/* Owners get Resend and the send result in the banner at the top of every page. */}
      {!owner && user.email && !user.email_verified && (
        <div className="mt-3">
          <ResendVerification />
        </div>
      )}
    </Card>
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const { error, submitting, handleSubmit } = useSubmit(async (body) => {
    setDone(false);
    if (body.new_password !== body.confirm) throw new Error("The new passwords do not match.");
    await api("/api/me/password", {
      method: "PATCH",
      body: { current_password: body.current_password, new_password: body.new_password },
    });
    setDone(true);
  }, true);

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    handleSubmit(event, {
      current_password: form.get("current_password"),
      new_password: form.get("new_password"),
      confirm: form.get("confirm"),
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" />
      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar person={user} size="lg" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {user.name}
                <Badge tone="primary">{roleLabel(user)}</Badge>
              </p>
              {user.business_name && <p className="text-sm text-fg">{user.business_name}</p>}
              <p className="text-sm text-muted">
                {user.email ? `${user.email} · ` : ""}Times in {prettyTimeZone(user.timezone)}
              </p>
            </div>
          </div>
        </Card>
        <NameCard />
        <CompaniesCard />
        <EmailCard />
        <AppearanceCard />
        <Card title="Change password" description="Other devices are logged out; this one stays logged in.">
          <form onSubmit={onSubmitForm} className="space-y-4">
            <Input
              label="Current password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="New password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                hint={`At least ${MIN_PASSWORD} characters.`}
                required
              />
              <Input
                label="Confirm new password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                required
              />
            </div>
            <ErrorMessage error={error} />
            {done && <Alert tone="success">Password changed. Other devices were logged out; this one stays logged in.</Alert>}
            <FormActions>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Change password"}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </div>
  );
}
