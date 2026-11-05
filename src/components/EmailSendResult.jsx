import { Alert } from "./ui/Feedback";

// What happened to the email after sending a quote or invoice. The API answers
// with email ("queued", "skipped_no_email", or "failed") and email_delivery
// ("resend" or "log"). "queued" only means the server handed the email to its
// background sender: it is only called emailed when that sender is Resend.
// Resend answers after the page does, so a refusal there shows in the server
// log, not here; the copy says so instead of promising delivery.
//
// verification: the email holds a link only the recipient should use (email
// verification), so there is no link to copy here; log mode points to the server log.
export default function EmailSendResult({ result, kind, linkName, to, customerName, verification = false }) {
  if (!result) return null;
  if (verification) return <VerificationResult result={result} to={to} />;
  const sentTitle = `${kind} sent`;
  if (result.email === "queued" && result.email_delivery === "resend") {
    return (
      <Alert tone="success" title={sentTitle}>
        We emailed the {linkName} to {to}. If it does not arrive, copy the link below and send it yourself.
      </Alert>
    );
  }
  if (result.email === "queued") {
    return (
      <Alert tone="warning" title={`${sentTitle}, but not emailed`}>
        Email isn't set up (RESEND_API_KEY), so nothing was sent to {to}. Copy the link below and send it to them
        yourself.
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title={`${sentTitle}, but not emailed`}>
      {result.email === "skipped_no_email"
        ? `No email on file for ${customerName}. Copy the link below and send it to them yourself.`
        : "The email could not be sent. Copy the link below and send it yourself."}
    </Alert>
  );
}

function VerificationResult({ result, to }) {
  if (result.email === "queued" && result.email_delivery === "resend") {
    return (
      <Alert tone="success" title="Verification email sent">
        We emailed a link to {to}. It works once and expires in 48 hours. Check your spam folder if it does not
        arrive in a few minutes.
      </Alert>
    );
  }
  if (result.email === "queued") {
    return (
      <Alert tone="warning" title="Verification email not really sent">
        Email isn't set up on this server (RESEND_API_KEY), so nothing was sent to {to}. The link was written to
        the server log instead.
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title="The verification email could not be sent">
      Try Resend again in a minute.
    </Alert>
  );
}
