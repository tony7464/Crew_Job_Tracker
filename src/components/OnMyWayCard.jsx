import { useEffect, useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { driveText, locationProblem, suggestEta } from "../utils/driveTime";
import { deliveryBadge } from "../utils/texting";
import ErrorMessage from "./ErrorMessage";
import { Badge } from "./ui/Badge";
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
  const [reloadKey, setReloadKey] = useState(0);
  const { data, setData, error } = useAsync(api, `/api/jobs/${jobId}/on_my_way`, reloadKey);
  // Sends so far: Twilio says what became of a text a moment after it goes, so look again then.
  const [sends, setSends] = useState(0);
  useEffect(() => {
    if (!sends) return undefined;
    const timers = [5000, 20000].map((wait) => setTimeout(() => setReloadKey((key) => key + 1), wait));
    return () => timers.forEach(clearTimeout);
  }, [sends]);
  const [eta, setEta] = useState(20);
  const [channel, setChannel] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [result, setResult] = useState(null);
  // The drive from where this person is: null, "finding", { leg } or { problem }.
  const [drive, setDrive] = useState(null);

  // Ask the device where it is, get the drive from there, and pick the arrival time that
  // fits. The location is used for this one answer; the server does not keep it.
  function fromHere() {
    if (!navigator.geolocation) {
      setDrive({ problem: "This device cannot share its location. Pick a time yourself." });
      return;
    }
    setDrive("finding");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const body = { lat: position.coords.latitude, lng: position.coords.longitude };
          const leg = await api(`/api/jobs/${jobId}/drive_time`, { method: "POST", body });
          setDrive({ leg });
          setEta(suggestEta(leg.minutes, data.eta_choices));
        } catch (err) {
          setDrive({ problem: err.data?.errors?.address?.[0] || err.data?.errors?.drive?.[0] || err.message });
        }
      },
      (failure) => setDrive({ problem: locationProblem(failure.code) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  if (error) return null;
  if (!data || !data.can_send) return null;
  const { channels } = data;
  // Why no text can go, when one cannot. The server checks again before sending.
  const noText = {
    opted_out: "They are marked not to be texted.",
    no_consent: "They have not agreed to job texts.",
  }[data.sms_state];
  if (!channels.sms && !channels.email) {
    return (
      <Card title="On my way">
        <p className="text-sm text-muted">
          {noText ? `${noText} They have no email on file either, so they cannot be told here.` : "This client has no phone number or email on file, so they cannot be told."}
        </p>
      </Card>
    );
  }
  const chosen = channel || (channels.sms ? "sms" : "email");
  // What became of the last text (null for an email, or before Twilio has answered).
  const lastText = deliveryBadge(data.last?.delivery);

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      const response = await api(`/api/jobs/${jobId}/on_my_way`, { method: "POST", body: { eta_minutes: eta, channel: chosen } });
      setResult(response);
      setData((current) => ({ ...current, last: response.message }));
      setSends((count) => count + 1);
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
          <div className="mt-2 text-xs text-muted">
            <button type="button" className="link" onClick={fromHere} disabled={drive === "finding"}>
              {drive === "finding" ? "Finding the drive from here…" : "Use my location to pick the time"}
            </button>
            {drive?.leg && (
              <p className="mt-1" role="status">
                From where you are: {driveText(drive.leg)}, without traffic. Picked {eta} min; change it if you need to.
              </p>
            )}
            {drive?.problem && <p className="mt-1 font-medium text-danger">{drive.problem}</p>}
            {!drive && <p className="mt-1">Your location is used once to work out the drive. It is not saved.</p>}
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
        {!channels.sms && noText && <p className="text-xs text-muted">{noText} They will get an email.</p>}
        <Button block onClick={send} disabled={sending}>
          {sending ? "Sending…" : chosen === "sms" ? "Text the client" : "Email the client"}
        </Button>
        <ErrorMessage error={sendError} />
        {result && result.delivery === "log" && <Alert tone="warning">{NOT_SET_UP[result.message.channel]}</Alert>}
        {data.last && (
          <p className="text-xs text-muted">
            {lastText?.tone === "danger" ? "Last tried at" : "Last told at"} {stamp(data.last.sent_at)} by{" "}
            {data.last.sender.name}: about {data.last.eta_minutes} min,{" "}
            {data.last.channel === "sms" ? "texted" : "emailed"} {data.last.sent_to}.
            {lastText && (
              <>
                {" "}
                <Badge tone={lastText.tone}>{lastText.label}</Badge>
              </>
            )}
          </p>
        )}
        {lastText?.reason && (
          <p className={cx("text-xs", lastText.tone === "danger" ? "text-danger" : "text-muted")}>{lastText.reason}</p>
        )}
      </div>
    </Card>
  );
}
