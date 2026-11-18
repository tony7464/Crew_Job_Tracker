import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../api";
import { cx } from "../components/ui/styles";
import RichText from "./RichText";
import { useSite } from "./SiteContext";
import { linkProblem, mailHref, paragraphs, photoPath, priceText, resolveLink, telHref } from "./siteUtils";

// The blocks a business's website is made of. Each one draws plain data (see
// server/site_content.py): every piece of text is printed as text, and a link is only
// ever one that resolveLink or safeHref allows. No block uses raw HTML: formatted text
// is drawn piece by piece (RichText.jsx, richParse.js), and a photo is one of the site's own, named
// by its id.
//
// Colors and the font come from CSS variables set on the site's outer element
// (themeVars in siteUtils.js), so the same blocks follow each site's own look.
// --site-color is a background; where the color is used for words it is --site-accent,
// which is the same color made readable on the page.

// A list setting as a list, whatever the data holds.
function listOf(items) {
  return Array.isArray(items) ? items : [];
}

const HEADING = "[font-family:inherit] font-bold tracking-tight";
// How a link that leaves the site is marked: it opens apart from the site, tells the other
// site nothing, and is the business's own link, not one the app vouches for.
const OUTSIDE_LINK = "noopener noreferrer nofollow ugc";
const ALIGN = { left: "text-left", center: "text-center" };

function Section({ tone = "plain", narrow = false, children }) {
  const style =
    tone === "brand"
      ? { background: "var(--site-color)", color: "var(--site-on-color)" }
      : tone === "alt"
        ? { background: "var(--site-alt)" }
        : undefined;
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14" style={style}>
      <div className={cx("mx-auto", narrow ? "max-w-3xl" : "max-w-5xl")}>{children}</div>
    </section>
  );
}

function Title({ children, align = "left" }) {
  if (!children) return null;
  return <h2 className={cx(HEADING, "mb-6 text-2xl sm:text-3xl", ALIGN[align])}>{children}</h2>;
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--site-border)", background: "var(--site-bg)" }}>
      {children}
    </div>
  );
}

// A button that goes where its action says. In the editor it goes nowhere; on the live
// site a button with nowhere to go is left out, and the editor says so beside it.
export function SiteButton({ link, label, variant = "solid", onBrand = false }) {
  const { site, editing } = useSite();
  const target = resolveLink(link, site);
  if (!label || (!target && !editing)) return null;
  const style =
    variant === "outline"
      ? { border: "2px solid currentColor", color: onBrand ? "var(--site-on-color)" : "var(--site-accent)" }
      : onBrand
        ? { background: "var(--site-on-color)", color: "var(--site-color)" }
        : { background: "var(--site-color)", color: "var(--site-on-color)" };
  const className = "inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-base font-semibold no-underline";
  if (!target) {
    return (
      <span className="inline-flex max-w-full flex-col items-center gap-1.5">
        <span className={className} style={{ ...style, opacity: 0.5, outline: "2px dashed currentColor", outlineOffset: 3 }}>
          {label}
        </span>
        <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
          Not on your site yet: {linkProblem(link, site)}
        </span>
      </span>
    );
  }
  if (editing) {
    return (
      <span className={className} style={style}>
        {label}
      </span>
    );
  }
  if (target.internal) {
    return (
      <Link to={target.href} className={className} style={style}>
        {label}
      </Link>
    );
  }
  const web = /^https?:/i.test(target.href);
  return (
    <a href={target.href} className={className} style={style} {...(web ? { target: "_blank", rel: OUTSIDE_LINK } : {})}>
      {label}
    </a>
  );
}

// Shown in the editor only, where a block has nothing to show yet.
function EditorHint({ children }) {
  const { editing } = useSite();
  if (!editing) return null;
  return (
    <p className="rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: "var(--site-border)", color: "var(--site-muted)" }}>
      {children}
    </p>
  );
}

