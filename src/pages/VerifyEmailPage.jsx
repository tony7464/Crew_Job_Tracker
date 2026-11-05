import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { BusinessHeading, PublicShell, StatusCard } from "../components/PublicPage";
import { ResendVerification } from "../components/VerifyEmail";
import { ButtonLink } from "../components/ui/Button";
import { Spinner } from "../components/ui/Feedback";
import { AlertIcon, CheckIcon, ClockIcon } from "../components/ui/Icons";
import { useAuth } from "../context/useAuth";
import { homePath, isOwner } from "../utils/roles";

const FOOTER = "Crew Job Tracker";

// One request per token, even when React runs effects twice in development:
// the first answer is "verified", and a second request would say "already verified".
const checks = new Map();

function checkToken(token) {
  if (!checks.has(token)) {
    checks.set(
      token,
      api("/api/verify-email", { method: "POST", body: { token }, skipAuth: true }).then(
        (data) => ({ state: data.status, email: data.email }),
        (err) => ({
          state: err.data?.code === "token_expired" ? "expired" : err.status === 429 ? "limited" : "invalid",
          message: err.message,
        }),
      ),
    );
  }
  return checks.get(token);
}

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, refresh } = useAuth();
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    checkToken(token).then((value) => {
      if (cancelled) return;
      setResult(value);
      // If this browser is logged in, the banner and create forms catch up.
      if (value.state === "verified" || value.state === "already_verified") refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  const state = token ? result?.state : "invalid";
  const next = user ? (
    <ButtonLink to={homePath(user)} className="mt-5">
      Go to the app
    </ButtonLink>
  ) : (
    <ButtonLink to="/login" className="mt-5">
      Log in
    </ButtonLink>
  );

  return (
    <PublicShell title={<BusinessHeading fallback="Verify your email" subtitle="Crew Job Tracker" />} footer={FOOTER}>
      {!state && (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted" role="status">
          <Spinner /> Checking your link…
        </div>
      )}
      {state === "verified" && (
        <StatusCard icon={CheckIcon} tone="success" title="Your email is verified">
          <p>{result.email ? `${result.email} is confirmed.` : "Thanks for confirming."} You can now add clients, jobs, quotes, and invoices.</p>
          {next}
        </StatusCard>
      )}
      {state === "already_verified" && (
        <StatusCard icon={CheckIcon} tone="success" title="Already verified">
          <p>This email was already confirmed. There is nothing more to do.</p>
          {next}
        </StatusCard>
      )}
      {state === "expired" && (
        <StatusCard icon={ClockIcon} tone="warning" title="This link has expired">
          <p>Verification links work for 48 hours.</p>
          {isOwner(user) && !user.email_verified && user.email ? (
            <div className="mt-4 flex justify-center text-left">
              <ResendVerification size="md" />
            </div>
          ) : (
            <>
              <p className="mt-1">Log in and use Resend on the banner to get a new one.</p>
              {next}
            </>
          )}
        </StatusCard>
      )}
      {(state === "invalid" || state === "limited") && (
        <StatusCard icon={AlertIcon} tone="danger" title={state === "limited" ? "Too many tries" : "This link does not work"}>
          <p>
            {state === "limited"
              ? result.message
              : "It may have been replaced by a newer link, or the email on the account changed. Use the newest email we sent, or log in and resend it."}
          </p>
          {next}
        </StatusCard>
      )}
    </PublicShell>
  );
}
