import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contrast,
  isAppName,
  linkProblem,
  mailHref,
  pagePath,
  paragraphs,
  priceText,
  readableAs,
  readableOn,
  resolveLink,
  safeHref,
  slugProblem,
  slugify,
  starterPages,
  telHref,
  themeVars,
  typedSlug,
  webHref,
  withDefaults,
} from "../src/site/siteUtils.js";

test("only ordinary links are ever drawn", () => {
  for (const good of ["https://example.com/a?b=1#c", "http://example.com", "mailto:ann@example.com", "tel:+14025550101", " https://example.com "]) {
    assert.equal(safeHref(good), good.trim());
  }
  const bad = ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "/relative", "example.com", "https://exa mple.com", 'https://x.com/"on', `https://${"x".repeat(2000)}`, "", null, 5, undefined];
  for (const value of bad) assert.equal(safeHref(value), null, String(value));

  assert.equal(telHref("(402) 555-0101"), "tel:4025550101");
  assert.equal(telHref("+1 402 555 0101"), "tel:+14025550101");
  assert.equal(telHref("555"), null);
  assert.equal(telHref(""), null);
  // An extension stays in the words shown; the link dials the number alone.
  assert.equal(telHref("(402) 555-0101 x12"), "tel:4025550101");
  assert.equal(telHref("+44 20 7946 0958 X 12"), "tel:+442079460958");
  // Never two numbers run together, or more digits than a phone number has.
  assert.equal(telHref("402-555-0101 402-555-0102"), null);
  assert.equal(telHref("402+555+0101"), "tel:4025550101");
  assert.equal(mailHref(" ann@example.com "), "mailto:ann@example.com");
  for (const value of ["not an email", 'a"b@example.com', "a@b", "", null]) assert.equal(mailHref(value), null, String(value));
});

test("a button goes where its action says, or nowhere", () => {
  const site = {
    slug: "ann-co",
    pages: [
      { slug: "", title: "Home" },
      { slug: "about", title: "About" },
    ],
    request_url: "https://crewjobtrack.com/request/abc",
    settings: { phone: "(402) 555-0101", email: "ann@example.com" },
  };
  assert.deepEqual(resolveLink({ action: "request" }, site), { href: "https://crewjobtrack.com/request/abc", internal: false });
  assert.deepEqual(resolveLink({}, site), { href: "https://crewjobtrack.com/request/abc", internal: false });
  assert.deepEqual(resolveLink({ action: "call" }, site), { href: "tel:4025550101", internal: false });
  assert.deepEqual(resolveLink({ action: "email" }, site), { href: "mailto:ann@example.com", internal: false });
  assert.deepEqual(resolveLink({ action: "page", page: "about" }, site), { href: "/site/ann-co/about", internal: true });
  assert.deepEqual(resolveLink({ action: "page", page: "" }, site), { href: "/site/ann-co", internal: true });
  assert.deepEqual(resolveLink({ action: "link", href: "https://example.com" }, site), { href: "https://example.com", internal: false });
  // Nowhere to go: a page that is gone, a link that is not a link, no phone.
  assert.equal(resolveLink({ action: "page", page: "gone" }, site), null);
  assert.equal(resolveLink({ action: "link", href: "javascript:alert(1)" }, site), null);
  const bare = { ...site, request_url: null, settings: { phone: "", email: "" } };
  assert.equal(resolveLink({ action: "request" }, bare), null);
  assert.equal(resolveLink({ action: "call" }, bare), null);
  assert.equal(resolveLink({ action: "email" }, bare), null);
  // With no request form, a request button calls instead.
  assert.deepEqual(resolveLink({ action: "request" }, { ...site, request_url: null }), { href: "tel:4025550101", internal: false });
  // In the editor, a button with nowhere to go says what to do about it.
  assert.equal(linkProblem({ action: "request" }, site), null);
  assert.match(linkProblem({ action: "page", page: "gone" }, site), /page it went to is gone/);
  assert.match(linkProblem({ action: "link", href: "" }, site), /needs a web address/);
  assert.match(linkProblem({ action: "link", href: "example,com" }, site), /does not work/);
  // An address typed without https:// works, the way the server saves it.
  assert.deepEqual(resolveLink({ action: "link", href: " Example.com/prices " }, site), { href: "https://Example.com/prices", internal: false });
  assert.equal(webHref("www.example.co.uk"), "https://www.example.co.uk");
  for (const bad of ["javascript:alert(1)", "ann@example.com", "example", "example.com:8080", "//example.com", "https://", "", null]) {
    assert.equal(webHref(bad), null, String(bad));
  }
  assert.match(linkProblem({ action: "call" }, bare), /phone under Site settings/);
  assert.match(linkProblem({ action: "email" }, bare), /email under Site settings/);
  assert.match(linkProblem({}, bare), /request form/);
  assert.equal(pagePath({ slug: "ann-co" }, ""), "/site/ann-co");
  // The owner's preview keeps its links inside the preview.
  assert.equal(pagePath({ slug: "ann-co", base: "/website/preview" }, "about"), "/website/preview/about");
  assert.deepEqual(resolveLink({ action: "page", page: "" }, { ...site, base: "/website/preview" }), { href: "/website/preview", internal: true });
});

