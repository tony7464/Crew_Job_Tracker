import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

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
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => (isActive ? "font-medium text-sky-800" : "hover:underline")}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/jobs"
                  className={({ isActive }) => (isActive ? "font-medium text-sky-800" : "hover:underline")}
                >
                  Jobs
                </NavLink>
                <NavLink
                  to="/clients"
                  className={({ isActive }) => (isActive ? "font-medium text-sky-800" : "hover:underline")}
                >
                  Clients
                </NavLink>
                <span className="text-slate-500">{user.username}</span>
                <button type="button" onClick={handleLogout} className="hover:underline">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:underline">
                  Log in
                </Link>
                <Link to="/signup" className="hover:underline">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