// Whether id names a photo of this site's collection. Anything else is not drawn.
function useHasPhoto(id) {
  const { site } = useSite();
  return Boolean(id && site.images && Object.hasOwn(site.images, id));
}

// A photo of the site's collection, by its id. Nothing when the site has no such photo.
// small: the smaller copy, for grids and the header. Its real size is given to the
// browser up front, so the page does not jump when the photo arrives.
export function Photo({ id, alt = "", small = false, eager = false, className, style }) {
  const { site } = useSite();
  const has = useHasPhoto(id);
  const src = photoPath(id, small ? "thumb" : undefined);
  if (!src || !has) return null;
  const { width, height } = site.images[id];
  return (
    <img
      src={apiUrl(src)}
      alt={typeof alt === "string" ? alt : ""}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}

// How formatted text looks: paragraphs apart, lists with their dots and numbers, links in
// the site's color. The same for the editor's own text box and for the live site.
const RICH =
  "[&_p]:min-h-[1em] [&_p]:whitespace-pre-wrap [&_p+p]:mt-4 [&_p+ul]:mt-3 [&_p+ol]:mt-3 [&_ul+p]:mt-4 [&_ol+p]:mt-4 " +
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-1 [&_li_p]:m-0 [&_li>ul]:mt-1 [&_li>ol]:mt-1 " +
  "[&_strong]:font-semibold [&_a]:underline [&_a]:[color:var(--site-accent)] [&_a]:[overflow-wrap:anywhere]";

// Formatted text from a block's settings. On the live site it is the server's text
// (a string); in the editor it is the editor's own text box, already drawn.
function Rich({ html, className, style }) {
  const { editing } = useSite();
  // Outside the editor only text is ever drawn, and only through RichText.
  const drawn = typeof html === "string" ? html && <RichText html={html} /> : editing ? html : null;
  if (!drawn) return null;
  return (
    <div className={cx(RICH, className)} style={style}>
      {drawn}
    </div>
  );
}

export function Hero({ title, text, buttonLabel, action, href, page, align = "center", tone = "brand", image }) {
  const brand = tone === "brand";
  const photo = useHasPhoto(image);
  return (
    <section
      className={cx("px-4 py-16 sm:px-6 sm:py-24", photo && "relative isolate overflow-hidden sm:py-32")}
      style={
        photo
          ? { color: "#ffffff", background: "#0f172a" }
          : brand
            ? { background: "var(--site-color)", color: "var(--site-on-color)" }
            : { background: "var(--site-alt)" }
      }
    >
      {photo && (
        <>
          {/* Behind the words, darkened so they read on any photo. */}
          <Photo id={image} eager className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/55" />
        </>
      )}
      <div className={cx("mx-auto max-w-3xl", ALIGN[align])}>
        <h1 className={cx(HEADING, "text-4xl sm:text-5xl")}>{title}</h1>
        {text && <p className="mt-4 whitespace-pre-line text-lg opacity-90">{text}</p>}
        {buttonLabel && (
          <div className="mt-8">
            <SiteButton link={{ action, href, page }} label={buttonLabel} onBrand={brand && !photo} />
          </div>
        )}
      </div>
    </section>
  );
}

export function Heading({ text, level = 2, align = "left" }) {
  const Tag = level === 3 ? "h3" : "h2";
  return (
    <div className="px-4 pt-10 sm:px-6">
      <Tag className={cx(HEADING, "mx-auto max-w-5xl", level === 3 ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl", ALIGN[align])}>{text}</Tag>
    </div>
  );
}

// html: formatted text. text: the plain words of a block made before formatted text,
// shown until the owner next edits the page (the editor moves them to html).
export function Text({ html, text, align = "left", size = "normal" }) {
  const sized = cx("mx-auto max-w-5xl", size === "large" ? "text-lg sm:text-xl" : "text-base", ALIGN[align]);
  const parts = html ? [] : paragraphs(typeof text === "string" ? text : "");
  return (
    <div className="px-4 py-4 sm:px-6">
      {html ? (
        <Rich html={html} className={sized} style={{ color: "var(--site-muted)" }} />
      ) : (
        <div className={cx(sized, "space-y-4")} style={{ color: "var(--site-muted)" }}>
          {parts.length ? parts.map((part, index) => <p key={index} className="whitespace-pre-line">{part}</p>) : <EditorHint>Write something here.</EditorHint>}
        </div>
      )}
    </div>
  );
}

const PHOTO_WIDTH = { small: "max-w-sm", medium: "max-w-2xl", wide: "max-w-5xl" };
const PHOTO_SHAPE = { natural: "h-auto", landscape: "aspect-video object-cover", square: "aspect-square object-cover" };

export function Image({ image, alt, caption, size = "wide", shape = "natural", align = "center" }) {
  const { editing } = useSite();
  const has = useHasPhoto(image);
  if (!has && !editing) return null;
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <figure className={cx(PHOTO_WIDTH[size] || PHOTO_WIDTH.wide, align === "center" && "mx-auto")}>
          {has ? (
            <Photo id={image} alt={alt} className={cx("w-full rounded-2xl", PHOTO_SHAPE[shape] || PHOTO_SHAPE.natural)} />
          ) : (
            <EditorHint>Pick a photo in the panel on the right.</EditorHint>
          )}
          {caption && has && (
            <figcaption className="mt-2 whitespace-pre-line text-sm" style={{ color: "var(--site-muted)" }}>{caption}</figcaption>
          )}
        </figure>
      </div>
    </div>
  );
}

// One photo of a gallery, large, over the page. Arrow keys and the buttons go to the
// next and the last; Escape, the close button, or a click beside the photo closes it.
function BigPhoto({ list, index, onIndex, onClose }) {
  const dialog = useRef(null);
  const item = list[index];
  const step = (by) => onIndex((index + by + list.length) % list.length);

  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => element.close();
  }, []);

  const button = "inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-white/15 px-3 text-base font-semibold text-white hover:bg-white/25";
  return (
    <dialog
      ref={dialog}
      aria-label="Photo"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (list.length < 2) return;
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/90 p-4 text-white backdrop:bg-black/80"
    >
      <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-3">
        <Photo id={item.image} alt={item.caption} eager className="pointer-events-auto max-h-[78dvh] w-auto max-w-full rounded-lg object-contain" />
        {item.caption && <p className="pointer-events-auto max-w-2xl text-center text-sm">{item.caption}</p>}
        <div className="pointer-events-auto flex items-center gap-3">
          {list.length > 1 && <button type="button" className={button} onClick={() => step(-1)} aria-label="The photo before">‹</button>}
          <button type="button" className={button} onClick={onClose}>Close</button>
          {list.length > 1 && <button type="button" className={button} onClick={() => step(1)} aria-label="The next photo">›</button>}
        </div>
      </div>
    </dialog>
  );
}

