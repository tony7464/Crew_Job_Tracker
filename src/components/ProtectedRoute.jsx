import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { canVisit, homePath } from "../utils/roles";
import Loading from "./Loading";

// allow: "owner", "employee", "clients", or omitted for any logged-in user.
// The server enforces the same rules; this only keeps people off pages that would 403.
export default function ProtectedRoute({ allow, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!canVisit(user, allow)) return <Navigate to={homePath(user)} replace />;
  return children;
}
