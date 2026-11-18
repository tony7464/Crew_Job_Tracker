import { cleanRich } from "./richParse.js";

// Helpers for business websites: the look of a site, where its links go, and the pages a
// new site starts with. A site is data (server/site_content.py): these turn that data
// into what the block components draw, and never into HTML.

export const FONTS = [
  ["modern", "Modern"],
  ["classic", "Classic"],
  ["friendly", "Friendly"],
];
const FONT_STACKS = {
  modern: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  classic: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  friendly: '"Trebuchet MS", "Avenir Next", "Segoe UI", ui-rounded, system-ui, sans-serif',
};
export const DEFAULT_COLOR = "#2563eb";

// Every setting with its starting value, so the pages never meet a missing one.
export function withDefaults(settings, businessName = "") {
  const given = Object.entries(settings || {}).filter(([, value]) => value !== null && value !== undefined);
  return {
    name: businessName || "",
    tagline: "",
    color: DEFAULT_COLOR,
    font: "modern",
    mode: "light",
    phone: "",
    email: "",
    show_phone: true,
    cta: "request",
    cta_label: "Request a quote",
    show_prices: false,
    footer_text: "",
    logo: "",
    logo_only: false,
    description: "",
    ...Object.fromEntries(given),
  };
}

function isHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function channels(hex) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

