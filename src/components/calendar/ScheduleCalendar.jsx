import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery, useMinuteClock, useSwipe } from "../../hooks";
import { FALLBACK_COLOR, initials, personColor, readableText } from "../../utils/color";
import { DEFAULT_DURATION } from "../../utils/format";
import {
  addDays,
  addMinutes,
  businessNow,
  businessToday,
  minutesBetween,
  wallDate,
  wallDateTime,
  wallTime,
  weekStart,
} from "../../utils/time";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "../ui/Icons";
import { cx } from "../ui/styles";

const VIEWS = [
  ["timeGridDay", "Day"],
  ["timeGridWeek", "Week"],
  ["dayGridMonth", "Month"],
  ["listWeek", "List"],
];
const NOTHING_HIDDEN = new Set();
// Column headers: "Monday, Nov 2" for a day, "Mon" for a month, "Mon 2" for a week.
const HEADER_FORMATS = {
  timeGridDay: { weekday: "long", month: "short", day: "numeric" },
  dayGridMonth: { weekday: "short" },
  default: { weekday: "short", day: "numeric" },
};
// Each half-hour slot is 2.25rem (36px). 860px fits the day headers plus 7am to just past 6pm.
const DESKTOP_GRID_HEIGHT = 860;
const PHONE_GRID_HEIGHT = 560;
// Month cells list start times only, at most three jobs, then "+N more".
const MONTH_OPTIONS = {
  dayGridMonth: {
    eventDisplay: "list-item",
    displayEventEnd: false,
    eventTimeFormat: { hour: "numeric", minute: "2-digit", meridiem: "narrow" },
  },
};
const PHONE_QUERY = "(max-width: 639px)";
const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin];
// Shade the hours outside a normal working day; the whole day stays reachable.
const WORKING_HOURS = { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "06:00", endTime: "20:00" };

function tint(color, amount) {
  return `color-mix(in oklab, ${color} ${amount}%, var(--surface))`;
}

// The color a job is drawn in: the first assignee still shown (owner), or the
// employee's own color (employee view). Unassigned jobs are grey.
function jobColor(job, { selfId, hidden }) {
  if (selfId) return personColor(job.assignees.find((person) => person.id === selfId));
  const shown = job.assignees.find((person) => !hidden.has(`e:${person.id}`));
  return shown ? personColor(shown) : FALLBACK_COLOR;
}

function jobVisible(job, hidden) {
  if (!job.assignees.length) return !hidden.has("unassigned");
  return job.assignees.some((person) => !hidden.has(`e:${person.id}`));
}

// month: the month view, which leaves lunch breaks out to stay readable.
// mode: "owner" and "admin" see the whole team (filtered by hidden); only the owner
// can drag jobs. "employee" sees their own jobs and drags their own lunches.
function buildEvents(data, { mode, selfId, hidden, month }) {
  if (!data) return [];
  const team = mode !== "employee";
  const owner = mode === "owner";
  const jobs = data.jobs
    .filter((job) => !team || jobVisible(job, hidden))
    .map((job) => {
      const color = jobColor(job, { selfId: team ? null : selfId, hidden });
      const start = wallDateTime(job.date, job.time);
      return {
        id: `job-${job.id}`,
        start,
        end: addMinutes(start, job.duration_minutes ?? DEFAULT_DURATION),
        title: job.service_type,
        backgroundColor: tint(color, job.status === "cancelled" ? 8 : 18),
        borderColor: color,
        textColor: "var(--text)",
        classNames: ["cjt-job", `cjt-${job.status}`],
        editable: owner,
        extendedProps: { kind: "job", job, color },
      };
    });
  if (month) return jobs;
  const lunches = data.lunches
    .filter((lunch) => !team || (!hidden.has("lunches") && !hidden.has(`e:${lunch.user.id}`)))
    .map((lunch) => {
      const color = personColor(lunch.user);
      return {
        id: `lunch-${lunch.id}`,
        start: wallDateTime(lunch.date, lunch.start_time),
        end: wallDateTime(lunch.date, lunch.end_time),
        title: team ? `Lunch · ${lunch.user.username}` : "Lunch",
        backgroundColor: tint(color, 6),
        borderColor: color,
        textColor: "var(--muted)",
        classNames: ["cjt-lunch"],
        // Lunches belong to the employee; the owner and client-admins only see them.
        editable: !team,
        extendedProps: { kind: "lunch", lunch, color },
      };
    });
  return [...jobs, ...lunches];
}

