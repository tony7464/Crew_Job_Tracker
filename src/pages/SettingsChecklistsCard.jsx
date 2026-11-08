import { useId, useState } from "react";
import { api } from "../api";
import ConfirmButton from "../components/ConfirmButton";
import ErrorMessage from "../components/ErrorMessage";
import { FormActions, Input, TextArea } from "../components/Field";
import Loading from "../components/Loading";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PlusIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { useAsync } from "../hooks";

const MAX_ITEMS = 40;

// Checklists per service type. Each job of that type gets a copy to tick off.
export default function SettingsChecklistsCard() {
  const { data, setData, error } = useAsync(api, "/api/checklists");
  const form = useAsync(api, "/api/business/request_form");
  const [editing, setEditing] = useState(null);
  const services = form.data?.service_types || [];

  function saved(template, previous) {
    setData((current) => {
      const others = current.filter((item) => item.id !== previous?.id && item.id !== template?.id);
      return template ? [...others, template].sort((a, b) => a.service_type.localeCompare(b.service_type)) : others;
    });
  }

  return (
    <Card
      title="Job checklists"
      description="Steps for each service. Every job of that service gets its own copy for the crew to tick off."
      actions={
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <PlusIcon />
          New checklist
        </Button>
      }
    >
      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">No checklists yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => setEditing(template)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{template.service_type}</span>
                  <span className="block truncate text-xs text-muted">{template.items.join(" · ")}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{template.items.length} steps</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </Card>
  );
}

function TemplateEditor({ template, services, onClose, onSaved }) {
  const listId = useId();
  const [service, setService] = useState(template?.service_type || "");
  const [steps, setSteps] = useState((template?.items || []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const lines = steps.split("\n").map((line) => line.trim()).filter(Boolean);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await api("/api/checklists", {
        method: "POST",
        body: { service_type: service.trim(), items: lines },
      });
      // Renaming a service moves its checklist: remove the old one.
      if (template && template.service_type.trim().toLowerCase() !== service.trim().toLowerCase()) {
        await api(`/api/checklists/${template.id}`, { method: "DELETE" });
      }
      onSaved(result, template);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={template ? "Edit checklist" : "New checklist"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Service"
          value={service}
          onChange={(event) => setService(event.target.value)}
          list={listId}
          hint="Jobs with this service get the checklist. Capital letters do not matter."
          required
          maxLength={120}
        />
        <datalist id={listId}>
          {services.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <TextArea
          label="Steps"
          hint={`One step per line, up to ${MAX_ITEMS}. ${lines.length} so far.`}
          rows="8"
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          required
        />
        <p className="text-xs text-muted">Jobs that already have their checklist keep it. Changes apply to jobs that open theirs from now on.</p>
        <ErrorMessage error={error} />
        <FormActions>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !lines.length || lines.length > MAX_ITEMS}>
            {saving ? "Saving…" : "Save checklist"}
          </Button>
        </FormActions>
      </form>
      {template && (
        <div className="mt-5 border-t border-border pt-4">
          <ConfirmButton
            label="Delete checklist"
            confirmLabel="Delete checklist"
            busyLabel="Deleting…"
            warning="New jobs of this service get no checklist. Jobs that already have one keep it."
            onConfirm={async () => {
              await api(`/api/checklists/${template.id}`, { method: "DELETE" });
              onSaved(null, template);
              onClose();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
