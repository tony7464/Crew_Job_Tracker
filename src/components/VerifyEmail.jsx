import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { isOwner } from "../utils/roles";
import EmailSendResult from "./EmailSendResult";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Feedback";

// A Resend button and what happened to the email, honest about log mode.
export function ResendVerification({ size = "sm" }) {
  const { user, verification, resendVerification } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await resendVerification();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" size={size} onClick={resend} disabled={busy}>
        {busy ? "Sending…" : "Resend verification email"}
      </Button>
      <EmailSendResult verification result={verification} to={user?.email} />
      {error && <p className="text-xs font-medium text-danger">{error.message}</p>}
    </div>
  );
}

// Shown on every page while the business owner's email is not verified: adding
// clients, jobs, quotes, and invoices is paused until it is.
export default function VerifyEmailBanner() {
  const { user } = useAuth();
  if (!user) return null;
  if (isOwner(user)) {
    if (user.email_verified) return null;
    if (!user.email) {
      return (
        <Alert tone="warning" title="Add and verify your email" className="mb-6">
          You need a verified email to add clients, jobs, quotes, and invoices.{" "}
          <Link to="/account" className="link">
            Add one on the Account page
          </Link>
          .
        </Alert>
      );
    }
    return (
      <Alert tone="warning" title="Verify your email to start adding work" className="mb-6">
        <p>
          We sent a link to <span className="font-medium">{user.email}</span>. Open it to add clients, jobs, quotes, and
          invoices. You can look around until then. Wrong address? Change it on the{" "}
          <Link to="/account" className="link">
            Account page
          </Link>
          .
        </p>
        <div className="mt-3">
          <ResendVerification />
        </div>
      </Alert>
    );
  }
  if (user.can_manage_clients && user.business_email_verified === false) {
    return (
      <Alert tone="info" className="mb-6">
        The business owner has not verified their email yet, so new clients cannot be added until they do.
      </Alert>
    );
  }
  return null;
}

// In a form, in place of a plain error, when the server refused a create with code email_unverified.
export function UnverifiedNotice({ error, className }) {
  const { user } = useAuth();
  return (
    <Alert tone="warning" title="Verify your email first" className={className}>
      <p>{error.message}</p>
      {isOwner(user) && user.email && (
        <div className="mt-3">
          <ResendVerification />
        </div>
      )}
    </Alert>
  );
}
