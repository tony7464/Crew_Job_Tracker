import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ThemeContext } from "./useTheme";

// Must match the inline script in index.html.
const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLORS = { light: "#f5f6f8", dark: "#0c1018" };

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function subscribeToSystem(callback) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

// Follows the system setting until the person picks light or dark, then remembers it.
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemDark = useSyncExternalStore(subscribeToSystem, systemPrefersDark, () => false);
  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage; the choice still applies until reload.
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [setPreference, theme]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
