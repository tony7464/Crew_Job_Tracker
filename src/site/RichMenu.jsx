import { RichTextMenu } from "@puckeditor/core";
import { useEffect, useRef, useState } from "react";
import { PANEL_BUTTON, PANEL_INPUT, PANEL_NOTE, PANEL_QUIET } from "./panelStyles";
import { mailHref, webHref } from "./siteUtils";

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

// The tools above a block's formatted text in the editor's side panel: bold, italic,
// underline, the two kinds of list, and a link. The editor's own menu has no link tool,
// so that one is made here: it asks for the address in a box under the tools.
// The server keeps only these kinds of formatting (server/site_rich_text.py).
//
// editorState.isLink and canLink come from linkState in puckConfig.jsx.
export function RichMenu({ editor, editorState, readOnly }) {
  const [asking, setAsking] = useState(false);
  const [address, setAddress] = useState("");
  const [wrong, setWrong] = useState(false);
  const box = useRef(null);
  const onLink = Boolean(editorState?.isLink);

  // Focused from here, not with autoFocus: the box is drawn after the click that asked for it.
  useEffect(() => {
    if (asking) box.current?.focus();
  }, [asking]);

  function ask(event) {
    event.stopPropagation();
    setAddress(editor?.getAttributes("link").href || "");
    setWrong(false);
    setAsking((open) => !open);
  }

  function apply() {
    // A web address ("example.com" is enough) or an email address.
    const href = webHref(address) || mailHref(address);
    // The editor refuses what is not a link too. Asked first, so a refused address leaves
    // the cursor in the box instead of jumping back to the words.
    if (!href || !editor || !editor.can().setLink({ href })) {
      setWrong(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setAsking(false);
  }

  function remove() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setAsking(false);
  }

  function cancel() {
    setAsking(false);
    editor?.commands.focus();
  }

  return (
    <RichTextMenu>
      <RichTextMenu.Group>
        <RichTextMenu.Bold />
        <RichTextMenu.Italic />
        <RichTextMenu.Underline />
      </RichTextMenu.Group>
      <RichTextMenu.Group>
        <RichTextMenu.BulletList />
        <RichTextMenu.OrderedList />
      </RichTextMenu.Group>
      <RichTextMenu.Group>
        <RichTextMenu.Control
          icon={<LinkIcon />}
          title={onLink ? "Change the link" : "Make a link (select the words first)"}
          active={onLink || asking}
          disabled={readOnly || !editorState?.canLink}
          onClick={ask}
        />
      </RichTextMenu.Group>
      {/* Inside the menu itself: the editor keeps its place in the text while the cursor is in here. */}
      {asking && (
        <div className="basis-full space-y-1.5 border-t border-slate-200 pt-2">
          <input
            ref={box}
            type="text"
            inputMode="url"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setWrong(false);
            }}
            // Needed: the editor treats any focused box in its panel as "the field being
            // edited", and saves text changes only while the text is that field. Without
            // this a link added to text being edited on the page shows, and is not saved.
            onFocus={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                apply();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancel();
              }
            }}
            placeholder="example.com or name@example.com"
            aria-label="Where the link goes"
            aria-invalid={wrong}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={PANEL_INPUT}
          />
          {wrong && <p className="text-xs font-medium text-red-700">Enter a web address like example.com, or an email address.</p>}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={PANEL_BUTTON} onClick={apply}>
              {onLink ? "Change link" : "Add link"}
            </button>
            {onLink && (
              <button type="button" className={PANEL_QUIET} onClick={remove}>
                Remove link
              </button>
            )}
            <button type="button" className={PANEL_QUIET} onClick={cancel}>
              Cancel
            </button>
          </div>
          <p className={PANEL_NOTE}>The link goes on the words you selected.</p>
        </div>
      )}
    </RichTextMenu>
  );
}

// The few tools that float over the text when it is edited on the page itself. A link is
// added from the side panel, which works on the same text.
export function RichInlineMenu() {
  return (
    <RichTextMenu>
      <RichTextMenu.Group>
        <RichTextMenu.Bold />
        <RichTextMenu.Italic />
        <RichTextMenu.Underline />
      </RichTextMenu.Group>
      <RichTextMenu.Group>
        <RichTextMenu.BulletList />
        <RichTextMenu.OrderedList />
      </RichTextMenu.Group>
    </RichTextMenu>
  );
}
