import { UnverifiedNotice } from "./VerifyEmail";
import { Alert } from "./ui/Feedback";

export default function ErrorMessage({ error, className }) {
  if (!error) return null;
  // A create refused until the owner verifies their email: a friendly notice with Resend, not an error.
  if (error.data?.code === "email_unverified") return <UnverifiedNotice error={error} className={className} />;
  return (
    <Alert tone="danger" className={className}>
      {error.message}
    </Alert>
  );
}
