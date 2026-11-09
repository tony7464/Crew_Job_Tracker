import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { companyRoleName, usableCompanies } from "../utils/roles";
import { ChevronDownIcon, CheckIcon } from "./ui/Icons";
import { cx } from "./ui/styles";


function CompanyRow({ company, busy, onPick }) {
  return (
    <button
      type="button"
      disabled={busy || company.current}
      onClick={() => onPick(company)}
      className={cx(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
        company.current ? "bg-primary-soft text-primary-soft-fg" : "text-fg hover:bg-surface-2",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{company.business_name}</span>
        <span className="block text-xs text-muted">{companyRoleName(company.role)}</span>
      </span>
      {company.current && <CheckIcon className="h-4 w-4 shrink-0" />}
    </button>
  );
}

// The list of companies with a switch on each, shared by the top bar menu and the phone menu.
export function CompanyList({ onDone }) {
  const { user, switchCompany } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(company) {
    setBusy(true);
    setError("");
    try {
      await switchCompany(company.id);
      onDone?.();
    } catch (err) {
      setError(err.message || "Could not switch companies.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-0.5">
      {usableCompanies(user).map((company) => (
        <CompanyRow key={company.id} company={company} busy={busy} onPick={pick} />
      ))}
      {error && <p role="alert" className="px-3 py-1 text-xs text-danger">{error}</p>}
      <Link
        to="/account#companies"
        onClick={onDone}
        className="block rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-surface-2"
      >
        Join or start a company
      </Link>
    </div>
  );
}

// Top bar: the company you are working in, with a menu to switch. Only shown with two or more.
export default function CompanySwitcher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const companies = usableCompanies(user);
  if (companies.length < 2) return null;
  const current = companies.find((company) => company.current);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        title="Switch company"
        className="inline-flex h-9 max-w-44 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-medium text-fg hover:bg-surface-2"
      >
        <span className="truncate">{current?.business_name || "Company"}</span>
        <ChevronDownIcon className={cx("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-border bg-surface p-1 shadow-pop">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Switch company</p>
          <CompanyList onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