test("a site's look comes from its settings, with sensible defaults", () => {
  const defaults = withDefaults(null, "Ann Co");
  assert.equal(defaults.name, "Ann Co");
  assert.equal(defaults.cta, "request");
  assert.equal(defaults.show_prices, false);
  const mine = withDefaults({ name: "Ann and Co", color: "#111111", show_phone: false, tagline: null }, "Ann Co");
  assert.deepEqual([mine.name, mine.color, mine.show_phone, mine.tagline], ["Ann and Co", "#111111", false, ""]);

  const light = themeVars(withDefaults({ color: "#facc15" }));
  assert.equal(light["--site-color"], "#facc15");
  // Dark text on a light color, white on a dark one.
  assert.equal(light["--site-on-color"], "#111827");
  assert.equal(readableOn("#1e3a8a"), "#ffffff");
  assert.equal(light["--site-bg"], "#ffffff");
  const dark = themeVars(withDefaults({ mode: "dark", color: "not a color", font: "classic" }));
  assert.equal(dark["--site-bg"], "#0f172a");
  assert.equal(dark["--site-color"], "#2563eb");
  assert.match(dark.fontFamily, /Georgia/);
  assert.match(themeVars(withDefaults({ font: "comic" })).fontFamily, /Inter/);
});

test("the site's color is readable wherever it is used for words", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
  assert.equal(contrast("#2563eb", "#2563eb"), 1);
  // The words on the color are whichever of white and near-black reads better.
  for (const color of ["#facc15", "#22c55e", "#38bdf8", "#f97316", "#1e3a8a", "#2563eb", "#808080", "#000000", "#ffffff"]) {
    const on = readableOn(color);
    assert.ok(contrast(on, color) >= contrast(on === "#ffffff" ? "#111827" : "#ffffff", color), color);
    for (const mode of ["light", "dark"]) {
      const vars = themeVars(withDefaults({ color, mode }));
      // As words on the page (prices, the phone, the current menu page), on both backgrounds.
      for (const background of [vars["--site-bg"], vars["--site-alt"]]) {
        assert.ok(contrast(vars["--site-accent"], background) >= 4.5, `${color} on ${background} (${mode})`);
      }
      // As a background, the color is the owner's own.
      assert.equal(vars["--site-color"], color);
    }
  }
  // A color that already reads well is left alone; one that does not keeps its hue.
  assert.equal(themeVars(withDefaults({ color: "#1d4ed8" }))["--site-accent"], "#1d4ed8");
  const gold = themeVars(withDefaults({ color: "#facc15" }))["--site-accent"];
  assert.notEqual(gold, "#facc15");
  assert.notEqual(gold, "#0f172a");
  assert.equal(readableAs("#facc15", "#0f172a", ["#ffffff"], 100), "#0f172a");
});

