import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "./ErrorMessage";
import { Button, ButtonLink } from "./ui/Button";
import { Spinner } from "./ui/Feedback";
import { DollarIcon } from "./ui/Icons";

// A button that makes an invoice for a job or an accepted quote, or links to the one it already has.
export default function CreateInvoiceButton({ source, existing, disabledReason, size = "md" }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (existing) {
    return (
      <ButtonLink to={`/invoices/${existing.id}`} variant="secondary" size={size}>
        <DollarIcon />
        {existing.label} ({existing.status})
      </ButtonLink>
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const invoice = await api("/api/invoices", { method: "POST", body: source });
      navigate(`/invoices/${invoice.id}`, { state: { notice: "Draft invoice created. Check it, then send it." } });
    } catch (err) {
      // 409 with the invoice it already has (made in another tab): go there.
      if (err.status === 409 && err.data?.invoice?.id) {
        navigate(`/invoices/${err.data.invoice.id}`);
        return;
      }
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size={size} onClick={create} disabled={busy || Boolean(disabledReason)} title={disabledReason || undefined}>
        {busy ? <Spinner className="h-4 w-4 text-current" /> : <DollarIcon />}
        {busy ? "Creating…" : "Create invoice"}
      </Button>
      {disabledReason && <p className="text-xs text-muted">{disabledReason}</p>}
      <ErrorMessage error={error} />
    </div>
  );
}
