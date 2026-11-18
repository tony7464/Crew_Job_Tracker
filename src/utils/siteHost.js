// A business's website can live on a web address of its own, such as www.acmewindows.com.
// The server marks the page it sends there with <meta name="site-host" content="<site>">
// (server/routes/site_pages.py). On such an address this app is that one website and
// nothing else: no login, no menu, and the API is on the same address.

// The site's name when this page is on a business's own address, or null on the app's.
export function siteHost() {
  if (typeof document === "undefined") return null;
  const name = document.querySelector('meta[name="site-host"]')?.getAttribute("content") || "";
  return /^[a-z0-9-]{1,60}$/.test(name) ? name : null;
}
