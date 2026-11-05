import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { homePath } from "../utils/roles";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Feedback";
import { BriefcaseIcon } from "./ui/Icons";

// "42 seconds", "1 minute", "60 minutes".
function waitLabel(seconds) {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export default function AuthScreen({ title, subtitle, submitLabel, onSubmit, footer, children }) {
  const { user, loading } = useAuth();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // After a 429, the form stays locked until the server's Retry-After time passes.
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(0);
        setError(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const secondsLeft = lockedUntil ? Math.max(1, Math.ceil((lockedUntil - now) / 1000)) : 0;

  if (loading) return <Loading />;
  if (user) return <Navigate to={homePath(user)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(new FormData(event.target));
    } catch (err) {
      setError(err);
      setSubmitting(false);
      if (err.status === 429 && err.retryAfter) {
        const current = Date.now();
        setNow(current);
        setLockedUntil(current + err.retryAfter * 1000);
      }
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col pt-4 sm:pt-12">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-card">
          <BriefcaseIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        {children}
        {error?.status === 429 ? (
          <Alert tone="warning" title="Too many attempts">
            {secondsLeft
              ? `For your security, this is paused. Try again in ${waitLabel(secondsLeft)}.`
              : error.message}
          </Alert>
        ) : (
          <ErrorMessage error={error} />
        )}
        <Button type="submit" disabled={submitting || secondsLeft > 0} block size="lg">
          {submitting ? "Please wait…" : secondsLeft ? `Try again in ${waitLabel(secondsLeft)}` : submitLabel}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{footer}</p>
    </section>
  );
}
