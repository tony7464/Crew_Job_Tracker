// Formatted text on a business's website (bold, italic, underline, lists, links), read
// from the one form the server keeps it in (server/site_rich_text.py):
//
//   <p> <br> <strong> <em> <u> <ul> <ol> <li> <a href="...">
//
// with no other tags, no other attributes, and &, < and > in words written as &amp;,
// &lt; and &gt;. parseRich turns that into a small tree for RichText.jsx to draw with
// React elements. It never becomes HTML again: anything that is not one of those exact
// tags is not understood here, so it is kept as words and shows on the page as typed.

const TAG = /<(\/?)(p|br|strong|em|u|ul|ol|li|a)(?: href="([^"<>]*)")?>/g;
const WRITTEN = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };

function words(text) {
  return text.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_whole, name) => WRITTEN[name]);
}

// html: formatted text from the server. Returns a list of pieces: a string of words, or
// { tag, children } (and href for a link). A tag left open is closed at the end, and a
// closing tag with nothing to close is skipped.
export function parseRich(html) {
  const text = typeof html === "string" ? html : "";
  const root = { tag: null, children: [] };
  const open = [root];
  let at = 0;
  const say = (to) => {
    if (to > at) open[open.length - 1].children.push(words(text.slice(at, to)));
  };
  for (const found of text.matchAll(TAG)) {
    const [whole, closing, tag, href] = found;
    say(found.index);
    at = found.index + whole.length;
    if (tag === "br") {
      if (!closing) open[open.length - 1].children.push({ tag: "br" });
    } else if (closing) {
      const index = open.findLastIndex((node) => node.tag === tag);
      if (index > 0) open.length = index;
    } else {
      const node = tag === "a" ? { tag, href: words(href || ""), children: [] } : { tag, children: [] };
      open[open.length - 1].children.push(node);
      open.push(node);
    }
  }
  say(text.length);
  return root.children;
}

// eslint-disable-next-line no-control-regex
const LINK = /^(https?:\/\/|mailto:|tel:)[^\s\x00-\x1f\x7f<>"'`\\]+$/i;

function written(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function write(pieces) {
  return pieces
    .map((piece) => {
      if (typeof piece === "string") return written(piece);
      if (piece.tag === "br") return "<br>";
      const inside = write(piece.children);
      if (piece.tag !== "a") return `<${piece.tag}>${inside}</${piece.tag}>`;
      // A link that is not an ordinary web, email or phone address is plain words.
      if (piece.href.length > 2000 || !LINK.test(piece.href)) return inside;
      return `<a href="${written(piece.href).replace(/"/g, "&quot;")}">${inside}</a>`;
    })
    .join("");
}

// Formatted text written again in the form above, from what parseRich understood of it.
// Text in that form comes back unchanged. Anything else (text from before the server
// cleaned it, or from anywhere it should not have come) comes back with its markup turned
// into plain words. The editor is given only this: its own text box shows what it is
// handed as it is, for a moment, before it has read it.
export function cleanRich(html) {
  return write(parseRich(html));
}

// The words alone, for telling whether there is anything to show.
export function richWords(html) {
  const say = (pieces) => pieces.map((piece) => (typeof piece === "string" ? piece : say(piece.children || []))).join(" ");
  return say(parseRich(html)).replace(/\s+/g, " ").trim();
}
