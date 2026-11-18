import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanRich, parseRich, richWords } from "../src/site/richParse.js";
import { photoPath, textToHtml, upgradeBlocks, upgradePage } from "../src/site/siteUtils.js";

test("formatted text in the form the server keeps is read as a tree", () => {
  const html = '<p>Hi <strong>a &amp; b</strong> <a href="https://x.example/?a=1&amp;b=2">link</a><br>next</p><ul><li><p>one</p></li><li><p>two</p></li></ul>';
  assert.deepEqual(parseRich(html), [
    {
      tag: "p",
      children: ["Hi ", { tag: "strong", children: ["a & b"] }, " ", { tag: "a", href: "https://x.example/?a=1&b=2", children: ["link"] }, { tag: "br" }, "next"],
    },
    { tag: "ul", children: [{ tag: "li", children: [{ tag: "p", children: ["one"] }] }, { tag: "li", children: [{ tag: "p", children: ["two"] }] }] },
  ]);
  assert.deepEqual(parseRich("&lt;b&gt; &quot;x&quot; &#x27;y&#x27; &amp;amp;"), [`<b> "x" 'y' &amp;`]);
  for (const nothing of ["", null, undefined, 5, {}]) assert.deepEqual(parseRich(nothing), []);
  assert.equal(richWords("<p>Hi <strong>there</strong></p><p></p>"), "Hi there");
  assert.equal(richWords("<p></p><p></p>"), "");
});

test("anything that is not one of the few plain tags stays words", () => {
  const hostile = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '<p onclick="x">',
    "<P>",
    "<p >",
    '<a href="https://x.example" target="_blank">',
    "<a href='https://x.example'>",
    '<a href="x"onmouseover="y">',
    "<iframe>",
    "<style>",
    "<svg/onload=alert(1)>",
  ];
  for (const piece of hostile) {
    const tree = parseRich(`<p>before${piece}after</p>`);
    // Still one paragraph, and the piece is in it as typed: words, not a tag.
    assert.equal(tree.length, 1, piece);
    assert.ok(tree[0].children.every((child) => typeof child === "string"), piece);
    assert.ok(tree[0].children.join("").includes(piece), piece);
  }
  // A tag left open is closed at the end, and a closing tag with nothing to close is skipped.
  assert.deepEqual(parseRich("<p>a<strong>b"), [{ tag: "p", children: ["a", { tag: "strong", children: ["b"] }] }]);
  assert.deepEqual(parseRich("a</p></strong>b"), ["a", "b"]);
});

test("formatted text is written again in the kept form before the editor sees it", () => {
  const kept = '<p>Hi <strong>a &amp; b</strong> <a href="https://x.example/?a=1&amp;b=2">link</a><br>next</p><ol><li><p>one</p></li></ol>';
  assert.equal(cleanRich(kept), kept);
  // What should never have been stored comes back as words, and a bad link as plain words.
  assert.equal(
    cleanRich('<p>x</p><img src=x onerror=alert(1)><a href="javascript:alert(1)">j</a><script>alert(1)</script>'),
    "<p>x</p>&lt;img src=x onerror=alert(1)&gt;j&lt;script&gt;alert(1)&lt;/script&gt;",
  );
  assert.equal(cleanRich('<a href="https://x.example/&quot;onmouseover=&quot;alert(1)">q</a>'), "q");
  assert.equal(cleanRich(`<a href="https://${"x".repeat(2100)}">q</a>`), "q");
  assert.equal(cleanRich("<p>open <strong>bold"), "<p>open <strong>bold</strong></p>");
  assert.equal(cleanRich(undefined), "");
  // Cleaning what was cleaned changes nothing.
  for (const text of ["<p>a</p>", "plain <b> & words", '<p>"q" &lt;x&gt;</p>', "<ul><li>one</li></ul>"]) {
    assert.equal(cleanRich(cleanRich(text)), cleanRich(text));
  }
});

test("plain typed text becomes formatted text, every character still a character", () => {
  assert.equal(textToHtml("one\n\ntwo <b> & co\nthree\n\n\n  "), "<p>one</p><p>two &lt;b&gt; &amp; co<br>three</p>");
  assert.equal(textToHtml(""), "");
  assert.equal(textToHtml(undefined), "");
  assert.equal(cleanRich(textToHtml("a <script>alert(1)</script> b")), "<p>a &lt;script&gt;alert(1)&lt;/script&gt; b</p>");
});

test("a page is brought up to date and cleaned on its way into the editor", () => {
  const page = {
    content: [
      { type: "Text", props: { id: "a", text: "one\n\ntwo", align: "left" } },
      { type: "Text", props: { id: "b", html: "<p>kept</p><img src=x onerror=1>", text: "old words" } },
      { type: "Text", props: { id: "c", html: "", text: "" } },
      { type: "PhotoText", props: { id: "d", html: 5, title: "T" } },
      { type: "Faq", props: { id: "e", items: [{ question: "<b>q</b>", answerHtml: "<script>x</script>" }, "odd", null] } },
      { type: "Columns", props: { id: "f", first: [{ type: "Text", props: { id: "g", text: "in a column" } }], second: [] } },
      { type: "Hero", props: { id: "h", title: "Unchanged <b>", text: "plain" } },
      null,
      { type: "Odd" },
    ],
  };
  const before = JSON.stringify(page);
  const upgraded = upgradePage(page);
  assert.equal(JSON.stringify(page), before, "the data it was given is left alone");
  const [a, b, c, d, e, f, h] = upgraded.content;
  assert.deepEqual(a.props, { id: "a", align: "left", html: "<p>one</p><p>two</p>" });
  assert.deepEqual(b.props, { id: "b", html: "<p>kept</p>&lt;img src=x onerror=1&gt;" });
  assert.deepEqual(c.props, { id: "c", html: "" });
  assert.equal(d.props.html, "");
  assert.deepEqual(e.props.items, [{ question: "<b>q</b>", answerHtml: "&lt;script&gt;x&lt;/script&gt;" }, "odd", null]);
  assert.deepEqual(f.props.first[0].props, { id: "g", html: "<p>in a column</p>" });
  assert.deepEqual(h.props, { id: "h", title: "Unchanged <b>", text: "plain" });
  assert.deepEqual(upgraded.root, { props: {} });
  assert.deepEqual(upgradeBlocks(undefined), []);
  // Done twice, nothing more changes: the editor does not see a page as edited for it.
  assert.equal(JSON.stringify(upgradePage(upgraded)), JSON.stringify(upgraded));
});

test("a photo is asked for by its id and nothing else", () => {
  const id = "0123456789abcdef0123456789abcdef";
  assert.equal(photoPath(id), `/api/public/site-images/${id}`);
  assert.equal(photoPath(id, "thumb"), `/api/public/site-images/${id}?size=thumb`);
  for (const bad of ["", "https://evil.example/x.png", `${id}/../x`, id.toUpperCase(), `${id}0`, null, undefined, 5]) {
    assert.equal(photoPath(bad), null, String(bad));
  }
});
