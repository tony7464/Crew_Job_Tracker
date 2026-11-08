import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { Card } from "../components/ui/Card";
import { Switch } from "../components/ui/Switch";
import { useAsync } from "../hooks";

// Automatic emails to clients about overdue invoices. Off until the owner turns it on.
export default function SettingsRemindersCard() {
  const { data, setData, error } = useAsync(api, "/api/business");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function toggle(value) {
    setSaving(true);
    setSaveError(null);
    try {
      setData(await api("/api/business", { method: "PATCH", body: { invoice_reminders: value } }));
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Invoice reminders">
      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          <Switch
            checked={data.invoice_reminders}
            onChange={toggle}
            disabled={saving}
            label="Email clients about overdue invoices"
            description="A friendly reminder with the pay link, 1, 7, and 14 days after the due date. Only invoices with a due date and a client email get them, and never more than one a day."
          />
          <ErrorMessage error={saveError} />
        </div>
      )}
    </Card>
  );
}
