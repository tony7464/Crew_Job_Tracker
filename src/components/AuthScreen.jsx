import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { homePath } from "../utils/roles";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Feedback";
import { LogoMark } from "./ui/Logo";
import { useMediaQuery } from "./ui/useMotion";

const CrewScene = lazy(() => import("./three/CrewScene"));

// "42 seconds", "1 minute", "60 minutes".
function waitLabel(seconds) {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

// done: shown in place of the form once the page's job is finished (such as "Check your email").
// allowSignedIn: stay on the page when someone is already logged in (the reset link).
export default function AuthScreen({ title, subtitle, submitLabel, onSubmit, footer, children, done, allowSignedIn = false }) {
  const { user, loading } = useAuth();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // After a 429, the form stays locked until the server's Retry-After time passes.
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const wide = useMediaQuery("(min-width: 1024px)");

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
  if (user && !allowSignedIn) return <Navigate to={homePath(user)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(new FormData(event.target));
      setSubmitting(false);
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
    <div className="grid items-center gap-10 pt-4 sm:pt-10 lg:grid-cols-2">
      <section className="mx-auto flex w-full max-w-sm animate-rise flex-col">
        <div className="text-center">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {done ? (
          <div className="glass mt-8 space-y-4 rounded-2xl border border-border p-5 shadow-pop sm:p-6">{done}</div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="glass mt-8 space-y-4 rounded-2xl border border-border p-5 shadow-pop sm:p-6"
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
        )}
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </section>
      {wide && (
        <div className="ring-brand relative h-[30rem] overflow-hidden rounded-3xl bg-surface/40" aria-hidden="true">
          <Suspense fallback={null}>
            <CrewScene variant="auth" hud={false} />
          </Suspense>
          <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center font-display text-lg font-bold text-fg">
            Every job, from first call to paid.
          </p>
        </div>
      )}
    </div>
  );
}
