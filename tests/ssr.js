// For tests: draws the real app's pages on the server, as a browser would show them. Vite
// loads the app's own files, JSX and all.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

export const THEME = { preference: "system", theme: "light", setPreference() {}, toggle() {} };

// A Vite server inside the test, with no port and no file watching. Close it after the tests.
// Each test file runs in a process of its own, at the same time as the others: each gets its
// own Vite cache folder, so they never race to write one.
export async function startVite() {
  const cacheDir = mkdtempSync(join(tmpdir(), "cjt-vite-test-"));
  let vite;
  let contexts;
  try {
    vite = await createServer({
      root: fileURLToPath(new URL("..", import.meta.url)),
      cacheDir,
      logLevel: "error",
      appType: "custom",
      server: { middlewareMode: true, hmr: false, ws: false },
      // Only the server renders here, so the browser's dependency pre-bundling is not needed.
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    contexts = {
      ...(await vite.ssrLoadModule("/src/context/useAuth.js")),
      ...(await vite.ssrLoadModule("/src/context/useTheme.js")),
    };
  } catch (error) {
    // Nothing is left behind when it cannot start: no open server, no cache folder.
    await vite?.close().catch(() => {});
    rmSync(cacheDir, { recursive: true, force: true });
    throw error;
  }
  const { AuthContext, ThemeContext } = contexts;
  // An element drawn at this address for this session ({ user, loading }), as HTML, once
  // every page it loads on demand has loaded.
  async function render(element, { path = "/", auth = { user: null, loading: false } } = {}) {
    const page = h(
      ThemeContext.Provider,
      { value: THEME },
      h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: auth }, element)),
    );
    const { prelude } = await prerenderToNodeStream(page);
    let html = "";
    for await (const chunk of prelude) html += chunk;
    return html;
  }
  async function close() {
    try {
      await vite.close();
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  }
  return { vite, render, close, load: (path) => vite.ssrLoadModule(path) };
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'", nbsp: " " };

// The words of some HTML, as a reader sees them.
export function words(html) {
  return html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#x27|#39|nbsp);/g, (_match, name) => ENTITIES[name])
    .replace(/\s+/g, " ")
    .trim();
}

// The first <tag> element whose words include text (any, when text is empty). "" when none does.
export function part(html, tag, text = "") {
  const elements = html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "g")) || [];
  return elements.find((element) => words(element).includes(text)) || "";
}

// The form controls in some HTML, in order: inputs, selects, text areas, and buttons.
export function controls(html) {
  return [...html.matchAll(/<(input|select|textarea|button)\b[^>]*>/g)].map(([tag]) => tag);
}

// The phone field and the consent box right after it, with no other field or words between.
export function phoneThenConsent(html) {
  const phone = html.search(/<input[^>]*type="tel"/);
  if (phone < 0) return { ok: false, why: "no phone field" };
  const after = html.slice(phone);
  const next = controls(after);
  if (!next[1] || !/type="checkbox"/.test(next[1]) || !/name="sms_consent"/.test(next[1])) {
    return { ok: false, why: `the next control after the phone field is ${next[1]}` };
  }
  const between = after.slice(after.indexOf(next[0]) + next[0].length, after.indexOf(next[1]));
  return { ok: words(between) === "", why: `words between them: "${words(between)}"`, box: next[1] };
}

// A source file's code without its comments (path from the project folder), for checking how
// a page is put together where it cannot be drawn here.
export function code(path) {
  return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/\s.*$/gm, "");
}

// The elements in a tree of elements (not drawn), depth first.
export function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
