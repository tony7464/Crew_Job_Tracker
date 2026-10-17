import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/jobs", "Jobs"],
  ["/clients", "Clients"],
];

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const itemClass = ({ isActive }) => (isActive ? "font-medium text-sky-800" : "hover:underline");

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="font-semibold text-sky-800">
          Crew Job Tracker
        </Link>
        {!loading && (
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {user ? (
              <>
                {LINKS.map(([to, label]) => (
                  <NavLink key={to} to={to} className={itemClass}>
                    {label}
                  </NavLink>
                ))}
                <span className="text-slate-500">{user.username}</span>
                <button type="button" onClick={handleLogout} className="hover:underline">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:underline">Log in</Link>
                <Link to="/signup" className="hover:underline">Sign up</Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
