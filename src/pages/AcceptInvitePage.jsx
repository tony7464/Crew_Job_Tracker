import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { FormActions, Input } from "../components/Field";
import { BusinessHeading, PublicShell, StatusCard } from "../components/PublicPage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert, Spinner } from "../components/ui/Feedback";
import { AlertIcon, CheckIcon, ClockIcon, XIcon } from "../components/ui/Icons";
import { useAuth } from "../context/useAuth";
import { formatMoment } from "../utils/quotes";
import { homePath } from "../utils/roles";

const MIN_PASSWORD = 8;
const FOOTER = "Invite by Crew Job Tracker";

// The states the server reports with a code, and what to tell the invitee.
const STATES = {
  invite_used: [CheckIcon, "neutral", "This invite was already used", "Log in with the username you picked when you accepted it."],
  invite_revoked: [XIcon, "neutral", "This invite was cancelled", "The business cancelled it. Ask them to send you a new one."],
  invite_expired: [ClockIcon, "warning", "This invite has expired", "Invites last 7 days. Ask the business to send it again; the same link will work after they do."],
  invite_invalid: [AlertIcon, "danger", "This invite link does not work", "Check that you opened the whole link from the email, or ask the business for a new invite."],
};

function invitePath(token) {
  return `/api/public/invites/${encodeURIComponent(token)}`;
}

export default function AcceptInvitePage() {
  const { token } = useParams();
  return <AcceptInvite key={token} token={token} />;
}

function AcceptInvite({ token }) {
  const [invite, setInvite] = useState(null);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api(invitePath(token), { skipAuth: true })
      .then((data) => !cancelled && setInvite(data))
      .catch((err) => !cancelled && setFailure(err));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <PublicShell
      title={
        <BusinessHeading
          name={invite?.business_name}
          fallback="Join your crew"
          subtitle={invite ? "invited you to join their crew" : "Crew Job Tracker"}
        />
      }
      footer={FOOTER}
    >
      {!invite && !failure && (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted" role="status">
          <Spinner /> Loading your invite…
        </div>
      )}
      {failure && <InviteProblem error={failure} />}
      {invite && <AcceptForm token={token} invite={invite} />}
    </PublicShell>
  );
}

function InviteProblem({ error }) {
  const known = STATES[error.data?.code];
  if (!known) {
    return (
      <StatusCard icon={AlertIcon} tone="danger" title="Could not load this invite">
        {error.message}
      </StatusCard>
    );
  }
  const [icon, tone, title, text] = known;
  return (
    <StatusCard icon={icon} tone={tone} title={title}>
      {text}
    </StatusCard>
  );
}

function AcceptForm({ token, invite }) {
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    if (form.get("password") !== form.get("confirm")) {
      setError({ message: "The passwords do not match." });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = await acceptInvite(token, { username: form.get("username"), password: form.get("password") });
      navigate(homePath(user), { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  // A link that stopped working while the page was open (revoked, used, or expired).
  if (error?.data?.code && STATES[error.data.code]) return <InviteProblem error={error} />;
  const fields = error?.data?.errors || {};
  const first = (key) => (fields[key] ? [].concat(fields[key])[0] : undefined);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-5 space-y-2 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted">Role</span>
          <Badge tone="primary">{invite.role_label}</Badge>
        </p>
        <p>
          <span className="text-muted">Email </span>
          <span className="font-medium [overflow-wrap:anywhere]">{invite.email}</span>
        </p>
        <p className="text-xs text-muted">This invite expires {formatMoment(invite.expires_at)}.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Pick a username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          error={first("username")}
          hint="You log in with this. It must not be taken by anyone else."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            error={first("password")}
            hint={`At least ${MIN_PASSWORD} characters.`}
          />
          <Input
            label="Confirm password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
          />
        </div>
        {error && !first("username") && !first("password") && <Alert tone="danger">{error.message}</Alert>}
        <FormActions>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Joining…" : `Join ${invite.business_name}`}
          </Button>
        </FormActions>
      </form>
    </section>
  );
}
