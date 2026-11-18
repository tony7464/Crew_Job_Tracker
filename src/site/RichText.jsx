import { useMemo } from "react";
import { parseRich } from "./richParse";
import { safeHref } from "./siteUtils";

function draw(piece, key) {
  if (typeof piece === "string") return piece;
  if (piece.tag === "br") return <br key={key} />;
  const children = piece.children.map(draw);
  if (piece.tag === "a") {
    // The second lock on a link: only an ordinary web, email or phone address is one.
    const href = safeHref(piece.href);
    if (!href) return <span key={key}>{children}</span>;
    // Whatever case it was typed in: HTTPS:// leaves the site just as https:// does.
    const web = /^https?:/i.test(href);
    return (
      <a key={key} href={href} {...(web ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}>
        {children}
      </a>
    );
  }
  const Tag = piece.tag;
  return <Tag key={key}>{children}</Tag>;
}

// Formatted text as visitors see it. Built from React elements, never from raw HTML
// (see richParse.js), so what a site holds can only ever show up as words and plain tags.
export default function RichText({ html }) {
  const pieces = useMemo(() => parseRich(html), [html]);
  return pieces.map(draw);
}
