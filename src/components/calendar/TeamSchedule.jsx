import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { api, fetchAll } from "../../api";
import { useAsync, useMediaQuery, useSchedule, useSchedulePrefs } from "../../hooks";
import { DEFAULT_DURATION } from "../../utils/format";
import { hiddenFromPrefs, prefsFromHidden } from "../../utils/schedulePrefs";
import ErrorMessage from "../ErrorMessage";
import JobForm from "../JobForm";
import Loading from "../Loading";
import { Toast } from "../ui/Feedback";
import { Modal } from "../ui/Modal";
import Legend from "./Legend";
import { JobQuickView, LunchQuickView } from "./QuickViews";
import TeamDay from "./TeamDay";
import { createJob as addJob } from "../../utils/series";

// FullCalendar is the largest dependency; load it only on pages with a calendar.
const ScheduleCalendar = lazy(() => import("./ScheduleCalendar"));

// A single click on the time grid selects one 30-minute slot; treat that as "a job here".
const CLICK_MINUTES = 30;
const PAGE_VIEWS = [
  ["teamDay", "Team"],
  ["timeGridDay", "Day"],
  ["timeGridWeek", "Week"],
  ["dayGridMonth", "Month"],
  ["listWeek", "List"],
];
const PAGE_VIEW_TYPES = new Set(PAGE_VIEWS.map(([type]) => type));
const PAGE_DEFAULT_VIEW = "teamDay";
const PHONE_QUERY = "(max-width: 639px)";

// Loaded only when the owner opens it, so client-admins never ask for owner-only lists.
function NewJobDialog({ initial, onSubmit, onClose }) {
  const clients = useAsync(fetchAll, "/api/clients");
  const employees = useAsync(api, "/api/employees");
  return (
    <Modal title="New job" description="Times are in your business time zone." onClose={onClose} size="lg">
      {clients.error || employees.error ? (
        <ErrorMessage error={clients.error || employees.error} />
      ) : !clients.data || !employees.data ? (
        <Loading />
      ) : (
        <JobForm
          clients={clients.data}
          employees={employees.data}
          initial={initial}
          onSubmit={onSubmit}
          onCancel={onClose}
          submitLabel="Add job"
        />
      )}
    </Modal>
  );
}

function PrefsToast({ prefs }) {
  if (prefs.saveError) {
    return (
      <Toast
        onClose={prefs.dismissErrors}
        action={
          <button type="button" onClick={prefs.retry} className="rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline">
            Retry
          </button>
        }
      >
        Your schedule settings did not save. They still apply on this screen.
      </Toast>
    );
  }
  if (prefs.loadError) {
    return (
      <Toast tone="warning" onClose={prefs.dismissErrors}>
        Your saved schedule settings could not be loaded, so everyone is shown.
      </Toast>
    );
  }
  return null;
}

