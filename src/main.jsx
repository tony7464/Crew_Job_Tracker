import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import HostSite from "./site/HostSite";
import { reloadForNewVersion } from "./utils/chunkReload";
import { siteHost } from "./utils/siteHost";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./index.css";

// Vite fires this when a page's file cannot be loaded, which after a deploy means the tab
// is on an old version. Reload once; if that was already tried, let the error reach the
// ErrorBoundary, which explains and offers a Reload button.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// On a business's own web address this is that business's website and nothing else:
// no login, no session check, none of the app's pages.
const host = siteHost();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary plain={Boolean(host)}>
      {host ? (
        <BrowserRouter>
          <HostSite site={host} />
        </BrowserRouter>
      ) : (
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
