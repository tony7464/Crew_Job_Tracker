import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { formatWhen } from "../utils/admin";
import { inSupportView } from "../utils/roles";
import { Button } from "./ui/Button";
import { AlertIcon } from "./ui/Icons";

// Shown on every page while an admin is looking at a business as its owner does.
// It says whose business this is, that nothing can be changed, and how to leave.
export default function SupportViewBanner() {
  const { user, endSupportView } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!inSupportView(user)) return null;

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      await endSupportView();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const until = formatWhen(user.support_view.until);
  return (
    <div role="status" className="border-b border-warning/40 bg-warning-soft text-warning-soft-fg">
      {/* On phones the button sits under the words; from sm up, beside them. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0">
            <span className="font-semibold">Support view.</span> You are looking at{" "}
            <span className="font-semibold">{user.business_name || "this business"}</span> as its owner sees it.
            Nothing can be changed or sent.{until && ` The owner allowed this until ${until}.`}
            {error && <span className="block font-medium">{error.message}</span>}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0 self-start sm:self-auto" onClick={leave} disabled={busy}>
          {busy ? "Leaving…" : "Leave support view"}
        </Button>
      </div>
    </div>
  );
}
