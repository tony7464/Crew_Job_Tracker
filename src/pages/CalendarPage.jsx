import { lazy, Suspense, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import CalendarLinks from "../components/CalendarLinks";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import LunchForm from "../components/LunchForm";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PlusIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { useAsync, useSchedule } from "../hooks";
import { personColor } from "../utils/color";
import { formatClockRange, formatDay, prettyTimeZone } from "../utils/format";
import { addDays, addToTime, businessToday } from "../utils/time";

// FullCalendar is the largest dependency; load it only on pages with a calendar.
const ScheduleCalendar = lazy(() => import("../components/calendar/ScheduleCalendar"));

const DEFAULT_LUNCH = { start_time: "12:00", end_time: "12:30" };
// A single click on the time grid selects one 30-minute slot.
const CLICK_MINUTES = 30;
const UPCOMING_DAYS = 14;

const STEPS = [
  ["Google Calendar", "Tap Add to Google Calendar and confirm. On a phone, open it once in a browser while signed in to Google."],
  ["iPhone, iPad, or Mac", "Tap Subscribe in Apple Calendar and confirm."],
  ["Other apps", "Copy the feed URL and add it as a calendar subscription (sometimes called “From URL”)."],
];

function LegendKey({ color }) {
  return (
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border-l-[3px]" style={{ borderColor: color, backgroundColor: `color-mix(in oklab, ${color} 18%, var(--surface))` }} />
        Your jobs (tap to open)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded-sm border border-dashed"
          style={{ borderColor: color, backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 35%, transparent) 0 2px, transparent 2px 4px)` }}
        />
        Your lunch breaks (tap to edit, drag to move)
      </span>
    </div>
  );
}

function UpcomingLunches({ lunches, error, onEdit }) {
  if (error) return <ErrorMessage error={error} />;
  if (!lunches) return <Loading variant="list" />;
  if (!lunches.length) {
    return <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">No lunch breaks in the next two weeks.</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {lunches.map((lunch) => (
        <li key={lunch.id}>
          <button
            type="button"
            onClick={() => onEdit(lunch)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
          >
            <span>
              <span className="block font-medium">{formatDay(lunch.date, "long")}</span>
              <span className="text-muted">{formatClockRange(lunch.start_time, lunch.end_time)}</span>
            </span>
            <span className="text-sm font-medium text-primary">Edit</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const schedule = useSchedule(range, reloadKey);
  const links = useAsync(api, "/api/me/calendar");
  const zone = schedule.data?.timezone || user.timezone;
  const today = businessToday(zone);
  const upcoming = useAsync(api, `/api/me/lunches?start=${today}&end=${addDays(today, UPCOMING_DAYS - 1)}`, reloadKey);
  // { lunch } to edit, { initial } to add. ?addLunch=1 opens the add form.
  const [form, setForm] = useState(() =>
    searchParams.get("addLunch") ? { initial: { date: today, ...DEFAULT_LUNCH } } : null,
  );
  const [moveError, setMoveError] = useState(null);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function closeForm() {
    setForm(null);
    if (searchParams.size) setSearchParams({}, { replace: true });
  }

  function changeRange(next) {
    setRange((current) => (current && current.start === next.start && current.end === next.end ? current : next));
  }

  async function moveLunch(lunch, patch) {
    setMoveError(null);
    await api(`/api/me/lunches/${lunch.id}`, { method: "PATCH", body: patch });
    reload();
  }

  function addFromCalendar({ date, time, minutes, allDay }) {
    if (allDay || !time) {
      setForm({ initial: { date, ...DEFAULT_LUNCH } });
      return;
    }
    const length = minutes && minutes > CLICK_MINUTES ? minutes : CLICK_MINUTES;
    setForm({ initial: { date, start_time: time, end_time: addToTime(time, length) || "23:59" } });
  }

  async function regenerate() {
    links.setData(await api("/api/me/calendar/regenerate", { method: "POST" }));
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Calendar"
        description={`Your jobs and lunch breaks. Times are ${prettyTimeZone(zone)} time.`}
        actions={
          <Button onClick={() => setForm({ initial: { date: today, ...DEFAULT_LUNCH } })}>
            <PlusIcon />
            Add lunch
          </Button>
        }
      />
      <Card title="My schedule">
        <ErrorMessage error={schedule.error || moveError} className="mb-3" />
        <Suspense fallback={<Loading label="Loading calendar…" />}>
          <ScheduleCalendar
            mode="employee"
            timezone={zone}
            data={schedule.data}
            loading={schedule.loading}
            selfId={user.id}
            onRangeChange={changeRange}
            onJobClick={(job) => navigate(`/my-jobs/${job.id}`)}
            onLunchClick={(lunch) => setForm({ lunch })}
            onSelect={addFromCalendar}
            onLunchMove={moveLunch}
            onMoveError={setMoveError}
          >
            <LegendKey color={personColor(user)} />
          </ScheduleCalendar>
        </Suspense>
      </Card>
      <Card title="Upcoming lunch breaks" description="The next two weeks.">
        <UpcomingLunches lunches={upcoming.data} error={upcoming.error} onEdit={(lunch) => setForm({ lunch })} />
      </Card>
      <Card
        title="Subscribe on your phone"
        description="Subscribe once and your assigned jobs show up in your phone or computer calendar. Calendar apps check for changes every few hours."
      >
        {links.error ? (
          <ErrorMessage error={links.error} />
        ) : !links.data ? (
          <Loading />
        ) : (
          <CalendarLinks links={links.data} onRegenerate={regenerate} />
        )}
        <ol className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg">
                {index + 1}
              </span>
              <span>
                <span className="block font-medium text-fg">{title}</span>
                <span className="text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-muted">
          Keep this link private. Anyone with it can see your job schedule. If it gets shared by mistake, make a new
          link; the old one stops working. The feed lists jobs only, not lunch breaks.
        </p>
      </Card>
      {form && (
        <LunchForm
          key={form.lunch ? `edit-${form.lunch.id}` : "new"}
          lunch={form.lunch}
          initial={form.initial}
          today={today}
          onSaved={reload}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
