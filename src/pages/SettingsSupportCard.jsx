import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { useAsync } from "../hooks";
import { accessLength, eventText, formatWhen } from "../utils/admin";

const PATH = "/api/business/support_access";

// The owner's switch for letting Crew Job Tracker support look at the business, and the
// record of what support has done. Off unless the owner turns it on, for a set time.
export default function SettingsSupportCard() {
  const { data, setData, error: loadError } = useAsync(api, PATH);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(options) {
    setBusy(true);
    setError(null);
    try {
      setData(await api(PATH, options));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Support access"
      description="Let Crew Job Tracker support see your account the way you see it, when you ask for help. They can look, and cannot change, send, or download anything. It is off unless you turn it on here, and it turns itself off."
    >
      {loadError && <ErrorMessage error={loadError} />}
      {data && (
        <div className="space-y-4">
          {data.on ? (
            <Alert tone="info" title={`On until ${formatWhen(data.until)}`}>
              Support can look at your clients, jobs, quotes, and invoices until then. You can turn it off at any
              moment.
            </Alert>
          ) : (
            <p className="text-sm text-muted">Off. Support cannot open your account.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {data.on && <span className="text-sm text-muted">Change it to end in</span>}
            {data.hours_options.map((hours) => (
              <Button
                key={hours}
                variant={data.on ? "secondary" : "primary"}
                size="sm"
                disabled={busy}
                onClick={() => run({ method: "POST", body: { hours } })}
              >
                {data.on ? accessLength(hours) : `Allow for ${accessLength(hours)}`}
              </Button>
            ))}
            {data.on && (
              <Button variant="danger-outline" size="sm" disabled={busy} onClick={() => run({ method: "DELETE" })}>
                Turn off now
              </Button>
            )}
          </div>
          <ErrorMessage error={error} />
          {data.events.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-1.5 text-sm font-medium text-fg">What has happened</p>
              <ul className="space-y-1.5">
                {data.events.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                    <span className="min-w-0 text-fg [overflow-wrap:anywhere]">{eventText(event, true)}</span>
                    <span className="shrink-0 text-xs text-muted">{formatWhen(event.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
