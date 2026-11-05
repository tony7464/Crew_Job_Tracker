import { createContext, useContext } from "react";

// { preference: "light" | "dark" | "system", theme: "light" | "dark", setPreference, toggle }
export const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}
