// Whether someone was signed in on this device last time, so a returning user is not
// shown the landing page while their session is checked. Storage can be off (private
// browsing): then everyone is treated as a new visitor.
const KEY = "cjt:signedIn";

export function wasSignedIn() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberSignedIn(signedIn) {
  try {
    if (signedIn) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered; the landing page then shows for a moment before the redirect.
  }
}
