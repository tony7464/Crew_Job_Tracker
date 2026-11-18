import { useCallback, useEffect, useRef, useState } from "react";
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

  // The user as of the last render, for handlers that outlive it.
  const current = useRef(null);
  useEffect(() => {
    current.current = user;
  }, [user]);

  // Re-read the session, for example after the owner changes this person's access.
  // Returns who it found (null when logged out).
  const refresh = useCallback(async () => {
    const next = await api("/api/check_session", { skipAuth: true }).catch(() => null);
    setUser(next);
    return next;
  }, []);

  // Remember on this device whether someone is signed in (see signedIn.js).
  useEffect(() => {
    if (!loading) rememberSignedIn(Boolean(user));
  }, [user, loading]);

  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
    setOnForbidden(async () => {
      const wasLooking = Boolean(current.current?.support_view);
      const next = await refresh();
      // A support view that the owner ended: leave the business's pages for the admin's own.
      if (wasLooking && next && !next.support_view) window.location.assign("/admin");
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

  // An admin starts looking at a business as its owner does (read-only), or stops. Both
  // reload, so nothing from one account is left on screen in the other.
  async function startSupportView(businessId) {
    await api(`/api/admin/businesses/${businessId}/support_view`, { method: "POST" });
    window.location.assign("/dashboard");
  }

  async function endSupportView() {
    const businessId = user?.support_view ? user.id : null;
    await api("/api/support_view", { method: "DELETE" });
    window.location.assign(businessId ? `/admin/businesses/${businessId}` : "/admin");
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
        startSupportView,
        endSupportView,
        verification,
        setVerification,
        resendVerification,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