const GALLERY = { 2: "grid-cols-2", 3: "grid-cols-2 md:grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" };

export function Gallery({ title, items, columns = 3 }) {
  const { site, editing } = useSite();
  const [open, setOpen] = useState(null);
  // Only photos the site still has. One that was deleted leaves no gap.
  const list = listOf(items).filter((item) => item && site.images && Object.hasOwn(site.images, item.image));
  if (!list.length && !editing) return null;
  return (
    <Section>
      <Title align="center">{title}</Title>
      {list.length ? (
        <ul className={cx("grid gap-3", GALLERY[columns] || GALLERY[3])}>
          {list.map((item, index) => (
            <li key={`${item.image}-${index}`}>
              <button
                type="button"
                onClick={editing ? undefined : () => setOpen(index)}
                aria-label={`Open photo ${index + 1}${item.caption ? `: ${item.caption}` : ""}`}
                className="block aspect-square w-full overflow-hidden rounded-xl"
              >
                <Photo id={item.image} alt={item.caption} small className="h-full w-full object-cover transition-transform duration-200 hover:scale-105" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EditorHint>Add photos in the panel on the right.</EditorHint>
      )}
      {open !== null && list[open] && <BigPhoto list={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </Section>
  );
}

// A photo with words beside it. On a phone the photo comes first.
export function PhotoText({ image, alt, title, html, side = "left", buttonLabel, action, href, page }) {
  const { editing } = useSite();
  const has = useHasPhoto(image);
  return (
    <Section>
      <div className={cx("grid items-center gap-8", (has || editing) && "md:grid-cols-2")}>
        {(has || editing) && (
          <div className={cx(side === "right" && "md:order-2")}>
            {/* A tall photo is cut to a sensible height, so it does not tower over the words beside it. */}
            {has ? <Photo id={image} alt={alt} className="h-auto max-h-[34rem] w-full rounded-2xl object-cover" /> : <EditorHint>Pick a photo in the panel on the right.</EditorHint>}
          </div>
        )}
        <div className="min-w-0">
          {title && <h2 className={cx(HEADING, "mb-4 text-2xl sm:text-3xl")}>{title}</h2>}
          <Rich html={html} style={{ color: "var(--site-muted)" }} />
          {buttonLabel && (
            <div className="mt-6">
              <SiteButton link={{ action, href, page }} label={buttonLabel} />
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export function Button({ label, action, href, page, align = "left", variant = "solid" }) {
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className={cx("mx-auto max-w-5xl", ALIGN[align])}>
        <SiteButton link={{ action, href, page }} label={label} variant={variant} />
      </div>
    </div>
  );
}

const GRID = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" };

export function Services({ title, intro, source = "pricebook", items, columns = 3 }) {
  const { site, editing } = useSite();
  const fromBook = source !== "custom";
  const list = listOf(fromBook ? site.services : items);
  if (!list.length && !editing) return null;
  return (
    <Section tone="alt">
      <Title>{title}</Title>
      {intro && <p className="-mt-3 mb-6 whitespace-pre-line" style={{ color: "var(--site-muted)" }}>{intro}</p>}
      {list.length ? (
        <ul className={cx("grid gap-4", GRID[columns] || GRID[3])}>
          {list.map((service, index) => (
            <li key={index}>
              <Card>
                <p className="text-lg font-semibold">{service.name}</p>
                {service.description && (
                  <p className="mt-1.5 line-clamp-6 whitespace-pre-line text-sm" style={{ color: "var(--site-muted)" }}>
                    {service.description}
                  </p>
                )}
                {priceText(service) && <p className="mt-3 font-semibold" style={{ color: "var(--site-accent)" }}>{priceText(service)}</p>}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EditorHint>
          {fromBook
            ? "Your price book has no services yet. Add some under Billing, Price book, or switch this block to services typed here."
            : "Add your services in the panel on the right."}
        </EditorHint>
      )}
    </Section>
  );
}

export function Features({ title, items }) {
  const list = listOf(items);
  return (
    <Section>
      <Title align="center">{title}</Title>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((item, index) => (
          <li key={index}>
            <Card>
              <p className="text-lg font-semibold">{item.title}</p>
              {item.text && <p className="mt-1.5 whitespace-pre-line text-sm" style={{ color: "var(--site-muted)" }}>{item.text}</p>}
            </Card>
          </li>
        ))}
      </ul>
      {!list.length && <EditorHint>Add a few reasons to choose you in the panel on the right.</EditorHint>}
    </Section>
  );
}

export function Reviews({ title, items }) {
  const list = listOf(items);
  return (
    <Section tone="alt">
      <Title align="center">{title}</Title>
      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((item, index) => (
          <li key={index}>
            <Card>
              <blockquote className="whitespace-pre-line text-base">“{item.quote}”</blockquote>
              {(item.name || item.place) && (
                <p className="mt-3 text-sm font-semibold" style={{ color: "var(--site-muted)" }}>
                  {[item.name, item.place].filter(Boolean).join(", ")}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {!list.length && <EditorHint>Add what your customers say in the panel on the right.</EditorHint>}
    </Section>
  );
}

export function Faq({ title, items }) {
  const list = listOf(items);
  return (
    <Section narrow>
      <Title>{title}</Title>
      <div className="divide-y rounded-2xl border" style={{ borderColor: "var(--site-border)" }}>
        {list.map((item, index) => (
          <details key={index} className="p-4" style={{ borderColor: "var(--site-border)" }}>
            <summary className="cursor-pointer text-base font-semibold">{item.question}</summary>
            <p className="mt-2 whitespace-pre-line text-sm" style={{ color: "var(--site-muted)" }}>{item.answer}</p>
          </details>
        ))}
      </div>
      {!list.length && <EditorHint>Add questions and answers in the panel on the right.</EditorHint>}
    </Section>
  );
}

function ContactLine({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--site-muted)" }}>{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-base">{children}</dd>
    </div>
  );
}

export function Contact({ title, text, hours, area }) {
  const { site, editing } = useSite();
  const { phone, email } = site.settings;
  const call = telHref(phone);
  const mail = mailHref(email);
  const stop = editing ? (event) => event.preventDefault() : undefined;
  return (
    <Section narrow>
      <Title>{title}</Title>
      {text && <p className="-mt-3 mb-6 whitespace-pre-line" style={{ color: "var(--site-muted)" }}>{text}</p>}
      <Card>
        <dl className="grid gap-5 sm:grid-cols-2">
          {call && (
            <ContactLine label="Phone">
              <a href={call} onClick={stop} className="font-semibold" style={{ color: "var(--site-accent)" }}>{phone}</a>
            </ContactLine>
          )}
          {mail && (
            <ContactLine label="Email">
              <a href={mail} onClick={stop} className="font-semibold [overflow-wrap:anywhere]" style={{ color: "var(--site-accent)" }}>{email}</a>
            </ContactLine>
          )}
          {hours && <ContactLine label="Hours">{hours}</ContactLine>}
          {area && <ContactLine label="Where we work">{area}</ContactLine>}
        </dl>
        {!call && !mail && <EditorHint>Add your phone and email under Site settings, and they will show here.</EditorHint>}
        <div className="mt-6">
          {/* The header button's words, but only when that button is the request button too. */}
          <SiteButton link={{ action: "request" }} label={(site.settings.cta === "request" && site.settings.cta_label) || "Request a quote"} />
        </div>
      </Card>
    </Section>
  );
}

export function RequestQuote({ title, text, buttonLabel }) {
  return (
    <Section tone="brand" narrow>
      <div className="text-center">
        <h2 className={cx(HEADING, "text-2xl sm:text-3xl")}>{title}</h2>
        {text && <p className="mt-3 whitespace-pre-line text-lg opacity-90">{text}</p>}
        <div className="mt-6">
          <SiteButton link={{ action: "request" }} label={buttonLabel} onBrand />
        </div>
      </div>
    </Section>
  );
}

// first, second, third: what goes in each column, already drawn.
export function Columns({ count = 2, first, second, third }) {
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className={cx("mx-auto grid max-w-5xl gap-6", count === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <div className="min-w-0">{first}</div>
        <div className="min-w-0">{second}</div>
        {count === 3 && <div className="min-w-0">{third}</div>}
      </div>
    </div>
  );
}

// Columns in the editor, which hands each column over as a component that draws what is in it.
export function EditorColumns({ first: First, second: Second, third: Third, count }) {
  return <Columns count={count} first={<First />} second={<Second />} third={<Third />} />;
}

const SPACE = { small: "h-6", medium: "h-12", large: "h-24" };

export function Spacer({ size = "medium" }) {
  return <div aria-hidden="true" className={SPACE[size] || SPACE.medium} />;
}

export function Divider() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <hr className="mx-auto max-w-5xl" style={{ borderColor: "var(--site-border)" }} />
    </div>
  );
}