// How light a color is, from 0 (black) to 1 (white), the way contrast is measured.
function luminance(hex) {
  const [red, green, blue] = channels(hex).map((value) => {
    const share = value / 255;
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// How well two colors read against each other: 1 (the same) to 21 (black on white).
// Text wants 4.5 or more.
export function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Black or white, whichever reads better on this color.
export function readableOn(hex) {
  if (!isHex(hex)) return "#ffffff";
  return contrast("#ffffff", hex) >= contrast("#111827", hex) ? "#ffffff" : "#111827";
}

function mix(from, to, share) {
  const start = channels(from);
  const end = channels(to);
  return `#${start.map((value, index) => Math.round(value + (end[index] - value) * share).toString(16).padStart(2, "0")).join("")}`;
}

// The color itself when it reads as text on every one of these backgrounds; otherwise the
// color moved toward the text color, a step at a time, until it does. A yellow stays
// yellow as a background, and becomes a dark gold where it is used for words.
export function readableAs(color, text, backgrounds, enough = 4.5) {
  for (let step = 0; step <= 10; step += 1) {
    const tried = mix(color, text, step / 10);
    if (backgrounds.every((background) => contrast(tried, background) >= enough)) return tried;
  }
  return text;
}

// The site's colors and font as CSS variables, set on the site's outer element.
// --site-color is for backgrounds (with --site-on-color for the words on it);
// --site-accent is the same color made readable as words on the page.
export function themeVars(settings) {
  const color = isHex(settings.color) ? settings.color : DEFAULT_COLOR;
  const dark = settings.mode === "dark";
  const background = dark ? "#0f172a" : "#ffffff";
  const alt = dark ? "#1e293b" : "#f8fafc";
  const text = dark ? "#f1f5f9" : "#0f172a";
  return {
    "--site-color": color,
    "--site-on-color": readableOn(color),
    "--site-accent": readableAs(color, text, [background, alt]),
    "--site-bg": background,
    "--site-alt": alt,
    "--site-fg": text,
    "--site-muted": dark ? "#cbd5e1" : "#475569",
    "--site-border": dark ? "#334155" : "#e2e8f0",
    fontFamily: FONT_STACKS[settings.font] || FONT_STACKS.modern,
  };
}

// No characters that cannot be seen inside an address (the server refuses them too).
// eslint-disable-next-line no-control-regex
const LINK = /^(https?:\/\/|mailto:|tel:)[^\s\x00-\x1f\x7f<>"'`\\]+$/i;
// "example.com/page", typed without the https:// in front. The server keeps it with one.
// eslint-disable-next-line no-control-regex
const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:[/?#][^\s\x00-\x1f\x7f<>"'`\\]*)?$/i;
const EMAIL = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`.]+$/;

// A link a site may use, or null: an ordinary web, email, or phone link. The server
// checks the same thing; this is the second lock, at the moment a link is drawn.
export function safeHref(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  // The same length the server keeps: anything longer is not saved, so it is not drawn either.
  return text.length <= 2000 && LINK.test(text) ? text : null;
}

// The link that calls a phone number, or null when it is not one. "(402) 555-0101 x12"
// dials the number; the extension stays in the words shown, since a link cannot dial it.
// A web address as typed in a button, as the link it becomes: "example.com" is
// "https://example.com", the way the server saves it. null when it is not an address.
export function webHref(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return safeHref(BARE_DOMAIN.test(text) ? `https://${text}` : text);
}

export function telHref(phone) {
  const number = String(phone || "").split(/x/i)[0];
  const digits = number.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${number.trim().startsWith("+") ? "+" : ""}${digits}`;
}

export function mailHref(email) {
  const text = String(email || "").trim();
  return EMAIL.test(text) ? `mailto:${text}` : null;
}

// Where a page of a site lives: /site/<site> for the home page, /site/<site>/<page> for the
// rest. site.base puts the pages somewhere else: the owner's preview of drafts, and ""
// on a business's own web address, where the pages are / and /<page>.
export function pagePath(site, pageSlug) {
  const base = typeof site.base === "string" ? site.base : `/site/${site.slug}`;
  return pageSlug ? `${base}/${pageSlug}` : base || "/";
}

// The id of a photo in a site's collection looks like this (the server checks the same).
const PHOTO_ID = /^[0-9a-f]{32}$/;

// Where the website asks for a photo of a site's collection, as an API path. size: "thumb"
// for the small one. null for anything that is not a photo's id.
export function photoPath(id, size) {
  if (typeof id !== "string" || !PHOTO_ID.test(id)) return null;
  return `/api/public/site-images/${id}${size === "thumb" ? "?size=thumb" : ""}`;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain typed text as the formatted text it becomes: a blank line starts a new paragraph,
// and a single line break stays a line break. Every character stays a character.
export function textToHtml(text) {
  return paragraphs(text)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const RICH_NAME = /html$/i;

// One block's (or one list item's) settings, with any formatted text written again in the
// only form a site keeps (cleanRich). What is not text under such a name is no text.
function cleanSettings(props) {
  const cleaned = { ...props };
  for (const [key, value] of Object.entries(cleaned)) {
    if (RICH_NAME.test(key)) cleaned[key] = typeof value === "string" ? cleanRich(value) : "";
  }
  return cleaned;
}

// A page's blocks as the editor wants them now, blocks inside columns too:
// - Text blocks made before formatted text held plain words in "text"; they move to "html".
// - Formatted text is handed to the editor only in the form a site keeps. The server
//   already keeps nothing else; this is the same lock on the way in to the editor, whose
//   text box shows what it is given as it is for a moment.
export function upgradeBlocks(list) {
  if (!Array.isArray(list)) return [];
  return list.map((block) => {
    if (!block || typeof block !== "object" || !block.props || typeof block.props !== "object") return block;
    const props = cleanSettings(block.props);
    for (const [key, value] of Object.entries(props)) {
      if (!Array.isArray(value) || RICH_NAME.test(key)) continue;
      if (value.length && value.every((entry) => entry && typeof entry === "object" && "type" in entry && "props" in entry)) {
        props[key] = upgradeBlocks(value);
      } else {
        props[key] = value.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? cleanSettings(item) : item));
      }
    }
    if (block.type === "Text" && !props.html && typeof props.text === "string") {
      props.html = textToHtml(props.text);
    }
    if (block.type === "Text") delete props.text;
    return { ...block, props };
  });
}

// A page's data with its blocks upgraded (see upgradeBlocks).
export function upgradePage(data) {
  return { ...data, content: upgradeBlocks(data?.content), root: data?.root || { props: {} } };
}

// Where a button goes. link: { action, href, page }. site: { slug, pages, request_url, settings }.
// Returns { href, internal } (internal: a page of this site), or null when it has nowhere to go.
export function resolveLink(link, site) {
  const action = link?.action || "request";
  if (action === "page") {
    const found = (site.pages || []).find((entry) => entry.slug === (link.page || ""));
    return found ? { href: pagePath(site, found.slug), internal: true } : null;
  }
  if (action === "link") {
    const href = webHref(link.href);
    return href ? { href, internal: false } : null;
  }
  if (action === "email") {
    const href = mailHref(site.settings.email);
    return href ? { href, internal: false } : null;
  }
  const call = telHref(site.settings.phone);
  if (action === "call") return call ? { href: call, internal: false } : null;
  // "request": the business's request form, or a call when it has no form.
  const form = safeHref(site.request_url);
  if (form) return { href: form, internal: false };
  return call ? { href: call, internal: false } : null;
}

// For the editor: why a button has nowhere to go, in words the owner can act on.
export function linkProblem(link, site) {
  if (resolveLink(link, site)) return null;
  const action = link?.action || "request";
  if (action === "page") return "the page it went to is gone. Pick another page.";
  if (action === "link") {
    return String(link.href || "").trim() ? "its web address does not work. It should look like https://example.com." : "it needs a web address.";
  }
  if (action === "email") return "add your email under Site settings.";
  if (action === "call") return "add your phone under Site settings.";
  return "turn on your request form under Settings, or add your phone under Site settings.";
}

// Text typed in a box, as paragraphs: a blank line starts a new one.
export function paragraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// The same rule as the server: "Ann's Co." becomes "anns-co".
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

// An address as it is typed into its box: lower-case, with spaces and anything else that
// is not a letter or a number turned into a hyphen. Unlike slugify it leaves a hyphen at
// the end alone, so "acme-" can go on to become "acme-windows".
export function typedSlug(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);
}

// Whether a name reads as the app's own. A site may not go by it (the server checks too).
export function isAppName(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes("crewjobtrack");
}

// What is wrong with a site or page address, or null.
export function slugProblem(value) {
  const text = String(value || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) || text.length < 3 || text.length > 40) {
    return "Use 3 to 40 lower-case letters, numbers, and hyphens, such as acme-windows.";
  }
  return null;
}

// "$8.50 per window", "$150.00", or "" when the site does not show prices.
export function priceText(service) {
  if (!service.price) return "";
  return `$${service.price}${service.unit ? ` per ${service.unit}` : ""}`;
}

let counter = 0;
// An id for a new block, in the editor's own style: "Hero-k3j2x9".
export function blockId(type) {
  counter += 1;
  return `${type}-${Date.now().toString(36)}${counter.toString(36)}`;
}

function block(type, props) {
  return { type, props: { id: blockId(type), ...props } };
}

function page(...content) {
  return { content, root: { props: {} } };
}

// The pages a new site starts with, filled in for this business: Home, Services, About, Contact.
export function starterPages(businessName) {
  const name = businessName || "our business";
  return [
    {
      title: "Home",
      data: page(
        block("Hero", {
          title: `Welcome to ${name}`,
          text: "Friendly, reliable service you can count on. Tell us what you need and we will get back to you with a quote.",
          buttonLabel: "Request a quote",
          action: "request",
          href: "",
          page: "",
          align: "center",
          tone: "brand",
        }),
        block("Features", {
          title: "Why people choose us",
          items: [
            { title: "Local and trusted", text: "We live and work in the community we serve." },
            { title: "Fair, clear prices", text: "You get a written quote before any work starts." },
            { title: "On time", text: "We show up when we say we will, and tell you when we are on the way." },
          ],
        }),
        block("Services", { title: "What we do", intro: "", source: "pricebook", items: [], columns: 3 }),
        block("RequestQuote", {
          title: "Ready to get started?",
          text: "Send us a few details and we will be in touch.",
          buttonLabel: "Request a quote",
        }),
      ),
    },
    {
      title: "Services",
      data: page(
        block("Heading", { text: "Our services", level: 2, align: "left" }),
        block("Text", { html: "<p>Here is what we can do for you. Not sure what you need? Ask us.</p>", align: "left", size: "normal" }),
        block("Services", { title: "", intro: "", source: "pricebook", items: [], columns: 2 }),
      ),
    },
    {
      title: "About",
      data: page(
        block("Heading", { text: `About ${name}`, level: 2, align: "left" }),
        block("Text", {
          html: "<p>Tell your story here: who you are, how long you have been doing this work, and what matters to you.</p><p>People hire people they trust. A few honest lines go a long way.</p>",
          align: "left",
          size: "normal",
        }),
        block("Reviews", {
          title: "What customers say",
          items: [{ quote: "Add a kind word from a customer here.", name: "A happy customer", place: "" }],
        }),
      ),
    },
    {
      title: "Contact",
      data: page(
        block("Contact", {
          title: "Get in touch",
          text: "Call, email, or send a request and we will get back to you.",
          hours: "Monday to Friday, 8 AM to 5 PM",
          area: "",
        }),
        block("Faq", {
          title: "Common questions",
          items: [{ question: "Do you give free quotes?", answer: "Yes. Send a request and we will get back to you." }],
        }),
      ),
    },
  ];
}