function EmptyList({ mode }) {
  return (
    <div className="cjt-empty">
      <p className="cjt-empty-title">Nothing scheduled this week</p>
      <p>
        {mode === "owner"
          ? "Use the arrows to look at other weeks, or switch to Day or Week and click a time to add a job."
          : mode === "admin"
            ? "Use the arrows to look at other weeks. Jobs for the whole crew show up here."
            : "Use the arrows to look at other weeks. Jobs you are assigned and your lunch breaks show up here."}
      </p>
    </div>
  );
}

function CrewDots({ people }) {
  if (!people?.length) return null;
  return (
    <span className="cjt-dots">
      {people.slice(0, 4).map((person) => {
        const color = personColor(person);
        return (
          <span key={person.id} title={person.username} style={{ backgroundColor: color, color: readableText(color) }}>
            {initials(person.username)}
          </span>
        );
      })}
      {people.length > 4 && <span className="cjt-dots-more">+{people.length - 4}</span>}
    </span>
  );
}

function renderEvent(arg) {
  const { kind, job, color } = arg.event.extendedProps;
  const view = arg.view.type;

  // The placeholder FullCalendar draws while a time range is being selected.
  if (!kind) {
    return (
      <div className="cjt-ev">
        <span className="cjt-ev-time">{arg.timeText}</span>
        <span className="cjt-ev-title">New</span>
      </div>
    );
  }

  if (kind === "lunch") {
    if (view.startsWith("list")) return <span className="cjt-ev-title">{arg.event.title}</span>;
    return (
      <div className="cjt-hatch" style={{ "--ev": color }}>
        <span className="cjt-ev-time">{arg.timeText}</span>
        <span className="cjt-ev-title">{arg.event.title}</span>
      </div>
    );
  }

  const done = job.status === "completed";
  const title = (
    <span className="cjt-ev-title">
      {done && <CheckIcon className="cjt-check" />}
      {job.service_type}
    </span>
  );

  if (view.startsWith("list")) {
    return (
      <span className="cjt-list-row">
        <span>
          {title}
          {job.client_name && <span className="cjt-ev-sub"> · {job.client_name}</span>}
        </span>
        <CrewDots people={job.assignees} />
      </span>
    );
  }
  // Month: one compact line per job, a dot in the crew color, the start time, the service.
  if (view.startsWith("dayGrid")) {
    return (
      <span className="cjt-month-row" title={`${job.service_type}${job.client_name ? ` · ${job.client_name}` : ""}`}>
        <span className="cjt-month-dot" style={{ backgroundColor: color }} />
        <span className="cjt-ev-time">{arg.timeText}</span>
        {title}
      </span>
    );
  }
  return (
    <div className="cjt-ev">
      <div className="cjt-ev-head">
        <span className="cjt-ev-time">{arg.timeText}</span>
        <CrewDots people={job.assignees} />
      </div>
      {title}
      {job.client_name && <span className="cjt-ev-sub">{job.client_name}</span>}
    </div>
  );
}

