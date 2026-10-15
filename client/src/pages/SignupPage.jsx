import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const { user, loading, signup } = useAuth();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setSubmitting(true);
    setError(null);
    try {
      await signup({
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
      });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Username
          <input
            name="username"
            autoComplete="username"
            required
            className="field"
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="field"
          />
        </label>
        <ErrorMessage error={error} />
        <button
          type="submit"
          disabled={submitting}
          className="btn w-full"
        >
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" className="text-sky-800 hover:underline">
          Log in
        </Link>
      </p>
    </section>
  );
}
