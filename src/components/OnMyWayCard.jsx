import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Alert } from "./ui/Feedback";
import { cx } from "./ui/styles";

const NOT_SET_UP = {
  sms: "Texting is not set up yet, so the text was only written to the server log.",
  email: "Email is not set up yet, so the email was only written to the server log.",
};

function stamp(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Tell the client the crew is on the way: pick about how long, then send a text
// (or an email). onSent() after sending, so the notes log can show it.
export default function OnMyWayCard({ jobId, onSent }) {
  const { data, setData, error } = useAsync(api, `/api/jobs/${jobId}/on_my_way`);
  const [eta, setEta] = useState(20);
  const [channel, setChannel] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [result, setResult] = useState(null);

  if (error) return null;
  if (!data || !data.can_send) return null;
  const { channels } = data;
  if (!channels.sms && !channels.email) {
    return (
      <Card title="On my way">
        <p className="text-sm text-muted">This client has no phone number or email on file, so they cannot be told.</p>
      </Card>
    );
  }
  const chosen = channel || (channels.sms ? "sms" : "email");

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      const response = await api(`/api/jobs/${jobId}/on_my_way`, { method: "POST", body: { eta_minutes: eta, channel: chosen } });
      setResult(response);
      setData((current) => ({ ...current, last: response.message }));
      onSent?.();
    } catch (err) {
      setSendError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card title="On my way" description="Let the client know you are coming.">
      <div className="space-y-3">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Arriving in about</legend>
          <div className="flex flex-wrap gap-1.5">
            {data.eta_choices.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={eta === minutes}
                onClick={() => setEta(minutes)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  eta === minutes ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border text-muted hover:bg-surface-2",
                )}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </fieldset>
        {channels.sms && channels.email && (
          <div className="flex gap-4 text-sm">
            {[["sms", "Text"], ["email", "Email"]].map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input type="radio" name={`omw-${jobId}`} checked={chosen === value} onChange={() => setChannel(value)} />
                {label}
              </label>
            ))}
          </div>
        )}
        <Button block onClick={send} disabled={sending}>
          {sending ? "Sending…" : chosen === "sms" ? "Text the client" : "Email the client"}
        </Button>
        <ErrorMessage error={sendError} />
        {result && result.delivery === "log" && <Alert tone="warning">{NOT_SET_UP[result.message.channel]}</Alert>}
        {data.last && (
          <p className="text-xs text-muted">
            Last told at {stamp(data.last.sent_at)} by {data.last.sender.username}: about {data.last.eta_minutes} min,{" "}
            {data.last.channel === "sms" ? "texted" : "emailed"} {data.last.sent_to}.
          </p>
        )}
      </div>
    </Card>
  );
}
