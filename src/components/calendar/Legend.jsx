import { FALLBACK_COLOR, personColor } from "../../utils/color";
import { CheckIcon } from "../ui/Icons";
import { cx } from "../ui/styles";

const HATCH = "repeating-linear-gradient(135deg, var(--muted) 0 2px, transparent 2px 4px)";

function Swatch({ color, hatched, on }) {
  return (
    <span
      aria-hidden="true"
      className={cx("h-2.5 w-2.5 shrink-0 rounded-full", hatched && "rounded-sm")}
      style={hatched ? { backgroundImage: HATCH } : { backgroundColor: on ? color : "var(--border-strong)" }}
    />
  );
}

function chipClass(on) {
  return cx(
    "inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors",
    on
      ? "border-border-strong bg-surface text-fg hover:bg-surface-2"
      : "border-dashed border-border bg-transparent text-subtle line-through hover:text-muted",
  );
}

function Chip({ label, color, hatched = false, on, onToggle, note }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      title={on ? `Hide ${label}` : `Show ${label}`}
      className={cx(chipClass(on), "rounded-full")}
    >
      <Swatch color={color} hatched={hatched} on={on} />
      {label}
      {note && <span className="font-normal text-muted">{note}</span>}
    </button>
  );
}

// A person chip with an "Only" half that shows just this person. The whole chip is
// one pill; the Only half appears on hover or keyboard focus with a mouse, is always
// there on touch screens, and stays visible (as "Only ✓") while it is active.
function PersonChip({ person, on, only, onToggle, onOnly }) {
  const label = person.username;
  return (
    <span
      data-only={only || undefined}
      className={cx(
        "cjt-chip-group inline-flex items-stretch overflow-hidden rounded-full border text-xs font-medium transition-colors",
        only ? "border-primary" : on ? "border-border-strong" : "border-dashed border-border",
      )}
    >
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        title={on ? `Hide ${label}` : `Show ${label}`}
        className={cx(
          "cjt-chip-half inline-flex items-center gap-1.5 py-1 pl-2.5 pr-2.5",
          on ? "bg-surface text-fg hover:bg-surface-2" : "bg-transparent text-subtle line-through hover:text-muted",
        )}
      >
        <Swatch color={personColor(person)} on={on} />
        {label}
        {!person.is_active && <span className="font-normal text-muted">(inactive)</span>}
      </button>
      <button
        type="button"
        aria-pressed={only}
        onClick={onOnly}
        aria-label={only ? `Showing only ${label}. Show everyone again` : `Show only ${label}`}
        title={only ? "Show everyone again" : `Show only ${label}`}
        className={cx(
          "cjt-chip-half cjt-only items-center gap-0.5 border-l px-2 text-[11px] font-semibold",
          only
            ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover"
            : "border-border-strong bg-surface-2 text-muted hover:text-fg",
        )}
      >
        Only
        {only && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
      </button>
    </span>
  );
}

const ACTION = "rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft disabled:pointer-events-none disabled:text-subtle";

// Show or hide each employee, unassigned jobs, and lunch breaks.
// hidden: a Set of "e:<id>", "unassigned", "lunches". onChange(nextHidden).
export default function Legend({ data, hidden, onChange }) {
  if (!data) return null;
  const inRange = new Set([
    ...data.jobs.flatMap((job) => job.assignees.map((person) => person.id)),
    ...data.lunches.map((lunch) => lunch.user.id),
  ]);
  // Inactive employees are listed only when they have something in this range.
  const people = data.employees.filter((person) => person.is_active || inRange.has(person.id));
  const everyone = data.employees.map((person) => `e:${person.id}`);
  const shownPeople = people.filter((person) => !hidden.has(`e:${person.id}`));
  const onlyId = shownPeople.length === 1 && hidden.has("unassigned") ? shownPeople[0].id : null;

  function change(update) {
    const next = new Set(hidden);
    update(next);
    onChange(next);
  }

  const toggle = (key) => change((next) => (next.has(key) ? next.delete(key) : next.add(key)));
  const showAll = () => change((next) => everyone.forEach((key) => next.delete(key)));
  const hideAll = () => change((next) => everyone.forEach((key) => next.add(key)));
  // Only: this one person, without unassigned jobs. Again: everyone (and unassigned) back.
  function only(id) {
    change((next) => {
      everyone.forEach((key) => (onlyId === id ? next.delete(key) : next.add(key)));
      if (onlyId === id) next.delete("unassigned");
      else {
        next.delete(`e:${id}`);
        next.add("unassigned");
      }
    });
  }

  const allShown = everyone.every((key) => !hidden.has(key));
  const noneShown = everyone.every((key) => hidden.has(key));

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Show or hide people">
      {people.length > 0 && (
        <span className="mr-0.5 inline-flex items-center gap-0.5">
          <button type="button" className={ACTION} onClick={showAll} disabled={allShown}>All</button>
          <button type="button" className={ACTION} onClick={hideAll} disabled={noneShown}>None</button>
        </span>
      )}
      {people.map((person) => (
        <PersonChip
          key={person.id}
          person={person}
          on={!hidden.has(`e:${person.id}`)}
          only={onlyId === person.id}
          onToggle={() => toggle(`e:${person.id}`)}
          onOnly={() => only(person.id)}
        />
      ))}
      <Chip label="Unassigned" color={FALLBACK_COLOR} on={!hidden.has("unassigned")} onToggle={() => toggle("unassigned")} />
      <Chip label="Lunch breaks" hatched on={!hidden.has("lunches")} onToggle={() => toggle("lunches")} />
    </div>
  );
}
