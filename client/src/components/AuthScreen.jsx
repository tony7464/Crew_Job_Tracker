import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";

export default function AuthScreen({ title, submitLabel, onSubmit, footer, children }) {
  const { user, loading } = useAuth();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(new FormData(event.target));
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {children}
        <ErrorMessage error={error} />
        <button type="submit" disabled={submitting} className="btn w-full">
          {submitLabel}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">{footer}</p>
    </section>
  );
}
