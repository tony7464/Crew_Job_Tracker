import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useUnreadRequests } from "../hooks";
import { canSeeRequests, canSeeTeamSchedule, hasClientAccess, isOwner } from "../utils/roles";
import ThemeToggle from "./ThemeToggle";
import { Avatar } from "./ui/Avatar";
import { ButtonLink } from "./ui/Button";
import { BriefcaseIcon, ChevronDownIcon, LogOutIcon, MenuIcon, SettingsIcon, XIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

const OWNER_LINKS = [
  ["/dashboard", "Dashboard"],
  ["/schedule", "Schedule"],
  ["/jobs", "Jobs"],
  ["/clients", "Clients"],
  ["/requests", "Requests"],
  ["/quotes", "Quotes"],
  ["/invoices", "Invoices"],
  ["/employees", "Employees"],
];

// The owner's top bar has no room for every link, so these two share a Billing
// menu there. The phone menu lists them as plain links.
const BILLING_LINKS = new Set(["/quotes", "/invoices"]);

// Settings sits beside the account link on wide screens, and in the phone menu.
const SETTINGS_LINK = ["/settings", "Settings"];

function linksFor(user) {
  if (isOwner(user)) return OWNER_LINKS;
  return [
    ["/my-jobs", "My jobs"],
    ["/calendar", "Calendar"],
    ...(canSeeTeamSchedule(user) ? [["/schedule", "Team schedule"]] : []),
    ...(hasClientAccess(user) ? [["/clients", "Clients"]] : []),
    ...(canSeeRequests(user) ? [["/requests", "Requests"]] : []),
  ];
}

// The unread count beside Requests. Hidden at 0; "99+" past 99.
function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-fg">
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">, {count} new</span>
    </span>
  );
}

function LinkLabel({ to, label, unread }) {
  return (
    <span className="inline-flex items-center">
      {label}
      {to === "/requests" && <UnreadBadge count={unread} />}
    </span>
  );
}

// A small dropdown with the billing links, in the top bar.
function BillingMenu({ links, linkClass, pathname }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = links.some(([to]) => pathname === to || pathname.startsWith(`${to}/`));

  // Close on a click outside or Escape.
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className={cx(linkClass({ isActive: active }), "inline-flex items-center gap-1")}
      >
        Billing
        <ChevronDownIcon className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-44 rounded-xl border border-border bg-surface p-1 shadow-pop">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  "block rounded-lg px-3 py-2 text-sm font-medium",
                  isActive ? "bg-primary-soft text-primary-soft-fg" : "text-fg hover:bg-surface-2",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function roleLabel(user) {
  return isOwner(user) ? "Business owner" : "Crew member";
}

// compact hides the name on phones, where the logged-out buttons need the room.
// tight hides it until wide screens, where the menu needs the room.
function Brand({ compact, tight }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight text-fg">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-card">
        <BriefcaseIcon className="h-[18px] w-[18px]" />
      </span>
      <span className={compact ? "hidden sm:inline" : tight ? "md:hidden xl:inline" : undefined}>
        Crew Job Tracker
      </span>
    </Link>
  );
}

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = useUnreadRequests(!loading && canSeeRequests(user), pathname);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate("/login");
  }

  const close = () => setMenuOpen(false);
  const desktopLink = ({ isActive }) =>
    cx(
      "rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors lg:px-3 lg:text-sm",
      isActive ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
    );
  const mobileLink = ({ isActive }) =>
    cx(
      "block rounded-lg px-3 py-2.5 text-base font-medium",
      isActive ? "bg-primary-soft text-primary-soft-fg" : "text-fg hover:bg-surface-2",
    );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Brand compact={!user} tight={Boolean(user)} />
        {!loading && user && (
          <nav aria-label="Main" className="ml-1 hidden items-center gap-0.5 md:flex lg:ml-6 lg:gap-1">
            {linksFor(user).map(([to, label], index, links) => {
              const billing = links.filter(([path]) => BILLING_LINKS.has(path));
              if (billing.length > 1 && BILLING_LINKS.has(to)) {
                return to === billing[0][0] ? (
                  <BillingMenu key="billing" links={billing} linkClass={desktopLink} pathname={pathname} />
                ) : null;
              }
              return (
                <NavLink key={to} to={to} className={desktopLink}>
                  <LinkLabel to={to} label={label} unread={unread} />
                </NavLink>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {!loading && user && (
            <>
              {isOwner(user) && (
                <NavLink
                  to={SETTINGS_LINK[0]}
                  aria-label={SETTINGS_LINK[1]}
                  title={SETTINGS_LINK[1]}
                  className={({ isActive }) =>
                    cx(
                      "hidden h-9 w-9 items-center justify-center rounded-lg transition-colors md:inline-flex",
                      isActive ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )
                  }
                >
                  <SettingsIcon className="h-[18px] w-[18px]" />
                </NavLink>
              )}
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  cx(
                    "hidden items-center gap-2 rounded-lg p-1 text-sm font-medium transition-colors md:flex lg:pr-2.5",
                    isActive ? "bg-primary-soft text-primary-soft-fg" : "text-fg hover:bg-surface-2",
                  )
                }
              >
                <Avatar person={user} size="sm" />
                <span className="sr-only lg:not-sr-only lg:max-w-28 lg:truncate">{user.username}</span>
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out"
                className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg md:inline-flex"
              >
                <LogOutIcon />
                <span className="sr-only lg:not-sr-only">Log out</span>
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? "Close menu" : unread ? `Open menu, ${unread} new requests` : "Open menu"}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg hover:bg-surface-2 md:hidden"
              >
                {menuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                {!menuOpen && unread > 0 && (
                  <span aria-hidden="true" className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" />
                )}
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">Log in</ButtonLink>
              <ButtonLink to="/signup" size="sm">Sign up</ButtonLink>
            </>
          )}
        </div>
      </div>
      {menuOpen && user && (
        <div id="mobile-menu" className="border-t border-border bg-surface md:hidden">
          <nav aria-label="Main" className="mx-auto max-w-6xl space-y-1 px-4 py-3">
            {[...linksFor(user), ...(isOwner(user) ? [SETTINGS_LINK] : [])].map(([to, label]) => (
              <NavLink key={to} to={to} className={mobileLink} onClick={close}>
                <LinkLabel to={to} label={label} unread={unread} />
              </NavLink>
            ))}
            <div className="my-2 border-t border-border" />
            <NavLink to="/account" className={mobileLink} onClick={close}>
              <span className="flex items-center gap-3">
                <Avatar person={user} size="md" />
                <span>
                  <span className="block leading-tight">{user.username}</span>
                  <span className="block text-xs font-normal text-muted">{roleLabel(user)} · Account</span>
                </span>
              </span>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base font-medium text-fg hover:bg-surface-2"
            >
              <LogOutIcon className="h-5 w-5 text-muted" />
              Log out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
