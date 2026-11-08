import { useState } from "react";
import { api } from "../api";
import ColorPicker from "../components/ColorPicker";
import ConfirmButton from "../components/ConfirmButton";
import CopyLink from "../components/CopyLink";
import EmailSendResult from "../components/EmailSendResult";
import ErrorMessage from "../components/ErrorMessage";
import { Checkbox, FormActions, Input } from "../components/Field";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Feedback";
import { MailIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { SectionHeader } from "../components/ui/PageHeader";
import { useAsync, useSubmit } from "../hooks";
import { EMPLOYEE_PALETTE } from "../utils/color";
import { formatMoment } from "../utils/quotes";

const ROLES = [
  ["employee", "Employee", "Sees only the jobs you assign them. Never sees prices."],
  ["lead", "Lead", "An employee with client access: can view, add, and edit clients. Never sees prices."],
];

export function InviteButton({ onClick }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <MailIcon />
      Invite by email
    </Button>
  );
}

// Pending and expired invites, with Copy link, Resend, and Revoke. Accepted
// invites leave the list (the person shows up under Your crew); so do revoked ones.
export default function EmployeeInvites({ inviting, setInviting }) {
  const { data: invites, setData, error } = useAsync(api, "/api/invites");

  function upsert(invite) {
    setData((current) => [invite, ...(current || []).filter((item) => item.id !== invite.id)]);
  }

  return (
    <section>
      <SectionHeader
        title="Invites"
        description="Invite someone by email. They pick their own username and password from the link, and join your crew. Invites expire after 7 days; Resend gives them 7 more."
      />
      <ErrorMessage error={error} />
      {invites && !invites.length && (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
          No pending invites.
        </p>
      )}
      {invites && invites.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {invites.map((invite) => (
            <InviteCard
              key={invite.id}
              invite={invite}
              onChange={upsert}
              onRemove={() => setData((current) => current.filter((item) => item.id !== invite.id))}
            />
          ))}
        </ul>
      )}
      {inviting && (
        <Modal title="Invite by email" onClose={() => setInviting(false)}>
          <InviteForm onSent={upsert} onDone={() => setInviting(false)} />
        </Modal>
      )}
    </section>
  );
}

function InviteCard({ invite, onChange, onRemove }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const expired = invite.status === "expired";

  async function resend() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = await api(`/api/invites/${invite.id}/resend`, { method: "POST" });
      onChange(body.invite);
      setResult(body);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          <span className="truncate">{invite.email}</span>
          <Badge tone={expired ? "warning" : "success"}>{expired ? "Expired" : "Pending"}</Badge>
          <Badge tone="primary">{invite.role === "lead" ? "Lead" : "Employee"}</Badge>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {expired ? `Expired ${formatMoment(invite.expires_at)}` : `Expires ${formatMoment(invite.expires_at)}`}
          {invite.sent_at ? ` · Last sent ${formatMoment(invite.sent_at)}` : ""}
        </p>
      </div>
      {expired ? (
        <Alert tone="warning">This link no longer works. Resend it to give them 7 more days with the same link.</Alert>
      ) : (
        <CopyLink url={invite.url} label={`Invite link for ${invite.email}`} openLabel="Open invite page" />
      )}
      <div className="flex flex-wrap items-start gap-2">
        <Button variant="secondary" size="sm" onClick={resend} disabled={busy}>
          {busy ? "Sending…" : expired ? "Resend and renew" : "Resend"}
        </Button>
        <ConfirmButton
          label="Revoke"
          confirmLabel="Revoke invite"
          busyLabel="Revoking…"
          warning={`The link stops working right away. ${invite.email} will see that the invite was cancelled.`}
          onConfirm={async () => {
            await api(`/api/invites/${invite.id}`, { method: "DELETE" });
            onRemove();
          }}
        />
      </div>
      <EmailSendResult result={result} kind="Invite" linkName="invite link" to={invite.email} />
      <ErrorMessage error={error} />
    </li>
  );
}

function InviteForm({ onSent, onDone }) {
  const [role, setRole] = useState("employee");
  // null: follow the role (leads quote, employees do not) until the owner picks.
  const [quoteChoice, setQuoteChoice] = useState(null);
  const canQuote = quoteChoice ?? role === "lead";
  const [pickColor, setPickColor] = useState(false);
  const [color, setColor] = useState(null);
  const [sent, setSent] = useState(null);
  const { error, submitting, handleSubmit } = useSubmit(async (body) => {
    const response = await api("/api/invites", { method: "POST", body });
    onSent(response.invite);
    setSent(response);
  }, false);

  if (sent) {
    return (
      <div className="space-y-4">
        {sent.replaced && (
          <Alert tone="info">
            {sent.invite.email} already had an invite. It was replaced: the earlier link no longer works.
          </Alert>
        )}
        <EmailSendResult result={sent} kind="Invite" linkName="invite link" to={sent.invite.email} />
        <CopyLink url={sent.invite.url} label="Invite link" openLabel="Open invite page" />
        <FormActions>
          <Button onClick={onDone}>Done</Button>
        </FormActions>
      </div>
    );
  }

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    const body = {
      email: String(form.get("email") || "").trim(),
      can_manage_clients: role === "lead",
      can_quote: canQuote,
    };
    if (pickColor && color) body.color = color;
    handleSubmit(event, body);
  }

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="off" required maxLength={254} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg">Role</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map(([value, label, description]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-lg border border-border-strong p-3 text-sm has-checked:border-primary has-checked:bg-primary-soft"
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-fg">{label}</span>
                <span className="mt-0.5 block text-xs text-muted">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Checkbox
        label="Can quote on site"
        description="Prices and sends the quote for estimate visits they go on."
        checked={canQuote}
        onChange={(event) => setQuoteChoice(event.target.checked)}
      />
      <Checkbox
        label="Choose their calendar color"
        description="Otherwise a color nobody uses yet is picked when they join. You can change it later."
        checked={pickColor}
        onChange={(event) => {
          setPickColor(event.target.checked);
          // Start from a real swatch, so what is shown selected is what gets sent.
          if (event.target.checked && !color) setColor(EMPLOYEE_PALETTE[0][0]);
        }}
      />
      {pickColor && <ColorPicker key={color || "none"} value={color} onChange={setColor} />}
      <Alert tone="info">
        We email them a link that works once and expires in 7 days. You can also copy the link and send it yourself.
        Texting invites (SMS) is not available yet.
      </Alert>
      <ErrorMessage error={error} />
      <FormActions>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send invite"}
        </Button>
      </FormActions>
    </form>
  );
}
