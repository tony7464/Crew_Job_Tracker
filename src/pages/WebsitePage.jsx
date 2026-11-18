import { Puck } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiUrl } from "../api";
import ConfirmDelete from "../components/ConfirmDelete";
import ErrorMessage from "../components/ErrorMessage";
import { Checkbox, FormActions, Input, Select, TextArea } from "../components/Field";
import Loading from "../components/Loading";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Feedback";
import { ChevronLeftIcon, ExternalIcon, ImageIcon, PlusIcon, SettingsIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { buttonClass } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import PhotoLibrary from "../site/PhotoLibrary";
import { buildConfig } from "../site/puckConfig";
import { PhotosContext, SiteContext, usePhotos } from "../site/SiteContext";
import { DEFAULT_COLOR, FONTS, isAppName, photoPath, slugProblem, starterPages, typedSlug, upgradePage, withDefaults } from "../site/siteUtils";

// The part of a page's data that is saved. Compared as text to tell a real change from the
// editor tidying what it was given.
function snapshot(data) {
  return JSON.stringify({ content: data?.content || [], root: data?.root || { props: {} } });
}

function fieldError(error, key) {
  const found = error?.data?.errors?.[key];
  return found ? [].concat(found)[0] : undefined;
}

// A box for a site's or a page's address. What is typed is tidied as it is typed (lower
// case, a hyphen for a space), and the cursor stays where it was, so a letter typed in
// the middle is followed by the next one.
function AddressInput({ value, onValue, ...props }) {
  const box = useRef(null);
  const caret = useRef(null);

  useLayoutEffect(() => {
    if (caret.current !== null) box.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  return (
    <Input
      {...props}
      ref={box}
      value={value}
      maxLength={40}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onChange={(event) => {
        const { value: typed, selectionStart } = event.target;
        const tidied = typedSlug(typed);
        // Tidying puts the cursor at the end. Put it back after as much text as was before it.
        if (tidied !== typed && selectionStart !== null && selectionStart < typed.length) {
          caret.current = typedSlug(typed.slice(0, selectionStart)).length;
        }
        onValue(tidied);
      }}
    />
  );
}

// --- Starting a site ------------------------------------------------------------------

function StartSite({ suggested, businessName, onCreated }) {
  const [slug, setSlug] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problem = slugProblem(slug);

  async function start(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Every setting from the start, so saving the settings later without changing any is not a change.
      const body = { slug, settings: withDefaults({}, (businessName || "").slice(0, 80)), pages: starterPages(businessName) };
      onCreated((await api("/api/site", { method: "POST", body })).site);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <ChevronLeftIcon /> Back to the app
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-fg">Build your website</h1>
      <p className="mt-2 text-sm text-muted">
        You get a ready-made site with four pages: Home, Services, About, and Contact. Your services come from your price
        book and the buttons lead to your request form. Then drag blocks around and change the words until it is yours.
        Nothing is public until you press Publish.
      </p>
      <form onSubmit={start} className="mt-6 space-y-4">
        <AddressInput
          label="Your site's address"
          value={slug}
          onValue={setSlug}
          hint={`crewjobtrack.com/site/${slug || "your-name"}. You can change it later.`}
          error={fieldError(error, "slug") || (slug && problem) || undefined}
        />
        {error && !fieldError(error, "slug") && <ErrorMessage error={error} />}
        <Button type="submit" disabled={busy || Boolean(problem)}>
          {busy ? "Setting it up…" : "Start my website"}
        </Button>
      </form>
    </main>
  );
}

// --- Dialogs --------------------------------------------------------------------------

// Where the site is, as its owner would say it: "crewjobtrack.com/site/acme", or its own address.
function addressOf(site) {
  return site.url.replace(/^https?:\/\//, "");
}

// One DNS record for the owner to add: what kind, under what name, with what value.
function DnsRecord({ kind, name, value }) {
  return (
    <span className="mt-1 block rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-fg">
      <span className="block">Type: <strong>{kind}</strong></span>
      <span className="block [overflow-wrap:anywhere]">Name: <code>{name}</code></span>
      <span className="block [overflow-wrap:anywhere]">Value: <code>{value}</code></span>
    </span>
  );
}

function Mark({ done }) {
  if (done === true) return <span className="font-medium text-success">Found.</span>;
  if (done === false) return <span>Not found yet.</span>;
  return null;
}

// The site's own web address: asking for one, and what is left to do before it works.
function OwnAddress({ site, domain, onDomain, error }) {
  const [found, setFound] = useState(null);
  const [checking, setChecking] = useState(false);
  const asked = site.domain.name;
  const proof = site.domain.proof;

  async function check() {
    setChecking(true);
    try {
      const answer = await api("/api/site/domain/check");
      setFound({ points: answer.points_here, proved: answer.proved });
    } catch {
      setFound({ points: null, proved: null, failed: true });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <Input
        label="Your own web address (optional)"
        value={domain}
        onChange={(event) => onDomain(event.target.value)}
        maxLength={253}
        placeholder="www.yourbusiness.com"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        hint="An address you already own, from a company such as GoDaddy or Namecheap. Leave it empty to keep the address above."
        error={error}
      />
      {asked && proof && domain.trim().toLowerCase() === asked && (
        site.domain.connected ? (
          <p className="text-sm text-success">Connected. Your site is at {asked}, and the address above still works too.</p>
        ) : (
          <div className="space-y-2 text-sm text-muted">
            <p className="font-medium text-fg">Three steps are left before {asked} shows your site.</p>
            <p>Sign in to the company you got the address from, find its DNS records, and add these two:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                One that points the address at your site. <Mark done={found?.points} />
                <DnsRecord kind="CNAME" name={asked} value={site.domain.target} />
              </li>
              <li>
                One that shows the address is yours. <Mark done={found?.proved} />
                <DnsRecord kind="TXT" name={proof.name} value={proof.value} />
              </li>
              <li>We connect it on our side, usually within a business day. Until then your site stays at the address above.</li>
            </ol>
            <p className="text-xs">
              Many companies add your domain to the name themselves. There, type only the part in front of it: for www.acme.com that is{" "}
              <code>www</code> and <code>_crewjobtrack.www</code>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={check} disabled={checking}>{checking ? "Checking…" : "Check my records"}</Button>
              {found?.failed && <span>They could not be checked just now. Try again in a minute.</span>}
              {found?.points && found?.proved && <span className="text-success">Both are in place. We will connect it shortly.</span>}
              {found && !found.failed && !(found.points && found.proved) && <span>A new record can take a few hours to show.</span>}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function SiteSettingsDialog({ site, businessName, onSaved, onDeleted, onClose }) {
  const start = withDefaults(site.settings, businessName);
  const photos = usePhotos();
  const [values, setValues] = useState(start);
  const [slug, setSlug] = useState(site.slug);
  const [domain, setDomain] = useState(site.domain.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const toggle = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.checked }));
  const settingsErrors = error?.data?.errors || {};

  // Choosing what the header button does also gives it words that fit, unless the owner wrote their own.
  const setCta = (event) => {
    const cta = event.target.value;
    setValues((current) => {
      const own = current.cta_label && !Object.values(CTA_WORDS).includes(current.cta_label);
      return { ...current, cta, cta_label: own || !CTA_WORDS[cta] ? current.cta_label : CTA_WORDS[cta] };
    });
  };

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Only what changed: settings sent again unchanged would still count as a change to publish.
      const body = {};
      if (slug !== site.slug) body.slug = slug;
      if (JSON.stringify(values) !== JSON.stringify(start)) body.settings = values;
      if (domain.trim() !== site.domain.name) body.domain = domain.trim();
      if (Object.keys(body).length) onSaved((await api("/api/site", { method: "PATCH", body })).site);
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const hasLogo = Boolean(values.logo && photos.images.some((image) => image.id === values.logo));

  async function pickLogo() {
    const picked = await photos.choose({ several: false });
    if (picked?.length) setValues((current) => ({ ...current, logo: picked[0] }));
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      onSaved((await api("/api/site/unpublish", { method: "POST" })).site);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Site settings" description="The look of the whole site, and what is in its header and footer." onClose={onClose} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Business name" value={values.name} onChange={set("name")} maxLength={80} error={[].concat(settingsErrors.name || [])[0]} />
          <Input label="A line under the name (optional)" value={values.tagline} onChange={set("tagline")} maxLength={120} />
          <Input label="Phone" value={values.phone} onChange={set("phone")} maxLength={40} inputMode="tel" error={[].concat(settingsErrors.phone || [])[0]} />
          <Input label="Email" value={values.email} onChange={set("email")} maxLength={254} inputMode="email" error={[].concat(settingsErrors.email || [])[0]} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg">Your color</span>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(values.color) ? values.color : DEFAULT_COLOR}
              onChange={set("color")}
              className="h-10 w-full cursor-pointer rounded-lg border border-border-strong bg-surface p-1"
            />
          </label>
          <Select label="Lettering" value={values.font} onChange={set("font")}>
            {FONTS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Background" value={values.mode} onChange={set("mode")}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Button in the header" value={values.cta} onChange={setCta}>
            <option value="request">Request a quote form</option>
            <option value="call">Call us</option>
            <option value="none">No button</option>
          </Select>
          <Input label="Words on that button" value={values.cta_label} onChange={set("cta_label")} maxLength={40} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasLogo ? (
            <img src={apiUrl(photoPath(values.logo, "thumb"))} alt="" className="h-14 w-auto max-w-40 rounded-lg border border-border bg-surface-2 object-contain" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border-strong text-xs text-muted">None</span>
          )}
          <div>
            <p className="text-sm font-medium text-fg">Logo in the header (optional)</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={pickLogo}>{hasLogo ? "Change logo" : "Pick a logo"}</Button>
              {values.logo && <Button variant="ghost" size="sm" onClick={() => setValues((current) => ({ ...current, logo: "", logo_only: false }))}>Remove</Button>}
            </div>
          </div>
        </div>
        {hasLogo && (
          <Checkbox
            label="My logo already shows my business name"
            description="On: the header shows the logo alone, without the name in words beside it."
            checked={Boolean(values.logo_only)}
            onChange={toggle("logo_only")}
          />
        )}
        <Checkbox label="Show the phone number in the header" checked={Boolean(values.show_phone)} onChange={toggle("show_phone")} />
        <Checkbox
          label="Show prices from my price book"
          description="Off: the Services block lists names and descriptions only. On: anyone can see your prices."
          checked={Boolean(values.show_prices)}
          onChange={toggle("show_prices")}
        />
        <TextArea label="Words in the footer (optional)" value={values.footer_text} onChange={set("footer_text")} maxLength={300} rows={2} />
        <TextArea
          label="About your business, in a sentence or two (optional)"
          hint="Shown under your name in Google results, and when someone shares a link to your site."
          value={values.description}
          onChange={set("description")}
          maxLength={300}
          rows={2}
        />
        <AddressInput
          label="Site address"
          value={slug}
          onValue={setSlug}
          hint={`crewjobtrack.com/site/${slug}. Changing it breaks links to the old address.`}
          error={fieldError(error, "slug") || slugProblem(slug) || undefined}
        />
        {site.domain.available && <OwnAddress site={site} domain={domain} onDomain={setDomain} error={fieldError(error, "domain")} />}
        {error && !fieldError(error, "slug") && !fieldError(error, "domain") && <ErrorMessage error={error} />}
        <FormActions>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || Boolean(slugProblem(slug))}>{busy ? "Saving…" : "Save"}</Button>
        </FormActions>
      </form>
      <div className="mt-6 space-y-3 border-t border-border pt-4">
        {site.published && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">The site is live. Taking it down keeps everything you built.</p>
            <Button variant="secondary" size="sm" onClick={unpublish} disabled={busy}>Take the site down</Button>
          </div>
        )}
        {site.taken_down ? (
          <p className="text-sm text-muted">Support took this website down, so it cannot be published or deleted. Contact support to sort it out.</p>
        ) : (
          <ConfirmDelete
            label="Delete the website"
            description="Deletes every page of the website for good, and takes it down if it is live. This cannot be undone."
            onConfirm={async () => {
              await api("/api/site", { method: "DELETE" });
              onDeleted();
            }}
          />
        )}
      </div>
    </Modal>
  );
}

function PageDialog({ site, page, saveFirst, onChanged, onDelete, onClose }) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [inMenu, setInMenu] = useState(page.in_menu);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const index = site.pages.findIndex((entry) => entry.id === page.id);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const save = (event) => {
    event.preventDefault();
    run(async () => {
      // The page's own unsaved edits go first: a new address also re-points the buttons in the saved pages.
      if (!(await saveFirst())) throw new Error(UNSAVED);
      const body = { title, in_menu: inMenu, ...(page.is_home ? {} : { slug }) };
      await api(`/api/site/pages/${page.id}`, { method: "PATCH", body });
      await onChanged();
      onClose();
    });
  };

  // Swap this page with its neighbour in the menu. The home page stays first.
  const move = (step) =>
    run(async () => {
      if (!(await saveFirst())) throw new Error(UNSAVED);
      const ids = site.pages.map((entry) => entry.id);
      [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
      await api("/api/site/pages/order", { method: "PUT", body: { ids } });
      await onChanged();
    });

  return (
    <Modal title="Page settings" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Input label="Page name" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} required error={fieldError(error, "title")} />
        {page.is_home ? (
          <p className="text-sm text-muted">This is the home page: it is what people see at {addressOf(site)}.</p>
        ) : (
          <AddressInput
            label="Page address"
            value={slug}
            onValue={setSlug}
            hint={`${addressOf(site)}/${slug}. Buttons that go to this page follow it to a new address.`}
            error={fieldError(error, "slug") || slugProblem(slug) || undefined}
          />
        )}
        <Checkbox label="Show this page in the menu" checked={inMenu} onChange={(event) => setInMenu(event.target.checked)} />
        {!page.is_home && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Place in the menu</span>
            <Button variant="secondary" size="sm" disabled={busy || index <= 1} onClick={() => move(-1)}>Move earlier</Button>
            <Button variant="secondary" size="sm" disabled={busy || index >= site.pages.length - 1} onClick={() => move(1)}>Move later</Button>
          </div>
        )}
        {site.published && (
          <p className="text-sm text-muted">A new name, address, or place in the menu shows on your live site after you publish.</p>
        )}
        {error && !fieldError(error, "title") && !fieldError(error, "slug") && <ErrorMessage error={error} />}
        <FormActions>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || (!page.is_home && Boolean(slugProblem(slug)))}>{busy ? "Saving…" : "Save"}</Button>
        </FormActions>
      </form>
      {!page.is_home && (
        <div className="mt-6 border-t border-border pt-4">
          <ConfirmDelete
            label="Delete this page"
            description="Deletes the page for good. If the site is live, the page leaves it at once, and buttons that went to it are left out until you point them somewhere else."
            onConfirm={onDelete}
          />
        </div>
      )}
    </Modal>
  );
}

function AddPageDialog({ site, onAdded, onClose }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nameBox = useRef(null);

  // Opening a dialog puts the cursor on its close button; move it to the name once it is open.
  useEffect(() => {
    const frame = requestAnimationFrame(() => nameBox.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const page = await api("/api/site/pages", { method: "POST", body: { title: title.trim() } });
      await onAdded(page.id);
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a page" description={`A site can have up to ${site.max_pages} pages.`} onClose={onClose} size="sm">
      <form onSubmit={add} className="space-y-4">
        <Input
          label="Page name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={60}
          required
          ref={nameBox}
          placeholder="Gallery, Prices, Service area"
          error={fieldError(error, "title")}
        />
        {error && !fieldError(error, "title") && <ErrorMessage error={error} />}
        <FormActions>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? "Adding…" : "Add page"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}

// --- The editor -----------------------------------------------------------------------

const STATUS_TEXT = { saved: "All changes saved", unsaved: "Saving soon…", saving: "Saving…", error: "Could not save" };
const UNSAVED = "This page has changes that could not be saved. Sort that out first.";
const CTA_WORDS = { request: "Request a quote", call: "Call us" };
// For someone who may only look (an admin's support view): the editor shows the pages and changes nothing.
const LOOK_ONLY = { drag: false, duplicate: false, delete: false, edit: false, insert: false };

// The buttons in the editor's own top bar. The editor is given one component for them that
// never changes, so the buttons stay put while what they show (read from here) changes.
const ActionsContext = createContext(null);

function HeaderActions() {
  const { status, busy, site, lookOnly, preview, publish } = useContext(ActionsContext);
  return (
    <>
      <span className="hidden text-xs text-muted lg:inline" role="status">{STATUS_TEXT[status]}</span>
      <Button variant="secondary" size="sm" onClick={preview}>Preview</Button>
      <Button size="sm" onClick={publish} disabled={busy || site.taken_down || lookOnly}>
        {busy ? "Publishing…" : site.taken_down ? "Taken down" : site.published ? (site.has_changes ? "Publish changes" : "Published") : "Publish"}
      </Button>
    </>
  );
}

const EDITOR_PARTS = { headerActions: () => <HeaderActions /> };

function SiteEditor({ initial, businessName, lookOnly, onDeleted }) {
  const navigate = useNavigate();
  const [site, setSite] = useState(initial);
  const [pageId, setPageId] = useState(initial.pages[0].id);
  // The page's contents, kept with the page they belong to.
  const [loaded, setLoaded] = useState(null);
  // What the live site would have beside the pages: the request form link and the services.
  // null until they are known, so a button is not called "nowhere to go" while they load.
  const [extras, setExtras] = useState(null);
  // Counts up to load the page again and start the editor afresh on it.
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState("saved");
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [notice, setNotice] = useState(null);
  // The site's own photos, null until they are known. And the question "which photo?" a block or a
  // setting is waiting on: { several, answer }.
  const [library, setLibrary] = useState(null);
  const [picking, setPicking] = useState(null);
  // Edits that are not saved yet: the newest for each page, by the page's id. And the timer that will save them.
  const pending = useRef(new Map());
  const timer = useRef(null);
  // The page in the editor, and what the server holds for it (as text).
  const shown = useRef(null);
  const lastSaved = useRef(null);
  // The saves so far, one after another. sending: how many are on their way right now. landed: how many got there.
  const saving = useRef(Promise.resolve(true));
  const sending = useRef(0);
  const landed = useRef(0);
  // Whether the owner has left the editor, and how many more times to try a save after that.
  const gone = useRef(false);
  const lastTries = useRef(6);

  const page = site.pages.find((entry) => entry.id === pageId) || site.pages[0];

  const reloadSite = useCallback(async () => {
    const next = (await api("/api/site")).site;
    setSite(next);
    return next;
  }, []);

  const reloadExtras = useCallback(() => {
    api("/api/site/preview")
      .then((data) => setExtras({ request_url: data.site.request_url, services: data.site.services }))
      .catch(() => setExtras((current) => current || { request_url: null, services: [] }));
  }, []);

  useEffect(reloadExtras, [reloadExtras]);

  useEffect(() => {
    let cancelled = false;
    api("/api/site/images")
      .then((data) => !cancelled && setLibrary({ images: data.images, max: data.max_images, enabled: data.enabled }))
      .catch(() => !cancelled && setLibrary((current) => current || { images: [], max: 0, enabled: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  // Ask the owner for a photo (or several) from the site's photos. Answers their ids, or null.
  const choose = useCallback(
    ({ several = false } = {}) =>
      new Promise((answer) => {
        setPicking((current) => {
          // One question at a time: the one before goes unanswered.
          current?.answer(null);
          return { several, answer };
        });
      }),
    [],
  );
  const photos = useMemo(() => ({ images: library?.images || [], choose }), [library, choose]);
  const changeLibrary = useCallback((change) => setLibrary((current) => ({ ...current, images: change(current.images) })), []);

  useEffect(() => {
    let cancelled = false;
    api(`/api/site/pages/${page.id}`)
      .then((got) => {
        if (cancelled) return;
        // Blocks made before formatted text are brought up to date here, in the editor
        // only: the page is not saved (or shown as changed) until the owner edits it.
        const data = upgradePage(got.data);
        shown.current = page.id;
        lastSaved.current = snapshot(data);
        setLoaded({ id: page.id, data });
      })
      .catch((error) => !cancelled && setProblem(error.message));
    return () => {
      cancelled = true;
    };
  }, [page.id, version]);

  // Save what is waiting. Answers whether everything is saved. Saves go one at a time, in
  // order, so an older save can never land on top of a newer one.
  const flush = useCallback(function saveNow() {
    clearTimeout(timer.current);
    saving.current = saving.current.then(async () => {
      let lost = false;
      let tried = false;
      // Until nothing is waiting: an edit made while a save was on its way is saved too,
      // so "saved" means there is nothing left to lose.
      while (pending.current.size) {
        const [pageId, data] = pending.current.entries().next().value;
        pending.current.delete(pageId);
        sending.current += 1;
        tried = true;
        setStatus("saving");
        try {
          await api(`/api/site/pages/${pageId}`, { method: "PATCH", body: { data } });
          landed.current += 1;
          if (pageId === shown.current) lastSaved.current = snapshot(data);
          setSite((current) => ({
            ...current,
            has_changes: true,
            pages: current.pages.map((entry) => (entry.id === pageId ? { ...entry, changed: true } : entry)),
          }));
          setProblem(null);
        } catch (error) {
          const why = error.data?.errors?.data?.[0] || error.message;
          setStatus("error");
          if (error.status === 403 || error.status === 404) {
            // It can never be saved from here (someone who may only look, or the page is
            // gone): let it go and say so, instead of holding them on the page for good.
            lost = true;
            setProblem(`Your last change was not saved. ${why}`);
            continue;
          }
          // Keep it to try again, unless something newer for that page is already waiting.
          if (!pending.current.has(pageId)) pending.current.set(pageId, data);
          setProblem(`Your last changes are not saved. ${why}`);
          // The server could not be reached: try again shortly, and for half a minute more
          // if the owner has left the editor. A page the server refused waits for the owner
          // to change it.
          if (!error.status || error.status >= 500) {
            if (gone.current) lastTries.current -= 1;
            if (!gone.current || lastTries.current > 0) timer.current = setTimeout(saveNow, 5000);
          }
          return false;
        } finally {
          sending.current -= 1;
        }
      }
      if (tried) setStatus(lost ? "error" : "saved");
      return true;
    });
    return saving.current;
  }, []);

  // Drop a page's unsaved edit and let any save on its way finish: for a page about to be deleted.
  const discard = useCallback(async (id) => {
    pending.current.delete(id);
    await saving.current;
    pending.current.delete(id);
    if (!pending.current.size) {
      clearTimeout(timer.current);
      setStatus("saved");
      setProblem(null);
    }
  }, []);

  // Where each photo is used changes as pages are saved, so it is asked for again whenever
  // the site's photos are opened (once what is waiting has been saved): the "in use" mark
  // and the warning before a delete are then about the pages as they are now.
  const photosOpen = dialog === "photos" || Boolean(picking);
  useEffect(() => {
    if (!photosOpen) return undefined;
    let cancelled = false;
    flush()
      .then(() => api("/api/site/images"))
      .then((data) => {
        if (cancelled) return;
        const used = new Map(data.images.map((image) => [image.id, image.used_on]));
        // Only where they are used: photos added or deleted here meanwhile stay as they are.
        setLibrary((current) => current && { ...current, images: current.images.map((image) => (used.has(image.id) ? { ...image, used_on: used.get(image.id) } : image)) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photosOpen, flush]);

  // Load the page again and start the editor afresh on it, after something outside the
  // editor changed what it shows (the page's name or address, the menu).
  const restartEditor = useCallback(() => {
    setLoaded(null);
    setVersion((value) => value + 1);
  }, []);

  const handleChange = useCallback(
    (data) => {
      // The editor reports when it tidies the data it was given. That is not a change to
      // save. While a save is on its way it may be a real one all the same: an undo back
      // to what the server held before that save. Then it is saved again.
      if (snapshot(data) === lastSaved.current && !pending.current.has(page.id) && !sending.current) return;
      pending.current.set(page.id, { content: data.content, root: data.root });
      setStatus("unsaved");
      // "Published" was true of what came before this change.
      setNotice(null);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1200);
    },
    [page.id, flush],
  );

  // Leaving with something unsaved: save it, and warn if the tab is closing first.
  useEffect(() => {
    gone.current = false;
    const warn = (event) => {
      if (pending.current.size || sending.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flush();
      gone.current = true;
    };
  }, [flush]);

  // While a dialog is open, undo and redo belong to its text boxes. The editor listens for
  // those keys on the whole page, and would undo the owner's work behind the dialog instead.
  const dialogOpen = Boolean(dialog || picking);
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const keepFromEditor = (event) => {
      if ((event.ctrlKey || event.metaKey) && ["KeyZ", "KeyY", "KeyI"].includes(event.code)) event.stopPropagation();
    };
    window.addEventListener("keydown", keepFromEditor, true);
    return () => window.removeEventListener("keydown", keepFromEditor, true);
  }, [dialogOpen]);

  // Back to the app: only once everything is saved, like going to another page.
  async function leave(event) {
    if (!pending.current.size && !sending.current) return;
    event.preventDefault();
    if (await flush()) navigate("/dashboard");
  }

  // Another page: only once this one is saved, so nothing typed here is lost on the way.
  async function choosePage(id) {
    if (id === page.id) return;
    if (!(await flush())) return;
    setLoaded(null);
    setPageId(id);
  }

  async function publish() {
    setBusy(true);
    setNotice(null);
    try {
      if (!(await flush())) return;
      setProblem(null);
      const before = landed.current;
      setSite((await api("/api/site/publish", { method: "POST" })).site);
      setNotice("Published. Your site is live.");
      // A change saved while the publish was on its way is not part of it: ask again, so the button says so.
      if (landed.current !== before) await reloadSite();
    } catch (error) {
      setProblem(error.message);
      // If support took the site down meanwhile, show that.
      if (error.data?.code === "site_taken_down") reloadSite().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    const path = `/website/preview${page.slug ? `/${page.slug}` : ""}`;
    // A new tab, opened at the click (which browsers allow) and pointed at the preview once the page is saved.
    const tab = window.open("about:blank", "_blank");
    const saved = await flush();
    if (!saved) {
      tab?.close();
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.replace(new URL(path, window.location.origin).href);
    } else {
      // The browser would not open a tab: show the preview here. It has a link back to the editor.
      navigate(path);
    }
  }

  const context = useMemo(
    () => ({
      editing: true,
      site: {
        slug: site.slug,
        name: site.settings.name || businessName || "",
        settings: withDefaults(site.settings, businessName),
        pages: site.pages.map(({ slug, title, in_menu }) => ({ slug, title, in_menu })),
        request_url: extras?.request_url || null,
        services: extras?.services || [],
        images: Object.fromEntries((library?.images || []).map((image) => [image.id, { width: image.width, height: image.height }])),
      },
    }),
    [site, extras, businessName, library],
  );
  const config = useMemo(() => buildConfig({ pages: site.pages, current: page.slug, lookOnly }), [site.pages, page.slug, lookOnly]);
  const ready = loaded?.id === page.id && extras !== null && library !== null;

  return (
    <PhotosContext.Provider value={photos}>
    <div className="flex h-dvh flex-col bg-bg">
      <div className="flex min-h-13 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Link to="/dashboard" onClick={leave} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
          <ChevronLeftIcon /> App
        </Link>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only sm:not-sr-only sm:text-muted">Page</span>
          <select value={page.id} onChange={(event) => choosePage(Number(event.target.value))} className="field-sm max-w-44">
            {site.pages.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
                {entry.in_menu ? "" : " (not in menu)"}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" size="sm" onClick={() => setDialog("page")}>Page settings</Button>
        <Button variant="ghost" size="sm" onClick={() => setDialog("add")} disabled={site.pages.length >= site.max_pages}>
          <PlusIcon /> Add page
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDialog("photos")} disabled={library === null}>
          <ImageIcon className="h-4 w-4" /> Photos
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDialog("site")} disabled={library === null}>
          <SettingsIcon className="h-4 w-4" /> Site settings
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted">
          {site.published ? (
            <a href={site.url} target="_blank" rel="noreferrer" className={buttonClass({ variant: "ghost", size: "sm" })}>
              <ExternalIcon /> {addressOf(site)}
            </a>
          ) : (
            <span>Not published yet</span>
          )}
        </span>
      </div>
      {(problem || notice || site.taken_down) && (
        <div className="space-y-2 px-3 pt-2">
          {site.taken_down && (
            <Alert tone="warning">
              Support took this website down. You can keep working on it, but it cannot be published until support allows it again.
            </Alert>
          )}
          {problem && <Alert tone="danger">{problem}</Alert>}
          {notice && !problem && <Alert tone="success">{notice}</Alert>}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {ready ? (
          <SiteContext.Provider value={context}>
            <ActionsContext.Provider value={{ status, busy, site, lookOnly, preview, publish }}>
              <Puck
                key={`${page.id}:${version}`}
                config={config}
                data={loaded.data}
                onChange={handleChange}
                headerTitle={page.title}
                height="100%"
                overrides={EDITOR_PARTS}
                permissions={lookOnly ? LOOK_ONLY : undefined}
              />
            </ActionsContext.Provider>
          </SiteContext.Provider>
        ) : (
          <Loading label="Loading the page…" />
        )}
      </div>

      {dialog === "site" && (
        <SiteSettingsDialog
          site={site}
          businessName={businessName}
          onSaved={(next) => {
            setNotice(null);
            setSite(next);
            reloadExtras();
          }}
          onDeleted={onDeleted}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "page" && (
        <PageDialog
          site={site}
          page={page}
          saveFirst={flush}
          onChanged={async () => {
            setNotice(null);
            await reloadSite();
            restartEditor();
          }}
          onDelete={async () => {
            // The page's unsaved edit goes with it. If the delete does not happen, it comes back to be saved.
            const unsaved = pending.current.get(page.id);
            await discard(page.id);
            try {
              await api(`/api/site/pages/${page.id}`, { method: "DELETE" });
            } catch (error) {
              if (unsaved && !pending.current.has(page.id)) {
                pending.current.set(page.id, unsaved);
                setStatus("unsaved");
                timer.current = setTimeout(flush, 1200);
              }
              throw error;
            }
            const next = await reloadSite();
            setDialog(null);
            setLoaded(null);
            setPageId(next.pages[0].id);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "add" && (
        <AddPageDialog
          site={site}
          onAdded={async (id) => {
            await reloadSite();
            // Go to the new page once this one is saved; otherwise stay, with the problem shown.
            if (!(await flush())) return;
            setLoaded(null);
            setPageId(id);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "photos" && library && (
        <PhotoLibrary library={library} onLibrary={changeLibrary} lookOnly={lookOnly} onClose={() => setDialog(null)} />
      )}
      {/* Last, so it opens over a dialog that asked for a photo (the site's settings, for the logo). */}
      {picking && library && (
        <PhotoLibrary
          library={library}
          onLibrary={changeLibrary}
          choosing={picking}
          lookOnly={lookOnly}
          onChoose={(ids) => {
            picking.answer(ids);
            setPicking(null);
          }}
          onClose={() => {
            picking.answer(null);
            setPicking(null);
          }}
        />
      )}
    </div>
    </PhotosContext.Provider>
  );
}

// The owner's website: start one, then build it in the drag-and-drop editor.
export default function WebsitePage() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api("/api/site")
      .then((data) => !cancelled && setState({ round, ...data }))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [round]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <ErrorMessage error={error} />
      </main>
    );
  }
  if (!state || state.round !== round) return <Loading label="Loading your website…" />;
  // A site with no name of its own goes by the business's, unless that reads as the app's own name.
  const businessName = isAppName(user.business_name) ? "" : user.business_name;
  if (!state.site) {
    return <StartSite suggested={state.suggested_slug} businessName={businessName} onCreated={(site) => setState({ round, site })} />;
  }
  return (
    <SiteEditor
      key={state.site.slug + round}
      initial={state.site}
      businessName={businessName}
      lookOnly={Boolean(user.support_view)}
      onDeleted={() => setRound((value) => value + 1)}
    />
  );
}
