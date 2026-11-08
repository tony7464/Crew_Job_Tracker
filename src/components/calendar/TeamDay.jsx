import { useEffect, useRef } from "react";
import { useMediaQuery } from "../../hooks";
import { FALLBACK_COLOR, initials, personColor, readableText } from "../../utils/color";
import { DEFAULT_DURATION, formatClockRange, formatTime } from "../../utils/format";
import { addMinutes, minutesBetween, wallDateTime, wallTime } from "../../utils/time";
import { Avatar } from "../ui/Avatar";
import { CheckIcon, PlusIcon } from "../ui/Icons";
import { cx } from "../ui/styles";

// One person per column (desktop) or one card per person (phones) for a single day.
// Built by hand because FullCalendar's per-person "resource" views are not MIT licensed.

const DAY_MINUTES = 24 * 60;
const HOUR_PX = 56;
const PX_PER_MINUTE = HOUR_PX / 60;
// Space above the first hour line, so its label (centered on the line) is not
// hidden under the sticky header row.
const TOP_PAD = 12;
// Always show at least 6am to 8pm; stretch to fit anything earlier or later.
const FIRST_HOUR = 6;
const LAST_HOUR = 20;
// Short jobs still get a block tall enough to read.
const MIN_BLOCK_MINUTES = 25;
const SNAP_MINUTES = 15;
const NARROW_QUERY = "(max-width: 639px)";
const UNASSIGNED = "unassigned";

function tint(color, amount) {
  return `color-mix(in oklab, ${color} ${amount}%, var(--surface))`;
}

function hourLabel(hour) {
  return new Date(2000, 0, 1, hour % 24).toLocaleTimeString(undefined, { hour: "numeric" });
}

function clockAt(minutes) {
  return wallTime(addMinutes(wallDateTime("2000-01-01", "00:00"), minutes));
}

// Everything on this day, clipped to it, grouped by column key ("e:<id>" or "unassigned").
// A job with several people is in each of their columns.
function itemsByColumn(data, day, hidden) {
  const dayStart = wallDateTime(day, "00:00");
  const columns = new Map();
  const add = (key, item) => {
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(item);
  };
  for (const job of data.jobs) {
    const start = wallDateTime(job.date, job.time);
    const end = addMinutes(start, job.duration_minutes ?? DEFAULT_DURATION);
    const startMin = minutesBetween(dayStart, start);
    const endMin = minutesBetween(dayStart, end);
    if (endMin <= 0 || startMin >= DAY_MINUTES) continue;
    const item = {
      kind: "job",
      key: `job-${job.id}`,
      job,
      startMin: Math.max(0, startMin),
      endMin: Math.min(DAY_MINUTES, endMin),
      fromYesterday: startMin < 0,
    };
    if (!job.assignees.length) {
      if (!hidden.has(UNASSIGNED)) add(UNASSIGNED, item);
      continue;
    }
    for (const person of job.assignees) {
      if (!hidden.has(`e:${person.id}`)) add(`e:${person.id}`, item);
    }
  }
  if (!hidden.has("lunches")) {
    for (const lunch of data.lunches) {
      if (lunch.date !== day || hidden.has(`e:${lunch.user.id}`)) continue;
      const startMin = minutesBetween(dayStart, wallDateTime(day, lunch.start_time));
      const endMin = minutesBetween(dayStart, wallDateTime(day, lunch.end_time));
      add(`e:${lunch.user.id}`, { kind: "lunch", key: `lunch-${lunch.id}`, lunch, startMin, endMin });
    }
  }
  for (const items of columns.values()) {
    items.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.key.localeCompare(b.key));
  }
  return columns;
}

