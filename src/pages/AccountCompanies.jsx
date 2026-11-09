import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Input, Select } from "../components/Field";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { useAuth } from "../context/useAuth";
import { companyRoleName } from "../utils/roles";

function CompanyItem({ company, onSwitch, onCancel, busy }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="truncate">{company.business_name}</span>
          {company.current && <Badge tone="primary">Working here now</Badge>}
          {company.pending && <Badge tone="warning">Waiting for approval</Badge>}
        </p>
        <p className="text-sm text-muted">{companyRoleName(company.role)}</p>
      </div>
      {company.usable && !company.current && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onSwitch(company)}>
          Switch
        </Button>
      )}
      {company.pending && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCancel(company)}>
          Cancel request
        </Button>
      )}
    </li>
  );
}

function JoinForm({ onJoined }) {
  const [code, setCode] = useState("");
  const [role, setRole] = useState("employee");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const result = await api("/api/companies/join", { method: "POST", body: { join_code: code, role } });
      setCode("");
      onJoined(result.message);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Input
          label="Company code"
          name="join_code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCD-EFGH"
          autoCapitalize="characters"
          autoComplete="off"
          hint="Ask the owner. It's on their Employees page."
          required
        />
        <Select label="Join as" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
        </Select>
      </div>
      <ErrorMessage error={error} />
      <Button type="submit" disabled={sending || !code.trim()}>
        {sending ? "Sending…" : "Ask to join"}
      </Button>
    </form>
  );
}

function StartForm() {
  const { switchCompany } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const row = await api("/api/companies", { method: "POST", body: { business_name: name } });
      await switchCompany(row.id);
    } catch (err) {
      setError(err);
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        label="Company name"
        name="business_name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        hint="Shown on your quotes, invoices, and texts. You'll be its owner, with the same login."
        required
      />
      <ErrorMessage error={error} />
      <Button type="submit" variant="secondary" disabled={sending || !name.trim()}>
        {sending ? "Starting…" : "Start my company"}
      </Button>
    </form>
  );
}

// Every company on this login, plus joining another one and starting your own.
export default function CompaniesCard() {
  const { user, refresh, switchCompany } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(null);
  const companies = user.companies || [];
  const ownsOne = companies.some((company) => company.role === "owner");

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="companies" className="scroll-mt-20">
      <Card
        title="Your companies"
        description="One login for every company you work for. Switch between them here or from the top bar."
      >
        <ul className="divide-y divide-border">
          {companies.map((company) => (
            <CompanyItem
              key={company.id}
              company={company}
              busy={busy}
              onSwitch={(target) => run(() => switchCompany(target.id))}
              onCancel={(target) =>
                run(async () => {
                  await api(`/api/companies/${target.id}`, { method: "DELETE" });
                  setNotice("");
                  await refresh();
                })
              }
            />
          ))}
        </ul>
        <ErrorMessage error={error} />
        {notice && <Alert tone="success" className="mt-3">{notice}</Alert>}
        <div className="mt-4 space-y-6 border-t border-border pt-4">
          <section className="space-y-2">
            <h3 className="font-semibold">Join another company</h3>
            <JoinForm
              onJoined={async (message) => {
                setNotice(message);
                await refresh();
              }}
            />
          </section>
          {!ownsOne && (
            <section className="space-y-2">
              <h3 className="font-semibold">Start your own company</h3>
              <StartForm />
            </section>
          )}
        </div>
      </Card>
    </div>
  );
}
