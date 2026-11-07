import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import ErrorMessage from "../components/ErrorMessage";
import { FormActions, Input } from "../components/Field";
import Loading from "../components/Loading";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { CheckIcon, CopyIcon, ExternalIcon, PlusIcon, XIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { buttonClass } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import SettingsPaymentsCard from "./SettingsPaymentsCard";
import SettingsChecklistsCard from "./SettingsChecklistsCard";

const PATH = "/api/business/request_form";
// Same limits as the server.
const MAX_SERVICES = 20;
const MAX_SERVICE = 60;
const MAX_BUSINESS_NAME = 80;
const OTHER = "Other";

const linkButton = buttonClass({ variant: "secondary", className: "w-full sm:w-auto" });

// The services the editor starts with: the owner's own list, or the defaults without Other.
function editableServices(settings) {
  if (!settings.uses_default_service_types) return settings.service_types;
  return settings.offered_service_types.filter((name) => name !== OTHER);
}

function FormLink({ settings, onRegenerate }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(settings.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the link is in the box to copy by hand.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        readOnly
        value={settings.url}
        aria-label="Request form link"
        onFocus={(event) => event.target.select()}
        className="field font-mono text-xs sm:text-xs"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={copy} className={linkButton}>
          {copied ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={settings.url} target="_blank" rel="noopener noreferrer" className={linkButton}>
          <ExternalIcon />
          Open form
        </a>
      </div>
      <ConfirmButton
        label="Make a new link"
        confirmLabel="Replace link"
        busyLabel="Replacing…"
        warning="The current link stops working right away. Anyone who has it, or a page that shows it, will need the new link."
        onConfirm={onRegenerate}
      />
    </div>
  );
}

function ServiceEditor({ services, onChange }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (name.length > MAX_SERVICE) return setError(`Keep each service under ${MAX_SERVICE} characters.`);
    if (services.length >= MAX_SERVICES) return setError(`You can list up to ${MAX_SERVICES} services.`);
    if (services.some((item) => item.toLowerCase() === name.toLowerCase()) || name.toLowerCase() === OTHER.toLowerCase()) {
      return setError(`${name} is already on the list.`);
    }
    onChange([...services, name]);
    setDraft("");
    setError(null);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-fg">Services</p>
      <ul className="flex flex-wrap gap-2" aria-label="Services on the form">
        {services.map((name) => (
          <li
            key={name}
            className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-2 py-1 pl-3 pr-1 text-sm"
          >
            {name}
            <button
              type="button"
              onClick={() => onChange(services.filter((item) => item !== name))}
              aria-label={`Remove ${name}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        <li className="inline-flex items-center rounded-full border border-dashed border-border-strong px-3 py-1 text-sm text-muted">
          {OTHER} <span className="sr-only">(always offered)</span>
        </li>
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add a service, like Deep cleaning"
          aria-label="New service"
          maxLength={MAX_SERVICE}
          className="field min-w-0 flex-1"
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()}>
          <PlusIcon />
          Add
        </Button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          Clients pick one of these. {OTHER} is always offered at the end, so nobody is stuck.
        </p>
      )}
    </div>
  );
}

function FormDetails({ settings, onSave }) {
  const [name, setName] = useState(settings.business_name || "");
  const [services, setServices] = useState(() => editableServices(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const original = editableServices(settings);
  const changed =
    name.trim() !== (settings.business_name || "") ||
    services.length !== original.length ||
    services.some((item, index) => item !== original[index]);

  async function save(body) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await onSave(body);
      setName(next.business_name || "");
      setServices(editableServices(next));
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save({ business_name: name.trim() || null, service_types: services });
      }}
      className="space-y-5"
    >
      <Input
        label="Business name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
        }}
        maxLength={MAX_BUSINESS_NAME}
        hint="Shown at the top of the form. Without one, the form says “Request a service”."
      />
      <ServiceEditor
        services={services}
        onChange={(next) => {
          setServices(next);
          setSaved(false);
        }}
      />
      {settings.uses_default_service_types && (
        <p className="-mt-2 text-xs text-muted">This is the default list. Change it to make it your own.</p>
      )}
      <ErrorMessage error={error} />
      {saved && !changed && <Alert tone="success">Saved.</Alert>}
      <FormActions>
        {!settings.uses_default_service_types && (
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => save({ business_name: name.trim() || null, service_types: [] })}
          >
            Use the default services
          </Button>
        )}
        <Button type="submit" disabled={saving || !changed || services.length === 0}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </FormActions>
      {services.length === 0 && (
        <p className="text-right text-xs text-muted">Add at least one service, or use the default services.</p>
      )}
    </form>
  );
}

function RequestFormCard() {
  const { user } = useAuth();
  const { data: settings, setData, error: loadError } = useAsync(api, PATH);
  const [toggleError, setToggleError] = useState(null);
  const [toggling, setToggling] = useState(false);

  async function patch(body) {
    const next = await api(PATH, { method: "PATCH", body });
    setData(next);
    return next;
  }

  async function toggle(enabled) {
    setToggling(true);
    setToggleError(null);
    try {
      await patch({ enabled });
    } catch (err) {
      setToggleError(err);
    } finally {
      setToggling(false);
    }
  }

  if (loadError) return <ErrorMessage error={loadError} />;
  if (!settings) return <Loading variant="list" label="Loading the request form…" />;

  return (
    <div className="space-y-6">
      {!user.email && (
        <Alert tone="warning" title="No email for new requests">
          Add your email on the <Link to="/account" className="link">Account</Link> page to get an email for each new
          request.
        </Alert>
      )}
      <Card
        title="Request form"
        description="A public page where clients ask for work, with photos. No account needed. New requests show up in Requests."
      >
        <div className="space-y-5">
          <Switch
            label="Accepting requests"
            description={
              settings.enabled
                ? "The form is open."
                : "The form is off. The link shows “not accepting requests right now”."
            }
            checked={settings.enabled}
            onChange={toggle}
            disabled={toggling}
          />
          <ErrorMessage error={toggleError} />
          <div className="border-t border-border pt-5">
            <p className="mb-1.5 text-sm font-medium text-fg">Form link</p>
            <p className="mb-3 text-xs text-muted">
              Share it on your website, in your email signature, or by text.
            </p>
            <FormLink
              settings={settings}
              onRegenerate={async () => setData(await api(`${PATH}/regenerate`, { method: "POST" }))}
            />
          </div>
        </div>
      </Card>
      <Card title="What the form shows">
        <FormDetails settings={settings} onSave={patch} />
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your business's request form, job checklists, and payments." />
      <div className="space-y-6">
        <RequestFormCard />
        <SettingsChecklistsCard />
        <SettingsPaymentsCard />
      </div>
    </div>
  );
}
