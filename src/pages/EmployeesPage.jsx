import { useState } from "react";
import { api } from "../api";
import CalendarLinks from "../components/CalendarLinks";
import ColorPicker from "../components/ColorPicker";
import ErrorMessage from "../components/ErrorMessage";
import { Checkbox, FormActions, Input } from "../components/Field";
import Loading from "../components/Loading";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert, EmptyState } from "../components/ui/Feedback";
import { ChevronRightIcon, PlusIcon, UsersIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { PageHeader, SectionHeader } from "../components/ui/PageHeader";
import { useAsync, useSubmit } from "../hooks";
import EmployeeInvites, { InviteButton } from "./EmployeeInvites";

const MIN_PASSWORD = 8;

function timeZoneOptions() {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
}

export default function EmployeesPage() {
  const { data: employees, setData, error } = useAsync(api, "/api/employees");
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);

  function replace(updated) {
    setData((current) => current.map((employee) => (employee.id === updated.id ? updated : employee)));
  }

  async function createEmployee(body) {
    const created = await api("/api/employees", { method: "POST", body });
    setData((current) =>
      [...current, created].sort((a, b) => a.username.localeCompare(b.username)),
    );
    setAdding(false);
  }

  if (error) return <ErrorMessage error={error} />;
  if (!employees) return <Loading />;

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <PlusIcon />
      Add employee
    </Button>
  );
  const actions = (
    <div className="flex flex-wrap gap-2">
      <InviteButton onClick={() => setInviting(true)} />
      {addButton}
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Employees"
        description="Employees log in on the same page you do. They see only the jobs you assign them, never prices. Invite them by email, or add them yourself with a temporary password."
        actions={actions}
      />
      <section>
        <SectionHeader
          title="Your crew"
          description="Each person's color marks their jobs and lunch breaks on the schedule."
        />
        {employees.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {employees.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} onChange={replace} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={UsersIcon}
            title="No employees yet"
            description="Invite your crew by email, or add them yourself, so you can assign them to jobs."
            action={actions}
          />
        )}
      </section>
      <EmployeeInvites inviting={inviting} setInviting={setInviting} />
      <BusinessSettings />
      {adding && (
        <Modal title="Add an employee" onClose={() => setAdding(false)}>
          <CreateEmployeeForm onSubmit={createEmployee} onCancel={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}

function CreateEmployeeForm({ onSubmit, onCancel }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, true);

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    handleSubmit(event, {
      username: form.get("username"),
      password: form.get("password"),
      email: form.get("email") || null,
      can_manage_clients: form.get("can_manage_clients") === "on",
    });
  }

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Username" name="username" autoComplete="off" autoCapitalize="none" required />
        <Input
          label="Temporary password"
          name="password"
          type="text"
          autoComplete="off"
          minLength={MIN_PASSWORD}
          required
        />
      </div>
      <Input label="Email (optional)" name="email" type="email" autoComplete="off" />
      <Checkbox
        name="can_manage_clients"
        label="Client access"
        description="Can view, add, and edit clients. Never sees prices."
      />
      <Alert tone="info">
        Share the username and temporary password with them. They can change the password from Account.
        A calendar color is picked for them; you can change it after.
      </Alert>
      <ErrorMessage error={error} />
      <FormActions>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add employee"}
        </Button>
      </FormActions>
    </form>
  );
}

function EmployeeCard({ employee, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState(null);

  async function run(request, message) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      onChange(await request());
      if (message) setNotice(message);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function patch(body, message) {
    return run(() => api(`/api/employees/${employee.id}`, { method: "PATCH", body }), message);
  }

  return (
    <li className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar person={employee} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="truncate">{employee.username}</span>
            <Badge tone={employee.is_active ? "success" : "neutral"}>
              {employee.is_active ? "Active" : "Inactive"}
            </Badge>
            {employee.can_manage_clients && <Badge tone="primary">Client access</Badge>}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{employee.email || "No email"}</p>
        </div>
      </div>
      <ColorPicker
        key={employee.color}
        value={employee.color}
        disabled={busy}
        onChange={(color) => patch({ color }).catch(() => {})}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => patch({ can_manage_clients: !employee.can_manage_clients }).catch(() => {})}
        >
          {employee.can_manage_clients ? "Remove client access" : "Allow client access"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          aria-expanded={resetting}
          onClick={() => setResetting((value) => !value)}
        >
          Reset password
        </Button>
        <Button
          variant={employee.is_active ? "danger-outline" : "secondary"}
          size="sm"
          disabled={busy}
          onClick={() =>
            patch(
              { is_active: !employee.is_active },
              employee.is_active ? `${employee.username} was logged out and can no longer log in.` : null,
            ).catch(() => {})
          }
        >
          {employee.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
      {resetting && (
        <ResetPasswordForm
          onSubmit={async (password) => {
            await patch({ password }, `New temporary password set. ${employee.username} was logged out.`);
            setResetting(false);
          }}
          onCancel={() => setResetting(false)}
        />
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      <ErrorMessage error={error} />
      <details className="group rounded-lg border border-border bg-surface-2/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
          Calendar feed link
        </summary>
        <div className="border-t border-border px-3 py-3">
          <CalendarLinks
            links={employee}
            // ConfirmButton shows any error itself.
            onRegenerate={async () =>
              onChange(await api(`/api/employees/${employee.id}/calendar_token`, { method: "POST" }))
            }
          />
        </div>
      </details>
    </li>
  );
}

function ResetPasswordForm({ onSubmit, onCancel }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, true);

  return (
    <form
      onSubmit={(event) => handleSubmit(event, new FormData(event.target).get("password"))}
      className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-3"
    >
      <div className="min-w-48 flex-1">
        <Input
          label="New temporary password"
          name="password"
          type="text"
          autoComplete="off"
          minLength={MIN_PASSWORD}
          required
        />
      </div>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={submitting}>
        Set password
      </Button>
      <div className="w-full">
        <ErrorMessage error={error} />
      </div>
    </form>
  );
}

function BusinessSettings() {
  const { data: business, setData, error: loadError } = useAsync(api, "/api/business");
  const [saved, setSaved] = useState(false);
  const { error, submitting, handleSubmit } = useSubmit(async (body) => {
    setSaved(false);
    setData(await api("/api/business", { method: "PATCH", body }));
    setSaved(true);
  }, false);
  const zones = timeZoneOptions();

  if (loadError) return <ErrorMessage error={loadError} />;
  if (!business) return null;

  return (
    <Card
      title="Business time zone"
      description="Job times are in this zone. Employee calendar feeds use it so jobs show at the right hour."
    >
      <form
        onSubmit={(event) => handleSubmit(event, { timezone: new FormData(event.target).get("timezone") })}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-56 flex-1">
          <Input
            key={business.timezone}
            label="Time zone"
            name="timezone"
            list="time-zones"
            defaultValue={business.timezone}
            required
          />
          <datalist id="time-zones">
            {zones.map((zone) => <option key={zone} value={zone} />)}
          </datalist>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </form>
      {saved && <Alert tone="success" className="mt-3">Saved.</Alert>}
      <ErrorMessage error={error} className="mt-3" />
    </Card>
  );
}
