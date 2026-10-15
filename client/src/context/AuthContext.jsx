import { useEffect, useState } from "react";
import { api, setOnUnauthorized } from "../api";
import { AuthContext } from "./context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
    api("/api/check_session")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function signup(body) {
    const next = await api("/api/signup", { method: "POST", body, skipAuth: true });
    setUser(next);
    return next;
  }

  async function login(body) {
    const next = await api("/api/login", { method: "POST", body, skipAuth: true });
    setUser(next);
    return next;
  }

  async function logout() {
    await api("/api/logout", { method: "DELETE" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
