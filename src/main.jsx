import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { reloadForNewVersion } from "./utils/chunkReload";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./index.css";

// Vite fires this when a page's file cannot be loaded, which after a deploy means the tab
// is on an old version. Reload once; if that was already tried, let the error reach the
// ErrorBoundary, which explains and offers a Reload button.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
