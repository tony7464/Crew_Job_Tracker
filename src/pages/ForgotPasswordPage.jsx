import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { Alert } from "../components/ui/Feedback";

// Asks for the account's email and has the server send a reset link. The answer is the
// same whether or not the email has an account, so the page never says which.
export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState(null);

  return (
    <AuthScreen
      title="Forgot your password?"
      subtitle="Enter the email on your account and we will send you a link to choose a new one."
      submitLabel="Send reset link"
      onSubmit={async (form) => {
        const email = String(form.get("email") || "").trim();
        await api("/api/password/forgot", { method: "POST", body: { email }, skipAuth: true });
        setSentTo(email);
      }}
      done={
        sentTo && (
          <>
            <Alert tone="success" title="Check your email">
              If {sentTo} has an account, a link to choose a new password is on its way. It works once and expires in 1
              hour.
            </Alert>
            <p className="text-sm text-muted">
              Nothing after a few minutes? Check your spam folder, or{" "}
              <button type="button" className="link" onClick={() => setSentTo(null)}>
                try another email
              </button>
              .
            </p>
          </>
        )
      }
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="link">
            Back to log in
          </Link>
        </>
      }
    >
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        required
        hint="No email on your account? Ask your employer to set a new password for you."
      />
    </AuthScreen>
  );
}
