import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="font-semibold text-sky-800">
          Crew Job Tracker
        </Link>
        {!loading && (
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link to="/clients" className="hover:underline">
                  Clients
                </Link>
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
