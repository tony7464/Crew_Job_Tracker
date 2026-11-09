import { useState } from "react";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import ErrorMessage from "../components/ErrorMessage";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CheckIcon, CopyIcon } from "../components/ui/Icons";
import { SectionHeader } from "../components/ui/PageHeader";
import { useAsync } from "../hooks";
import { formatMoment } from "../utils/quotes";

function joinLink(code) {
  return `${window.location.origin}/signup?code=${encodeURIComponent(code)}`;
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the code is on screen to copy by hand.
        }
      }}
    >
      {copied ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </Button>
  );
}

// The code crew type at signup. Joining by code always waits for the owner's OK below.
export function JoinCodeCard() {
  const { data, setData, error } = useAsync(api, "/api/join_code");
  const [busyError, setBusyError] = useState(null);

  async function change(method) {
    setBusyError(null);
    try {
      setData(await api("/api/join_code", { method }));
    } catch (err) {
      setBusyError(err);
      throw err;
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;

  return (
    <Card
      title="Company code"
      description="Managers and employees sign up with this code to ask to join. You approve each person before they can log in."
    >
      {data.enabled ? (
        <div className="space-y-4">
          <p className="font-mono text-2xl font-semibold tracking-[0.2em] text-fg" aria-label="Company code">
            {data.code}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={data.code} label="Copy code" />
            <CopyButton text={joinLink(data.code)} label="Copy signup link" />
          </div>
          <div className="flex flex-wrap gap-x-4">
            <ConfirmButton
              label="Make a new code"
              confirmLabel="Replace the code"
              busyLabel="Replacing…"
              warning="The current code stops working. Anyone you gave it to needs the new one."
              onConfirm={() => change("POST")}
            />
            <ConfirmButton
              label="Turn off"
              confirmLabel="Turn off the code"
              busyLabel="Turning off…"
              warning="Nobody can ask to join with a code until you turn it back on. Email invites still work."
              onConfirm={() => change("DELETE")}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Joining with a code is off. Email invites still work.</p>
          <Button size="sm" onClick={() => change("POST").catch(() => {})}>
            Turn on with a new code
          </Button>
        </div>
      )}
      <ErrorMessage error={busyError} className="mt-3" />
    </Card>
  );
}

// People who signed up with the code, waiting for the owner to approve or decline them.
export function JoinRequests({ onApproved }) {
  const { data: requests, setData, error } = useAsync(api, "/api/join_requests");

  if (error) return <ErrorMessage error={error} />;
  if (!requests?.length) return null;

  function remove(id) {
    setData((current) => current.filter((request) => request.id !== id));
  }

  return (
    <section>
      <SectionHeader
        title={`Waiting for approval (${requests.length})`}
        description="They signed up with your company code. Only approve people you know."
      />
      <ul className="grid gap-4 lg:grid-cols-2">
        {requests.map((request) => (
          <JoinRequestCard
            key={request.id}
            request={request}
            onDone={(employee) => {
              remove(request.id);
              if (employee) onApproved(employee);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function JoinRequestCard({ request, onDone }) {
  const [manager, setManager] = useState(request.can_manage_clients);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(run) {
    setBusy(true);
    setError(null);
    try {
      onDone(await run());
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <li className="space-y-4 rounded-xl border border-warning/40 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar person={request} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="truncate">{request.name}</span>
            <Badge tone="warning">Asked to join as {request.can_manage_clients ? "Manager" : "Employee"}</Badge>
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{request.email}</p>
          <p className="mt-0.5 text-xs text-muted">Signed up {formatMoment(request.requested_at)}</p>
        </div>
      </div>
      <fieldset disabled={busy}>
        <legend className="mb-1.5 text-sm font-medium">Approve as</legend>
        <div className="flex flex-wrap gap-2">
        {[
          [false, "Employee", "Their own jobs, no prices"],
          [true, "Manager", "Clients, visits, quoting, team schedule"],
        ].map(([value, label, hint]) => (
          <label
            key={label}
            className={`flex flex-1 cursor-pointer flex-col rounded-lg border px-3 py-2 ${
              manager === value ? "border-primary bg-primary-soft" : "border-border"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={`role-${request.id}`}
              checked={manager === value}
              onChange={() => setManager(value)}
            />
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </label>
        ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            act(() =>
              api(`/api/join_requests/${request.id}/approve`, {
                method: "POST",
                body: { can_manage_clients: manager },
              }),
            )
          }
        >
          <CheckIcon className="h-4 w-4" />
          Approve
        </Button>
        <Button
          variant="danger-outline"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await api(`/api/join_requests/${request.id}`, { method: "DELETE" });
              return null;
            })
          }
        >
          Decline
        </Button>
      </div>
      <ErrorMessage error={error} />
    </li>
  );
}
