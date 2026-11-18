import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { ButtonLink } from "../components/ui/Button";
import { Alert } from "../components/ui/Feedback";
import { useAuth } from "../context/useAuth";

const MIN_PASSWORD = 8;

// What to show in place of the form: [tone, title, text, link, link label].
const OUTCOMES = {
  done: [
    "success",
    "Your password is changed",
    "Every device was logged out. Log in with your new password.",
    "/login",
    "Log in",
  ],
  expired: [
    "warning",
    "This link has expired",
    "Reset links work for 1 hour. Send yourself a new one.",
    "/forgot-password",
    "Send a new link",
  ],
  invalid: [
    "warning",
    "This link is not valid",
    "It may have been used already, or replaced by a newer one. Send yourself a new one.",
    "/forgot-password",
    "Send a new link",
  ],
};

// Opened from the emailed link (/reset-password?token=...): choose a new password.
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { refresh } = useAuth();
  const [outcome, setOutcome] = useState(token ? null : "invalid");

  async function submit(form) {
    const password = String(form.get("new_password") || "");
    if (password !== String(form.get("confirm_password") || "")) {
      throw new Error("The two passwords do not match.");
    }
    try {
      await api("/api/password/reset", { method: "POST", body: { token, new_password: password }, skipAuth: true });
    } catch (err) {
      const code = err.data?.code;
      if (code !== "token_expired" && code !== "token_invalid") throw err;
      setOutcome(code === "token_expired" ? "expired" : "invalid");
      return;
    }
    setOutcome("done");
    // The reset ended every session, this browser's too: let the menu catch up.
    refresh();
  }

  const shown = outcome && OUTCOMES[outcome];

  return (
    <AuthScreen
      title="Choose a new password"
      subtitle="Pick a password you do not use anywhere else."
      submitLabel="Change password"
      allowSignedIn
      onSubmit={submit}
      done={
        shown && (
          <>
            <Alert tone={shown[0]} title={shown[1]}>
              {shown[2]}
            </Alert>
            <ButtonLink to={shown[3]} block size="lg">
              {shown[4]}
            </ButtonLink>
          </>
        )
      }
      footer={
        !shown && (
          <Link to="/login" className="link">
            Back to log in
          </Link>
        )
      }
    >
      <Input
        label="New password"
        name="new_password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        required
        hint={`At least ${MIN_PASSWORD} characters.`}
      />
      <Input
        label="New password again"
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        required
      />
    </AuthScreen>
  );
}
