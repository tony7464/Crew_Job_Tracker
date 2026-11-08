import { useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Input } from "../components/Field";
import Loading from "../components/Loading";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Switch } from "../components/ui/Switch";
import { useAsync } from "../hooks";
import { fieldErrors, phoneLooksValid } from "../utils/requests";

// Texts and emails to customers about estimate visits, and the number they can call back.
export default function SettingsMessagesCard() {
  const { data, setData, error } = useAsync(api, "/api/business");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [phone, setPhone] = useState(null);

  async function patch(body) {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api("/api/business", { method: "PATCH", body });
      setData(updated);
      return updated;
    } catch (err) {
      setSaveError(err);
      return null;
    } finally {
      setSaving(false);
    }
  }

  const shownPhone = phone ?? data?.business_phone ?? "";
  const phoneError = shownPhone.trim() && !phoneLooksValid(shownPhone.trim()) ? "Enter a phone number like (512) 555-0101." : null;

  async function savePhone(event) {
    event.preventDefault();
    if (phoneError) return;
    if (await patch({ business_phone: shownPhone.trim() || null })) setPhone(null);
  }

  return (
    <Card title="Customer texts and emails" description="About estimate visits booked with New quote. Texts never include prices.">
      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <Switch
            checked={data.visit_confirmations}
            onChange={(value) => patch({ visit_confirmations: value })}
            disabled={saving}
            label="Confirm visits when they're booked"
            description="Texts the customer (or emails them, without a mobile number) the date, time, and who's coming. Also when a visit moves or is cancelled. You can turn it off for one booking."
          />
          <Switch
            checked={data.visit_reminders}
            onChange={(value) => patch({ visit_reminders: value })}
            disabled={saving}
            label="Remind customers the day before"
            description="One text or email per visit, between 9 AM and 8 PM your time, not on a day they were just sent the details."
          />
          <form onSubmit={savePhone} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <Input
              label="Business phone"
              type="tel"
              inputMode="tel"
              value={shownPhone}
              onChange={(event) => setPhone(event.target.value)}
              error={phoneError || fieldErrors(saveError).business_phone}
              hint="Added to every text and email ('Questions? Call …'), so customers reach you, not the texting number."
              maxLength={40}
              className="min-w-56 flex-1"
            />
            <Button type="submit" variant="secondary" disabled={saving || phone === null}>
              Save
            </Button>
          </form>
          <ErrorMessage error={fieldErrors(saveError).business_phone ? null : saveError} />
        </div>
      )}
    </Card>
  );
}