// Side-by-side lanes for items that overlap in one column.
function layoutLanes(items) {
  const placed = [];
  let group = [];
  let lanes = [];
  let groupEnd = -1;
  const close = () => group.forEach((entry) => (entry.lanes = lanes.length));
  for (const item of items) {
    const end = Math.max(item.endMin, item.startMin + MIN_BLOCK_MINUTES);
    if (item.startMin >= groupEnd) {
      close();
      group = [];
      lanes = [];
    }
    let lane = lanes.findIndex((laneEnd) => laneEnd <= item.startMin);
    if (lane === -1) lane = lanes.push(0) - 1;
    lanes[lane] = end;
    const entry = { ...item, lane, lanes: 1 };
    group.push(entry);
    placed.push(entry);
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return placed;
}

function columnsFor(data, hidden, byColumn, mode) {
  const columns = data.employees
    .filter((person) => !hidden.has(`e:${person.id}`))
    // Inactive employees only show on days they still have something.
    .filter((person) => person.is_active || byColumn.has(`e:${person.id}`))
    .map((person) => ({
      key: `e:${person.id}`,
      person,
      label: person.username,
      color: personColor(person),
      items: byColumn.get(`e:${person.id}`) || [],
    }));
  const unassigned = byColumn.get(UNASSIGNED) || [];
  // The owner always gets the column (to add unassigned jobs); others only when it has jobs.
  if (!hidden.has(UNASSIGNED) && (mode === "owner" || unassigned.length)) {
    columns.push({ key: UNASSIGNED, person: null, label: "Unassigned", color: FALLBACK_COLOR, items: unassigned });
  }
  return columns;
}

function jobLabel(item, column) {
  const { job } = item;
  const minutes = job.duration_minutes ?? DEFAULT_DURATION;
  const parts = [
    `${formatTime(job.time)}, ${minutes} minutes`,
    job.kind === "estimate" ? `Estimate visit: ${job.service_type}` : job.service_type,
    job.client_name,
    column.person ? column.person.username : "Unassigned",
    job.status !== "scheduled" ? job.status : null,
  ];
  return parts.filter(Boolean).join(", ");
}

// The rest of the crew on a job, as small initials in their own colors.
function Crewmates({ job, except }) {
  const others = job.assignees.filter((person) => person.id !== except);
  if (!others.length) return null;
  return (
    <span className="cjt-dots" title={`With ${others.map((person) => person.username).join(", ")}`}>
      {others.slice(0, 3).map((person) => {
        const color = personColor(person);
        return (
          <span key={person.id} style={{ backgroundColor: color, color: readableText(color) }}>
            {initials(person.username)}
          </span>
        );
      })}
      {others.length > 3 && <span className="cjt-dots-more">+{others.length - 3}</span>}
    </span>
  );
}

function JobTitle({ job }) {
  return (
    <span className="cjt-ev-title">
      {job.status === "completed" && <CheckIcon className="cjt-check" />}
      {job.kind === "estimate" && "Estimate · "}
      {job.service_type}
    </span>
  );
}

function jobTimes(item) {
  const { job } = item;
  const end = clockAt(item.endMin);
  return item.fromYesterday ? `until ${formatTime(end)}` : `${formatTime(job.time)} – ${formatTime(end)}`;
}

// ---- Desktop: columns --------------------------------------------------------

function Block({ item, column, startHour, onJobClick, onLunchClick }) {
  const top = TOP_PAD + (item.startMin - startHour * 60) * PX_PER_MINUTE;
  const height = Math.max(item.endMin - item.startMin, MIN_BLOCK_MINUTES) * PX_PER_MINUTE - 2;
  const position = {
    top,
    height,
    left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
    width: `calc(${100 / item.lanes}% - 4px)`,
  };
  if (item.kind === "lunch") {
    return (
      <button
        type="button"
        className="cjt-team-ev cjt-team-lunch"
        style={{ ...position, "--ev": column.color, borderColor: column.color }}
        onClick={(event) => {
          event.stopPropagation();
          onLunchClick(item.lunch);
        }}
        aria-label={`Lunch break, ${formatClockRange(item.lunch.start_time, item.lunch.end_time)}, ${column.label}`}
      >
        <span className="cjt-hatch cjt-team-lunch-text">
          <span className="cjt-ev-title">Lunch</span>
          <span className="cjt-ev-time">{formatClockRange(item.lunch.start_time, item.lunch.end_time)}</span>
        </span>
      </button>
    );
  }
  const { job } = item;
  const cancelled = job.status === "cancelled";
  return (
    <button
      type="button"
      className={cx("cjt-team-ev", `cjt-${job.status}`, !column.person && "cjt-team-open", job.kind === "estimate" && "cjt-estimate")}
      style={{ ...position, backgroundColor: tint(column.color, cancelled ? 8 : 18), borderLeftColor: column.color }}
      onClick={(event) => {
        event.stopPropagation();
        onJobClick(job);
      }}
      aria-label={jobLabel(item, column)}
    >
      <span className="cjt-ev">
        <span className="cjt-ev-head">
          <span className="cjt-ev-time">{jobTimes(item)}</span>
          <Crewmates job={job} except={column.person?.id} />
        </span>
        <JobTitle job={job} />
        {job.client_name && <span className="cjt-ev-sub">{job.client_name}</span>}
      </span>
    </button>
  );
}

function Columns({ day, columns, startHour, endHour, nowMinutes, canCreate, onJobClick, onLunchClick, onCreate }) {
  const scroller = useRef(null);
  const height = TOP_PAD + (endHour - startHour) * HOUR_PX;
  const firstItem = Math.min(...columns.flatMap((column) => column.items.map((item) => item.startMin)), 8 * 60);
  const scrollTo = nowMinutes != null ? Math.min(firstItem, Math.max(nowMinutes - 60, startHour * 60)) : firstItem;

  // Open the day near its first job (or the current time), not at 6am every time.
  // Scroll to a whole hour, so the top label sits fully below the header.
  const topHour = Math.max(startHour, Math.floor((scrollTo - 30) / 60));
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = (topHour - startHour) * HOUR_PX;
  }, [day, topHour, startHour]);

  function createAt(event, column) {
    if (!canCreate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = startHour * 60 + (event.clientY - rect.top - TOP_PAD) / PX_PER_MINUTE;
    const snapped = Math.min(DAY_MINUTES - SNAP_MINUTES, Math.max(0, Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES));
    onCreate({ time: clockAt(snapped), employeeId: column.person?.id ?? null });
  }

  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const nowTop = nowMinutes != null ? TOP_PAD + (nowMinutes - startHour * 60) * PX_PER_MINUTE : null;
  const showNow = nowTop != null && nowTop >= TOP_PAD && nowTop <= height;

  return (
    <div ref={scroller} className="cjt-team" data-noswipe>
      <div
        className="cjt-team-grid"
        style={{ gridTemplateColumns: `3.75rem repeat(${columns.length}, minmax(9.5rem, 1fr))` }}
      >
        <div className="cjt-team-corner" />
        {columns.map((column) => (
          <div key={column.key} className="cjt-team-head">
            {column.person ? (
              <Avatar person={column.person} size="sm" />
            ) : (
              <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-border-strong" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fg">{column.label}</span>
              <span className="block text-[11px] text-muted">{summary(column.items)}</span>
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={() => onCreate({ time: null, employeeId: column.person?.id ?? null })}
                aria-label={column.person ? `New job for ${column.label}` : "New unassigned job"}
                title={column.person ? `New job for ${column.label}` : "New unassigned job"}
                className="rounded-md p-1 text-muted hover:bg-surface-3 hover:text-fg"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <div className="cjt-team-gutter" style={{ height }}>
          {hours.map((hour) => (
            <span key={hour} className="cjt-team-hour" style={{ top: TOP_PAD + (hour - startHour) * HOUR_PX }}>
              {hourLabel(hour)}
            </span>
          ))}
          {showNow && <span className="cjt-team-now-dot" style={{ top: nowTop }} aria-hidden="true" />}
        </div>
        {columns.map((column) => (
          <div
            key={column.key}
            className={cx("cjt-team-col", canCreate && "cursor-cell")}
            style={{ height, "--hour": `${HOUR_PX}px`, "--pad": `${TOP_PAD}px` }}
            onClick={(event) => createAt(event, column)}
          >
            {layoutLanes(column.items).map((item) => (
              <Block
                key={item.key}
                item={item}
                column={column}
                startHour={startHour}
                onJobClick={onJobClick}
                onLunchClick={onLunchClick}
              />
            ))}
            {showNow && <span className="cjt-team-now" style={{ top: nowTop }} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function summary(items) {
  const jobs = items.filter((item) => item.kind === "job" && item.job.status !== "cancelled").length;
  if (!items.length) return "Free";
  const lunch = items.some((item) => item.kind === "lunch");
  return [`${jobs} ${jobs === 1 ? "job" : "jobs"}`, lunch && "lunch"].filter(Boolean).join(" · ");
}

// ---- Phones: one card per person --------------------------------------------

function CardRow({ item, column, onJobClick, onLunchClick }) {
  if (item.kind === "lunch") {
    return (
      <li>
        <button
          type="button"
          onClick={() => onLunchClick(item.lunch)}
          className="cjt-team-row cjt-team-row-lunch"
          style={{ "--ev": column.color }}
        >
          <span className="cjt-team-row-time">{formatTime(item.lunch.start_time)}</span>
          <span className="min-w-0 flex-1 text-muted">
            Lunch <span className="text-xs">· {formatClockRange(item.lunch.start_time, item.lunch.end_time)}</span>
          </span>
        </button>
      </li>
    );
  }
  const { job } = item;
  return (
    <li>
      <button
        type="button"
        onClick={() => onJobClick(job)}
        className={cx("cjt-team-row", `cjt-${job.status}`)}
        aria-label={jobLabel(item, column)}
      >
        <span className="cjt-team-row-time">
          {item.fromYesterday ? "…" : formatTime(job.time)}
          <span className="block text-[11px] font-normal text-muted">{formatTime(clockAt(item.endMin))}</span>
        </span>
        <span className="cjt-team-row-bar" style={{ backgroundColor: column.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <JobTitle job={job} />
          {job.client_name && <span className="cjt-ev-sub block">{job.client_name}</span>}
        </span>
        <Crewmates job={job} except={column.person?.id} />
      </button>
    </li>
  );
}

function NowRow({ minutes }) {
  return (
    <li className="cjt-team-row-now" aria-label={`Now, ${formatTime(clockAt(minutes))}`}>
      <span>Now · {formatTime(clockAt(minutes))}</span>
    </li>
  );
}

function Cards({ columns, nowMinutes, canCreate, onJobClick, onLunchClick, onCreate }) {
  const busy = columns.filter((column) => column.items.length);
  const free = columns.filter((column) => !column.items.length && column.person);
  return (
    <div className="space-y-3">
      {busy.map((column) => {
        // The "Now" row goes before the first item that starts later, while anything is still ahead.
        const showNow = nowMinutes != null && column.items.some((item) => item.endMin > nowMinutes);
        const later = showNow ? column.items.findIndex((item) => item.startMin > nowMinutes) : -1;
        const nowIndex = later === -1 ? column.items.length : later;
        return (
          <section key={column.key} className="overflow-hidden rounded-xl border border-border bg-surface">
            <header className="flex items-center gap-2.5 border-b border-border bg-surface-2 px-3 py-2">
              {column.person ? (
                <Avatar person={column.person} size="md" />
              ) : (
                <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full border-2 border-dashed border-border-strong" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">{column.label}</span>
                <span className="block text-xs text-muted">{summary(column.items)}</span>
              </span>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => onCreate({ time: null, employeeId: column.person?.id ?? null })}
                  aria-label={column.person ? `New job for ${column.label}` : "New unassigned job"}
                  className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-fg"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </header>
            <ul className="divide-y divide-border">
              {column.items.map((item, index) => [
                showNow && index === nowIndex ? <NowRow key="now" minutes={nowMinutes} /> : null,
                <CardRow key={item.key} item={item} column={column} onJobClick={onJobClick} onLunchClick={onLunchClick} />,
              ])}
              {showNow && nowIndex === column.items.length && <NowRow minutes={nowMinutes} />}
            </ul>
          </section>
        );
      })}
      {free.length > 0 && (
        <div className="rounded-xl border border-dashed border-border-strong px-3 py-2.5">
          <p className="text-xs font-medium text-muted">Nothing scheduled</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {free.map((column) => {
              const Tag = canCreate ? "button" : "span";
              return (
                <Tag
                  key={column.key}
                  {...(canCreate
                    ? {
                        type: "button",
                        onClick: () => onCreate({ time: null, employeeId: column.person.id }),
                        "aria-label": `New job for ${column.label}`,
                      }
                    : {})}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-sm",
                    canCreate && "hover:bg-surface-3",
                  )}
                >
                  <Avatar person={column.person} size="xs" />
                  {column.label}
                  {canCreate && <PlusIcon className="h-3.5 w-3.5 text-muted" />}
                </Tag>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// day: "YYYY-MM-DD". data: the /api/schedule/team payload. hidden: as in Legend.
// mode "owner" may add jobs (onCreate({ date, time, employeeId })); "admin" is read-only.
// now: the business wall-clock now (see utils/time), for the "now" line on today.
export default function TeamDay({ day, today, now, data, hidden, mode, onJobClick, onLunchClick, onCreate }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  if (!data) return null;
  const byColumn = itemsByColumn(data, day, hidden);
  const columns = columnsFor(data, hidden, byColumn, mode);
  const canCreate = mode === "owner" && Boolean(onCreate);
  const create = (slot) => onCreate({ date: day, ...slot });

  if (!columns.length) {
    return (
      <div className="cjt-empty rounded-xl border border-dashed border-border-strong">
        <p className="cjt-empty-title">Nobody to show</p>
        <p>{data.employees.length ? "Everyone is hidden. Use All above to show the whole crew." : "Add employees on the Employees page to see them here."}</p>
      </div>
    );
  }

  const nowMinutes = day === today ? minutesBetween(wallDateTime(day, "00:00"), now) : null;
  const all = columns.flatMap((column) => column.items);
  // On today, the hours always include the current time so the "now" line shows.
  const nowHours = nowMinutes == null ? [] : [Math.floor(nowMinutes / 60)];
  const startHour = Math.min(FIRST_HOUR, ...nowHours, ...all.map((item) => Math.floor(item.startMin / 60)));
  const endHour = Math.min(
    24,
    Math.max(LAST_HOUR, ...nowHours.map((hour) => hour + 1), ...all.map((item) => Math.ceil(item.endMin / 60))),
  );
  const props = { columns, nowMinutes, canCreate, onJobClick, onLunchClick, onCreate: create };

  if (narrow) return <Cards {...props} />;
  return <Columns day={day} startHour={startHour} endHour={endHour} {...props} />;
}