// The team calendar, shared by the owner dashboard and the Schedule page.
//
// mode: "owner" (create, drag, prices) or "admin" (an employee with client access:
// read-only, no prices, and "Open job" only on their own assigned jobs).
// variant: "page" adds the Team day view and remembers the chosen view; "dashboard"
// is the compact owner calendar. Both share the saved show/hide toggles.
// reloadKey: bump to refetch after a change made elsewhere on the page.
// onChanged: called after a job is created or moved, so the page can refresh its totals.
export default function TeamSchedule({ mode, variant, timezone, selfId, reloadKey = 0, onChanged }) {
  const page = variant === "page";
  const owner = mode === "owner";
  const [range, setRange] = useState(null);
  const [ownKey, setOwnKey] = useState(0);
  const schedule = useSchedule(range, `${reloadKey}.${ownKey}`, page ? "/api/schedule/team" : "/api/schedule");
  const prefs = useSchedulePrefs();
  const [dialog, setDialog] = useState(null);
  const [moveError, setMoveError] = useState(null);
  const hidden = useMemo(() => hiddenFromPrefs(prefs.prefs), [prefs.prefs]);
  const zone = schedule.data?.timezone || timezone;
  const phone = useMediaQuery(PHONE_QUERY);

  const changeRange = useCallback((next) => {
    setRange((current) => (current && current.start === next.start && current.end === next.end ? current : next));
  }, []);

  async function moveJob(job, patch) {
    setMoveError(null);
    const updated = await api(`/api/jobs/${job.id}`, { method: "PATCH", body: patch });
    schedule.setData((data) => ({ ...data, jobs: data.jobs.map((item) => (item.id === updated.id ? updated : item)) }));
    onChanged?.();
  }

  async function createJob(body) {
    await addJob(body);
    setDialog(null);
    setOwnKey((key) => key + 1);
    onChanged?.();
  }

  function startCreate({ date, time, minutes, allDay, employeeId }) {
    setDialog({
      type: "create",
      initial: {
        date,
        time: time ?? "09:00",
        duration_minutes: allDay || !minutes || minutes <= CLICK_MINUTES ? DEFAULT_DURATION : minutes,
        ...(employeeId ? { assignees: [{ id: employeeId }] } : {}),
      },
    });
  }

  function openTo(job) {
    if (owner) return `/jobs/${job.id}`;
    return job.assignees.some((person) => person.id === selfId) ? `/my-jobs/${job.id}` : null;
  }

  if (!prefs.prefs) return <Loading label="Loading calendar…" />;

  // ScheduleCalendar leaves Week out on phones and starts on fallbackView there instead,
  // without changing what is saved for the person's other devices.
  const savedView = PAGE_VIEW_TYPES.has(prefs.prefs.view) ? prefs.prefs.view : PAGE_DEFAULT_VIEW;
  const customViews = page
    ? {
        teamDay: ({ day, today, now }) => (
          <TeamDay
            day={day}
            today={today}
            now={now}
            data={schedule.data}
            hidden={hidden}
            mode={mode}
            onJobClick={(job) => setDialog({ type: "job", job })}
            onLunchClick={(lunch) => setDialog({ type: "lunch", lunch })}
            onCreate={owner ? startCreate : undefined}
          />
        ),
      }
    : undefined;

  return (
    <div>
      <ErrorMessage error={schedule.error || moveError} className="mb-3" />
      <Suspense fallback={<Loading label="Loading calendar…" />}>
        <ScheduleCalendar
          mode={mode}
          timezone={zone}
          data={schedule.data}
          loading={schedule.loading}
          hidden={hidden}
          {...(page
            ? {
                views: PAGE_VIEWS,
                fallbackView: PAGE_DEFAULT_VIEW,
                customViews,
                initialView: savedView,
                onViewChange: (view) => prefs.update({ view }),
              }
            : {})}
          onRangeChange={changeRange}
          onJobClick={(job) => setDialog({ type: "job", job })}
          onLunchClick={(lunch) => setDialog({ type: "lunch", lunch })}
          onSelect={owner ? startCreate : undefined}
          onJobMove={owner ? moveJob : undefined}
          onMoveError={setMoveError}
        >
          <Legend data={schedule.data} hidden={hidden} onChange={(next) => prefs.update(prefsFromHidden(next))} />
        </ScheduleCalendar>
      </Suspense>
      <p className="mt-3 text-xs text-muted">
        {owner
          ? page
            ? `Click an empty time to schedule a job; in Team, the column picks who does it. Drag a job in ${phone ? "Day" : "Day or Week"} to move it.`
            : "Click an empty time to schedule a job. Drag a job to move it, or drag its bottom edge to change its length."
          : "Read-only. Only the owner adds or moves jobs. Prices are not shown."}
      </p>
      {dialog?.type === "job" && (
        <JobQuickView job={dialog.job} showMoney={owner} openTo={openTo(dialog.job)} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "lunch" && <LunchQuickView lunch={dialog.lunch} onClose={() => setDialog(null)} />}
      {dialog?.type === "create" && owner && (
        <NewJobDialog initial={dialog.initial} onSubmit={createJob} onClose={() => setDialog(null)} />
      )}
      <PrefsToast prefs={prefs} />
    </div>
  );
}
