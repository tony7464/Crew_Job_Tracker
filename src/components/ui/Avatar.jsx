import { initials, personColor, readableText } from "../../utils/color";
import { cx } from "./styles";

const SIZES = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-11 w-11 text-sm",
};

// A colored circle with initials. person: { name, color }.
export function Avatar({ person, size = "md", className }) {
  const color = personColor(person);
  return (
    <span
      title={person?.name}
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color, color: readableText(color) }}
    >
      {initials(person?.name)}
    </span>
  );
}

// Overlapping avatars with the names for screen readers.
export function AvatarStack({ people, size = "sm", max = 4 }) {
  if (!people?.length) return <span className="text-sm text-subtle">—</span>;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="inline-flex items-center">
      <span className="sr-only">{people.map((person) => person.name).join(", ")}</span>
      <span className="flex -space-x-1">
        {shown.map((person) => (
          <Avatar key={person.id} person={person} size={size} className="ring-2 ring-surface" />
        ))}
      </span>
      {extra > 0 && <span className="ml-1.5 text-xs text-muted" aria-hidden="true">+{extra}</span>}
    </span>
  );
}

// "● name" chips for a crew list.
export function PersonChips({ people, empty = "Nobody assigned" }) {
  if (!people?.length) return <span className="text-sm text-muted">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {people.map((person) => (
        <span
          key={person.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-sm"
        >
          <Avatar person={person} size="xs" />
          {person.name}
        </span>
      ))}
    </span>
  );
}