function dayTitle(day) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// Seven days (Sunday to Saturday) around the day being shown. Tap one to jump to it.
function DayStrip({ day, today, onPick }) {
  const start = weekStart(day);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return (
    <div role="group" aria-label="Pick a day this week" className="mb-3 grid grid-cols-7 gap-1">
      {days.map((value) => {
        const date = new Date(`${value}T12:00:00Z`);
        const selected = value === day;
        const isToday = value === today;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            aria-pressed={selected}
            aria-current={isToday ? "date" : undefined}
            aria-label={date.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}
            className={cx(
              "flex flex-col items-center rounded-lg py-1.5 text-xs transition-colors",
              selected ? "bg-primary text-primary-fg shadow-card" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {date.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short" })}
            </span>
            <span className={cx("text-base font-semibold leading-tight", !selected && "text-fg")}>
              {date.getUTCDate()}
            </span>
            <span
              aria-hidden="true"
              className={cx("mt-0.5 h-1 w-1 rounded-full", isToday ? (selected ? "bg-primary-fg" : "bg-primary") : "bg-transparent")}
            />
          </button>
        );
      })}
    </div>
  );
}

const DAY_VIEWS = new Set(["timeGridDay", "teamDay"]);

// The shared schedule calendar for the owner dashboard, the team Schedule page, and
// the employee Calendar page.
//
// mode: "owner" (all jobs, drag and resize jobs, lunches read-only), "admin" (all jobs,
// read-only, for client-admins), or "employee" (assigned jobs read-only, drag and resize
// own lunches).
// data: the schedule payload. onRangeChange({ start, end }) asks for a new range.
// onSelect({ date, time, minutes, allDay }) is called for a click or drag on empty time.
// onJobMove(job, patch) and onLunchMove(lunch, patch) save a drag; if they throw, the move is undone.
// views: [[type, label]] for the view buttons. customViews: { type: ({ day, today, now }) => node }
// for views drawn without FullCalendar (one day at a time). initialView and initialDate
// pick where to start; onViewChange(type) is called when the person picks another view.
// fallbackView: where to start on a phone when initialView is Week (default: List).
//
// Phones never offer Week: seven columns are too narrow to read there. A saved Week
// view starts on fallbackView instead, without calling onViewChange, so the saved
// choice still applies on wider screens. The calendar starts again when the screen
// crosses the phone width, so the view buttons always match it.
export default function ScheduleCalendar(props) {
  const phone = useMediaQuery(PHONE_QUERY);
  return <Calendar key={phone ? "phone" : "wide"} phone={phone} {...props} />;
}

function Calendar({
  phone,
  mode,
  timezone,
  data,
  loading = false,
  hidden = NOTHING_HIDDEN,
  selfId = null,
  views = VIEWS,
  customViews = {},
  initialView: startView,
  fallbackView = "listWeek",
  initialDate,
  onViewChange,
  onRangeChange,
  onJobClick,
  onLunchClick,
  onSelect,
  onJobMove,
  onLunchMove,
  onMoveError,
  children,
}) {
  const ref = useRef(null);
  const now = useCallback(() => businessNow(timezone), [timezone]);
  const today = businessToday(timezone);
  const shownViews = phone ? views.filter(([type]) => type !== "timeGridWeek") : views;
  // Phones open on the list of this week's jobs (a single day is often empty) unless
  // the page asks for another view.
  const [initialView] = useState(() => {
    const wanted = startView || (phone ? fallbackView : "timeGridWeek");
    return shownViews.some(([type]) => type === wanted) ? wanted : fallbackView;
  });
  const [view, setView] = useState({ type: initialView, title: "" });
  // The day being looked at: the shown day in day views, a day in the shown range otherwise.
  const [day, setDay] = useState(() => initialDate || today);
  // Where FullCalendar starts each time it is (re)created, for example after a custom view.
  const [fcStart, setFcStart] = useState({ type: initialView, date: initialDate || today, key: 0 });
  const renderCustom = customViews[view.type];
  const custom = Boolean(renderCustom);
  const month = view.type === "dayGridMonth";
  const events = useMemo(
    () => buildEvents(data, { mode, selfId, hidden, month }),
    [data, mode, selfId, hidden, month],
  );
  const api = () => ref.current?.getApi();
  const minuteNow = useMinuteClock(now);

  // Custom views load the whole week around the day, so moving between days is instant.
  const weekFrom = custom ? weekStart(day) : null;
  useEffect(() => {
    if (weekFrom) onRangeChange({ start: weekFrom, end: addDays(weekFrom, 6) });
  }, [weekFrom, onRangeChange]);

  function handleDatesSet(info) {
    setView({ type: info.view.type, title: info.view.title });
    const start = wallDate(info.view.currentStart);
    const last = wallDate(addMinutes(info.view.currentEnd, -1));
    // Keep today as "the day" while it is in range, so Team and Day open on it.
    setDay((current) => (current >= start && current <= last ? current : today >= start && today <= last ? today : start));
    // FullCalendar's end is exclusive; the API wants the last day.
    onRangeChange({ start: wallDate(info.start), end: wallDate(addMinutes(info.end, -1)) });
  }

  // date: the day to show, or the current one.
  function changeView(type, date = day) {
    if (type === view.type && date === day) return;
    if (customViews[type]) {
      setDay(date);
      setView({ type, title: "" });
    } else if (custom) {
      setFcStart((current) => ({ type, date, key: current.key + 1 }));
      setView({ type, title: "" });
    } else {
      api()?.changeView(type, date);
    }
    if (type !== view.type) onViewChange?.(type);
  }

  function step(direction) {
    if (custom) setDay((current) => addDays(current, direction));
    else if (direction < 0) api()?.prev();
    else api()?.next();
  }

  function goToday() {
    if (custom) setDay(today);
    else api()?.today();
  }

  function pickDay(value) {
    if (custom) setDay(value);
    else api()?.gotoDate(value);
  }

  const swipe = useSwipe({ onPrev: () => step(-1), onNext: () => step(1), enabled: DAY_VIEWS.has(view.type) });

  function handleEventClick(info) {
    info.jsEvent.preventDefault();
    const { kind, job, lunch } = info.event.extendedProps;
    if (kind === "job") onJobClick?.(job);
    else onLunchClick?.(lunch);
  }

  async function handleChange(info) {
    const { kind, job, lunch } = info.event.extendedProps;
    const { start, end } = info.event;
    try {
      if (kind === "job") {
        await onJobMove(job, {
          date: wallDate(start),
          time: wallTime(start),
          duration_minutes: minutesBetween(start, end),
        });
      } else {
        await onLunchMove(lunch, { date: wallDate(start), start_time: wallTime(start), end_time: wallTime(end) });
      }
    } catch (err) {
      info.revert();
      onMoveError?.(err);
    }
  }

  function handleSelect(info) {
    api()?.unselect();
    onSelect?.({
      date: wallDate(info.start),
      time: info.allDay ? null : wallTime(info.start),
      minutes: info.allDay ? null : minutesBetween(info.start, info.end),
      allDay: info.allDay,
    });
  }

  const timeGrid = view.type.startsWith("timeGrid");
  const dayView = DAY_VIEWS.has(view.type);
  const title = custom ? dayTitle(day) : view.title;

  return (
    <div className="cjt-calendar">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={goToday} className="cjt-tool h-9 px-3 text-sm font-medium">
            Today
          </button>
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className="cjt-tool h-9 w-9">
            <ChevronLeftIcon />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className="cjt-tool h-9 w-9">
            <ChevronRightIcon />
          </button>
        </div>
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg" aria-live="polite">
          {title}
          {loading && <span className="ml-2 text-xs font-normal text-muted">Loading…</span>}
        </h3>
        <div role="group" aria-label="Calendar view" className="flex w-full rounded-lg bg-surface-2 p-0.5 sm:w-auto">
          {shownViews.map(([type, label]) => (
            <button
              key={type}
              type="button"
              aria-pressed={view.type === type}
              onClick={() => changeView(type)}
              className={cx(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                view.type === type ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {children}
      {dayView && Object.keys(customViews).length > 0 && <DayStrip day={day} today={today} onPick={pickDay} />}
      <div
        className={dayView ? "touch-pan-y" : undefined}
        onPointerDown={swipe.onPointerDown}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
      >
        {custom ? (
          renderCustom({ day, today, now: minuteNow })
        ) : (
          <FullCalendar
            key={fcStart.key}
            ref={ref}
            plugins={PLUGINS}
            initialView={fcStart.type}
            initialDate={fcStart.date}
            headerToolbar={false}
            timeZone="UTC"
            now={now}
            nowIndicator
            firstDay={0}
            contentHeight={timeGrid ? (phone ? PHONE_GRID_HEIGHT : DESKTOP_GRID_HEIGHT) : "auto"}
            allDaySlot={false}
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime="07:00:00"
            businessHours={WORKING_HOURS}
            slotEventOverlap={false}
            expandRows={false}
            dayMaxEvents={3}
            eventDisplay="block"
            displayEventEnd
            dayHeaderFormat={HEADER_FORMATS[view.type] || HEADER_FORMATS.default}
            slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
            listDayFormat={{ weekday: "long", month: "short", day: "numeric" }}
            listDaySideFormat={false}
            noEventsContent={() => <EmptyList mode={mode} />}
            views={MONTH_OPTIONS}
            events={events}
            eventContent={renderEvent}
            eventClick={handleEventClick}
            eventDrop={handleChange}
            eventResize={handleChange}
            eventDurationEditable
            selectable={Boolean(onSelect)}
            selectMirror
            select={handleSelect}
            selectLongPressDelay={300}
            eventLongPressDelay={300}
            datesSet={handleDatesSet}
            navLinks
            navLinkDayClick={(date) => changeView("timeGridDay", wallDate(date))}
          />
        )}
      </div>
    </div>
  );
}
