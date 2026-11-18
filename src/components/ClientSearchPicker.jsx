import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useClientSearch } from "../hooks";
import { clientDetail, clientLabel, clientMatches, startingNote, startingPick } from "../utils/clientSearch";
import { Spinner } from "./ui/Feedback";
import { SearchIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

// Under the matches: searching, a failed search, nothing found, or more matches than shown.
// shown and total count every match listed, the job's own archived client too.
function ListStatus({ search, query, shown, total, onRetry }) {
  if (search.loading) {
    return (
      <p className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted">
        <Spinner className="h-4 w-4" />
        Searching…
      </p>
    );
  }
  if (search.error) {
    return (
      <p className="flex min-h-11 flex-wrap items-center gap-x-2 px-3 py-1 text-sm text-danger">
        Could not search clients. Check your connection.
        <button type="button" onClick={onRetry} className="link min-h-11">
          Try again
        </button>
      </p>
    );
  }
  if (!shown) {
    return (
      <p className="flex min-h-11 flex-wrap items-center gap-x-1.5 px-3 py-1 text-sm text-muted">
        No clients match "{query}".
        <Link to="/clients" className="link inline-flex min-h-11 items-center">
          Add a client
        </Link>
      </p>
    );
  }
  if (total > shown) {
    return (
      <p className="border-t border-border px-3 py-2 text-xs text-muted">
        Showing {shown} of {total}. Type more to narrow it down.
      </p>
    );
  }
  return null;
}

// What a screen reader hears as the matches change.
function announcement(search, query, total) {
  if (search.loading) return "Searching…";
  if (search.error) return "Could not search clients.";
  if (!total) return `No clients match ${query}.`;
  return `${total} ${total === 1 ? "client" : "clients"} found.`;
}

// A client field to type in. Active clients matching the words (name, phone, email, address,
// or notes) are listed under it, each with their address and phone, as two clients can share
// a name. Pick one with a click or a tap, or with the arrow keys and Enter (the first match is
// ready to pick); Escape closes the list. Typing never drops the client already picked: leaving
// the field without picking puts their name back.
//
// start: the client picked to begin with, from startingClient (utils/clientSearch.js). It is
// loaded by id, for its name when only the id came, and to see whether it is archived.
// keepArchived: an archived one stays picked (a job already on that client keeps it), and is
// listed again when what is typed matches it; otherwise it is left unpicked, as new work never
// goes to an archived client.
// name: a hidden input that holds the picked id, for forms read with FormData.
// error: shown under the field while nothing is picked. onChange(client): after each pick.
// ref: the text field, for focusing it.
export default function ClientSearchPicker({
  ref,
  label = "Client",
  name,
  start = null,
  keepArchived = false,
  error,
  onChange,
  autoFocus = false,
  placeholder = "Search by name, phone, or address",
}) {
  const startId = start?.id ?? null;
  const [lookup, setLookup] = useState({ id: null, client: null });
  const [chosen, setChosen] = useState(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const selectedOnFocus = useRef(false);
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const noteId = `${id}-note`;

  // The starting client, by id: null while it loads, false when it could not be loaded.
  useEffect(() => {
    if (!startId) return undefined;
    let cancelled = false;
    api(`/api/clients/${startId}`)
      .then((client) => {
        if (!cancelled) setLookup({ id: startId, client });
      })
      .catch((err) => {
        // Gone (deleted, or not this business's): "missing"; any other failure: false.
        if (!cancelled) setLookup({ id: startId, client: err?.status === 404 ? "missing" : false });
      });
    return () => {
      cancelled = true;
    };
  }, [startId]);

  const loaded = lookup.id === startId ? lookup.client : null;
  const startPick = startingPick(start, loaded, keepArchived);
  const picked = chosen || startPick;
  const pickedId = picked?.id ?? null;
  const query = typing ? text.trim() : "";
  const search = useClientSearch(query);
  // A job's own archived client is never in a search, so it is offered here when it matches,
  // and can be picked again after picking someone else.
  const keep =
    startPick?.archived && !search.loading && !search.error && clientMatches(loaded, query) &&
    !search.items.some((client) => client.id === startPick.id);
  const options = keep ? [...search.items, startPick] : search.items;
  const total = search.total + (keep ? 1 : 0);
  const showList = open && query !== "";
  // The first match is ready to pick until the arrow keys or the mouse choose another.
  const activeIndex = options.length ? Math.max(0, options.findIndex((client) => client.id === activeId)) : -1;
  const optionId = (client) => `${listId}-${client.id}`;

  // A tap outside closes the list: phones keep the field focused, so it does not blur.
  useEffect(() => {
    if (!showList) return undefined;
    function onPointer(event) {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
      if (pickedId !== null) setTyping(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [showList, pickedId]);

  function choose(client) {
    setChosen(client);
    setTyping(false);
    setOpen(false);
    setActiveId(null);
    onChange?.(client);
  }

  // Nothing new was picked: close the list, and show the picked client's name again.
  function putBack() {
    setOpen(false);
    if (picked) setTyping(false);
  }

  function onInput(event) {
    setText(event.target.value);
    setTyping(true);
    setOpen(true);
    setActiveId(null);
  }

  function onKeyDown(event) {
    selectedOnFocus.current = false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!query) return;
      event.preventDefault();
      if (!showList) {
        setOpen(true);
        return;
      }
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + step + options.length) % options.length;
      setActiveId(options[next].id);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      // While the list is open, Enter picks: it never sends the form with a half-typed name.
      if (!showList) return;
      event.preventDefault();
      if (activeIndex >= 0) choose(options[activeIndex]);
    } else if (event.key === "Escape") {
      // Closes the list, then clears what was typed. Only then does Escape close a dialog.
      if (showList) {
        event.preventDefault();
        putBack();
      } else if (typing) {
        event.preventDefault();
        setTyping(false);
      }
    }
  }

  function onFocus(event) {
    if (typing) {
      if (query) setOpen(true);
    } else if (picked) {
      // Selected, so typing replaces the name and starts a new search.
      event.target.select();
      selectedOnFocus.current = true;
    }
  }

  // The click that focuses the field would undo the selection made on focus; a later click
  // in the field places the cursor as usual.
  function onMouseDown(event) {
    if (document.activeElement === event.target) selectedOnFocus.current = false;
  }

  function onMouseUp(event) {
    if (selectedOnFocus.current) event.preventDefault();
    selectedOnFocus.current = false;
  }

  // A press in a field that is already focused (after Escape, or a tap outside on a phone)
  // shows the matches again.
  function onClick() {
    if (typing && query) setOpen(true);
  }

  // Try again leaves the list: focus goes back to the field, not to the page.
  function retry() {
    search.retry();
    rootRef.current?.querySelector("input[role=combobox]")?.focus();
  }

  function onBlur(event) {
    // Focus moved to the list's own link or button: keep it open.
    if (rootRef.current?.contains(event.relatedTarget)) return;
    putBack();
  }

  const invalid = Boolean(error) && !picked;
  const note = invalid ? error : startingNote(start, loaded, picked) || (picked && !typing ? clientDetail(picked) : "");

  return (
    <div ref={rootRef} onBlur={onBlur}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && activeIndex >= 0 ? optionId(options[activeIndex]) : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={note ? noteId : undefined}
          value={typing ? text : clientLabel(picked)}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onClick={onClick}
          placeholder={placeholder}
          maxLength={100}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          className={cx("field min-h-11 pl-9", invalid && "border-danger")}
        />
        {/* A press in the list keeps focus in the field, so a click or tap picks before it blurs. */}
        <div
          hidden={!showList}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
        >
          <ul ref={listRef} id={listId} role="listbox" aria-label={`${label} matches`} className="max-h-80 overflow-y-auto">
            {showList &&
              options.map((client, index) => {
                const detail = clientDetail(client);
                return (
                  <li
                    key={client.id}
                    id={optionId(client)}
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => choose(client)}
                    onMouseEnter={() => setActiveId(client.id)}
                    className={cx(
                      "flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2",
                      index === activeIndex && "bg-surface-2",
                    )}
                  >
                    <span className="truncate text-sm font-medium text-fg">{clientLabel(client)}</span>
                    {detail && <span className="truncate text-xs text-muted">{detail}</span>}
                  </li>
                );
              })}
          </ul>
          {showList && <ListStatus onRetry={retry} search={search} query={query} shown={options.length} total={total} />}
        </div>
      </div>
      {name && <input type="hidden" name={name} value={pickedId ?? ""} />}
      {note && (
        <span id={noteId} className={cx("mt-1.5 block text-xs", invalid ? "font-medium text-danger" : "text-muted")}>
          {note}
        </span>
      )}
      <span role="status" className="sr-only">
        {showList ? announcement(search, query, total) : ""}
      </span>
    </div>
  );
}
