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
import { JoinCodeCard, JoinRequests } from "./EmployeeJoinRequests";

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

  function add(created) {
    setData((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function createEmployee(body) {
    add(await api("/api/employees", { method: "POST", body }));
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
        description="Your team logs in on the same page you do. Employees see only the jobs you assign them, never prices. Managers also handle clients, estimate visits, and quotes. Share your company code, invite people by email, or add them yourself."
        actions={actions}
      />
      <JoinRequests onApproved={add} />
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
      <JoinCodeCard />
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
      first_name: form.get("first_name") || undefined,
      last_name: form.get("last_name") || undefined,
      username: form.get("username"),
      password: form.get("password"),
      email: form.get("email") || null,
      can_manage_clients: form.get("can_manage_clients") === "on",
      can_quote: form.get("can_quote") === "on",
    });
  }

  return (
    <form onSubmit={onSubmitForm} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="First name" name="first_name" autoComplete="off" maxLength={60} required />
        <Input label="Last name" name="last_name" autoComplete="off" maxLength={60} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Username"
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          required
          hint="They log in with this, or their email."
        />
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
        label="Manager"
        description="Can view, add, and edit clients, book estimate visits, and see the team schedule. Never sees job prices."
      />
      <Checkbox
        name="can_quote"
        label="Can quote on site"
        description="Prices and sends the quote for estimate visits they go on (any visit, with client access)."
      />
      <Alert tone="info">
        Share the username and temporary password with them. They can also log in with their email. They can change the password from Account.
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
  const [renaming, setRenaming] = useState(false);
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
            <span className="truncate">{employee.name}</span>
            <Badge tone={employee.is_active ? "success" : "neutral"}>
              {employee.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge tone="primary">{employee.can_manage_clients ? "Manager" : "Employee"}</Badge>
            {employee.can_quote && <Badge tone="primary">Can quote</Badge>}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{employee.email || "No email"}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {employee.other_companies ? "Also works for another company" : `Username: ${employee.username}`}
          </p>
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
          {employee.can_manage_clients ? "Make employee" : "Make manager"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => patch({ can_quote: !employee.can_quote }).catch(() => {})}
        >
          {employee.can_quote ? "Stop quoting" : "Allow quoting on site"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          aria-expanded={renaming}
          onClick={() => setRenaming((value) => !value)}
        >
          Edit name
        </Button>
        {/* Their login also opens another company, so only they can change its password. */}
        {!employee.other_companies && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            aria-expanded={resetting}
            onClick={() => setResetting((value) => !value)}
          >
            Reset password
          </Button>
        )}
        <Button
          variant={employee.is_active ? "danger-outline" : "secondary"}
          size="sm"
          disabled={busy}
          onClick={() =>
            patch(
              { is_active: !employee.is_active },
              employee.is_active ? `${employee.name} was logged out and can no longer log in.` : null,
            ).catch(() => {})
          }
        >
          {employee.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
      {renaming && (
        <NameForm
          person={employee}
          onSubmit={async (body) => {
            await patch(body);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      )}
      {resetting && (
        <ResetPasswordForm
          onSubmit={async (password) => {
            await patch({ password }, `New temporary password set. ${employee.name} was logged out.`);
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

export function NameForm({ person, onSubmit, onCancel, submitLabel = "Save name" }) {
  const { error, submitting, handleSubmit } = useSubmit(onSubmit, true);

  return (
    <form
      onSubmit={(event) => {
        const form = new FormData(event.target);
        handleSubmit(event, { first_name: form.get("first_name"), last_name: form.get("last_name") });
      }}
      className="space-y-3 rounded-lg bg-surface-2 p-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" name="first_name" defaultValue={person.first_name || ""} maxLength={60} required />
        <Input label="Last name" name="last_name" defaultValue={person.last_name || ""} maxLength={60} required />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
      <ErrorMessage error={error} />
    </form>
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