test("typed text becomes paragraphs, and names become addresses", () => {
  assert.deepEqual(paragraphs("One.\n\nTwo\nstill two.\n\n\n  Three  "), ["One.", "Two\nstill two.", "Three"]);
  assert.deepEqual(paragraphs(""), []);
  assert.deepEqual(paragraphs(null), []);
  assert.equal(slugify("Ann's Window & Gutter Co."), "anns-window-gutter-co");
  assert.equal(slugify("  ---  "), "");
  assert.equal(slugify("x".repeat(80)).length, 40);
  // Typing an address: a hyphen at the end stays, so the next word can follow it.
  assert.equal(typedSlug("Acme "), "acme-");
  assert.equal(typedSlug("acme-"), "acme-");
  assert.equal(typedSlug("Ann's  Window & Gutter"), "anns-window-gutter");
  assert.equal(typedSlug("-acme"), "acme");
  assert.equal(typedSlug("x".repeat(60)).length, 40);
  let typed = "";
  for (const key of "ann-co windows") typed = typedSlug(typed + key);
  assert.equal(typed, "ann-co-windows");
  assert.equal(isAppName("Crew Job Tracker Pros"), true);
  assert.equal(isAppName("crewjobtrack"), true);
  assert.equal(isAppName("Crew Cuts"), false);
  assert.equal(isAppName(null), false);
  assert.equal(slugProblem("acme-windows"), null);
  for (const bad of ["ab", "Acme", "acme_windows", "-acme", "acme--co", "x".repeat(41), ""]) assert.ok(slugProblem(bad), bad);
  assert.equal(priceText({ price: "8.50", unit: "window" }), "$8.50 per window");
  assert.equal(priceText({ price: "150.00", unit: "" }), "$150.00");
  assert.equal(priceText({ name: "No price" }), "");
});

test("a new site starts with four pages of blocks the site knows", () => {
  const pages = starterPages("Ann Co");
  assert.deepEqual(pages.map((page) => page.title), ["Home", "Services", "About", "Contact"]);
  const known = new Set(["Hero", "Heading", "Text", "Button", "Services", "Features", "Reviews", "Faq", "Contact", "RequestQuote", "Columns", "Spacer", "Divider"]);
  const ids = new Set();
  for (const page of pages) {
    assert.deepEqual(page.data.root, { props: {} });
    for (const block of page.data.content) {
      assert.ok(known.has(block.type), block.type);
      assert.ok(block.props.id.startsWith(`${block.type}-`));
      ids.add(block.props.id);
    }
  }
  // Every block has its own id.
  assert.equal(ids.size, pages.reduce((count, page) => count + page.data.content.length, 0));
  assert.match(pages[0].data.content[0].props.title, /Ann Co/);
  assert.match(starterPages("").at(0).data.content[0].props.title, /our business/);
});

test("a site's pages are found wherever the site lives", () => {
  const site = { slug: "ann-co" };
  assert.equal(pagePath(site, ""), "/site/ann-co");
  assert.equal(pagePath(site, "about"), "/site/ann-co/about");
  // The owner's preview of drafts.
  assert.equal(pagePath({ ...site, base: "/website/preview" }, "about"), "/website/preview/about");
  // The business's own web address: the home page is the address itself.
  assert.equal(pagePath({ ...site, base: "" }, ""), "/");
  assert.equal(pagePath({ ...site, base: "" }, "about"), "/about");
});

test("a new site's text is formatted text, and its settings have a place for a logo and a description", () => {
  const text = starterPages("Ann Co").flatMap((page) => page.data.content).filter((block) => block.type === "Text");
  assert.ok(text.length >= 2);
  for (const block of text) {
    assert.match(block.props.html, /^<p>.*<\/p>$/);
    assert.equal("text" in block.props, false);
  }
  const settings = withDefaults({});
  assert.deepEqual([settings.logo, settings.logo_only, settings.description], ["", false, ""]);
  // Links keep out what cannot be seen, as the server does.
  assert.equal(safeHref("https://exam\u0001ple.com/"), null);
  assert.equal(webHref("exam\u0000ple.com"), null);
});
