import { useCallback, useEffect, useState } from "react";
import { api, setOnForbidden, setOnUnauthorized } from "../api";
import { homePath } from "../utils/roles";
import { rememberSignedIn } from "./signedIn";
import { AuthContext } from "./useAuth";

// user is the /api/check_session payload: id, username, name, role ("owner" or
// "employee"), companies (every company on this login: id, business_name, role,
// current, pending, usable), can_manage_clients, is_active, owner_id, timezone, email_verified,
// and business_email_verified (the owner's, which gates adding clients and jobs).
// verification is the last verification email's send result ({ email,
// email_delivery }) from signup, an email change, or Resend, so the banner can
// say honestly whether it was really emailed.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);

  // Re-read the session, for example after the owner changes this person's access.
  const refresh = useCallback(async () => {
    try {
      setUser(await api("/api/check_session", { skipAuth: true }));
    } catch {
      setUser(null);
    }
  }, []);

  // Remember on this device whether someone is signed in (see signedIn.js).
  useEffect(() => {
    if (!loading) rememberSignedIn(Boolean(user));
  }, [user, loading]);

  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
    setOnForbidden(() => {
      refresh();
    });
    api("/api/check_session", { skipAuth: true })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function signup(body) {
    const next = await api("/api/signup", { method: "POST", body, skipAuth: true });
    // Joining with a company code waits for the owner's OK: no session yet.
    if (next.pending) return next;
    setUser(next);
    setVerification(next.verification || null);
    return next;
  }

  async function login(body) {
    const next = await api("/api/login", { method: "POST", body, skipAuth: true });
    setUser(next);
    return next;
  }

  // Join a business from an emailed invite. The server logs the new employee in.
  async function acceptInvite(token, body) {
    const next = await api(`/api/public/invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body,
      skipAuth: true,
    });
    setUser(next);
    setVerification(null);
    return next;
  }

  // Work in another of your companies. Reload into its home page so nothing from the
  // company you left (lists, caches, open forms) is shown in the new one.
  async function switchCompany(id) {
    const next = await api(`/api/companies/${id}/switch`, { method: "POST" });
    window.location.assign(homePath(next));
    return next;
  }

  // Accept an emailed invite with the account you are logged in to; the server switches you to it.
  async function joinWithInvite(token) {
    const next = await api(`/api/invites/${encodeURIComponent(token)}/join`, { method: "POST" });
    setUser(next);
    return next;
  }

  async function resendVerification() {
    const result = await api("/api/me/email/resend-verification", { method: "POST" });
    setVerification(result);
    return result;
  }

  async function logout() {
    await api("/api/logout", { method: "DELETE" });
    setUser(null);
    setVerification(null);
  }

  return (
    <AuthContext.Provider value={{
        user,
        loading,
        signup,
        login,
        logout,
        refresh,
        acceptInvite,
        joinWithInvite,
        switchCompany,
        verification,
        setVerification,
        resendVerification,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
