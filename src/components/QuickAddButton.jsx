import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { hasClientAccess } from "../utils/roles";
import { PlusIcon } from "./ui/Icons";

// List pages where the button shows. Forms and detail pages have their own actions.
const PAGES = new Set(["/dashboard", "/schedule", "/jobs", "/clients", "/requests", "/quotes", "/my-jobs", "/calendar"]);

// "New quote" on phones, for the owner and leads: books an estimate visit (NewVisitPage).
// Wider screens have the button in the page headers instead.
export default function QuickAddButton() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!hasClientAccess(user) || !PAGES.has(pathname)) return null;
  return (
    <Link
      to="/visits/new"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-base font-semibold text-primary-fg shadow-glow transition active:scale-95 sm:hidden"
    >
      <PlusIcon className="h-5 w-5" />
      New quote
    </Link>
  );
}
