import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiUrl } from "../api";
import Loading from "../components/Loading";
import SiteView from "../site/SiteView";

// A business's website as visitors see it: /site/<site> is the home page and
// /site/<site>/<page> the others. preview: the owner's drafts, before publishing.
// host: the site's name when this is the business's own web address (utils/siteHost.js),
// where the home page is / and the others /<page>.
// missing: an address the site cannot have a page at (deeper than /<page>), so none is asked for.
export default function PublicSitePage({ preview = false, host = null, missing = false }) {
  const params = useParams();
  const slug = host || params.slug;
  const page = params.page || "";
  const path = preview
    ? `/api/site/preview${page ? `?page=${encodeURIComponent(page)}` : ""}`
    : `/api/public/sites/${encodeURIComponent(slug)}${page ? `?page=${encodeURIComponent(page)}` : ""}`;
  // What was loaded, kept with the address it is for, so one page never shows under another's address.
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (missing) return undefined;
    let cancelled = false;
    api(path, { skipAuth: !preview })
      .then((data) => !cancelled && setLoaded({ path, data }))
      .catch((error) => !cancelled && setLoaded({ path, error }));
    return () => {
      cancelled = true;
    };
  }, [path, preview, missing]);

  const current = missing ? { path, error: { status: 404 } } : loaded?.path === path ? loaded : null;
  const data = current?.data;

  useEffect(() => {
    if (!data) return undefined;
    const before = document.title;
    // The same as the server writes: the page's name beside the business's, each only if there is one.
    document.title = data.page.slug ? [data.page.title, data.site.name].filter(Boolean).join(" · ") : data.site.name || data.page.title;
    // The page's own address and words for search engines, in place of the app's. The
    // server writes the same into the page it sends first (routes/site_pages.py); this
    // keeps them right as a visitor goes from page to page.
    const canonical = preview ? null : document.querySelector('link[rel="canonical"]');
    const home = canonical?.getAttribute("href");
    const address = data.site.url || `${window.location.origin}/site/${data.site.slug}`;
    canonical?.setAttribute("href", data.page.slug ? `${address}/${data.page.slug}` : address);
    const about = preview ? null : document.querySelector('meta[name="description"]');
    const words = about?.getAttribute("content");
    if (data.page.description) about?.setAttribute("content", data.page.description);
    // The business's icon in the browser tab, in place of the app's.
    const icon = preview ? null : document.querySelector('link[rel="icon"]');
    const appIcon = icon?.getAttribute("href");
    icon?.setAttribute("href", apiUrl(`/api/public/sites/${data.site.slug}/icon.png`));
    return () => {
      document.title = before;
      if (home) canonical.setAttribute("href", home);
      if (words) about.setAttribute("content", words);
      if (appIcon) icon.setAttribute("href", appIcon);
    };
  }, [data, preview]);

  if (!current) return <Loading label="Loading…" />;
  if (current.error) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-fg">This page is not here</h1>
        <p className="mt-2 text-sm text-muted">
          {current.error.status === 404 ? "The website may have been taken down, or the address may be mistyped." : current.error.message}
        </p>
        {preview && (
          <Link to="/website" className="link mt-4 inline-block text-sm">
            Back to the editor
          </Link>
        )}
      </main>
    );
  }

  // In a preview the pages are the owner's drafts, so its links stay inside the preview.
  // On the business's own address the pages are at the top: / and /<page>.
  const site = preview ? { ...data.site, base: "/website/preview" } : host ? { ...data.site, base: "" } : data.site;
  return (
    <>
      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-warning-soft px-4 py-2 text-sm text-warning-soft-fg">
          <span>This is a preview of your drafts. Visitors see the published site.</span>
          <Link to="/website" className="font-semibold underline">
            Back to the editor
          </Link>
        </div>
      )}
      <SiteView site={site} page={data.page} />
    </>
  );
}
