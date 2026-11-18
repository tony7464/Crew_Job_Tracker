import { useTextingSummary } from "../hooks";
import { textingAlert } from "../utils/texting";
import { Alert } from "./ui/Feedback";

// Tells the owner when texts to customers are not arriving, and why ("Texting pending
// carrier approval"). Nothing while texts are fine, for anyone but the owner, or if the check
// cannot be loaded. summary: the page's own useTextingSummary() (null while it loads); leave it
// out to have it fetched here. always: also say that texting is not set up when no text was
// held back this week (Settings).
export default function TextingAlert({ summary, always = false, className }) {
  const fetched = useTextingSummary(summary === undefined);
  const alert = textingAlert(summary === undefined ? fetched : summary, { always });
  if (!alert) return null;
  return (
    <Alert tone={alert.tone} title={alert.title} className={className}>
      {alert.message}
    </Alert>
  );
}
