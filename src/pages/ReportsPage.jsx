import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Input } from "../components/Field";
import Loading from "../components/Loading";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import { formatMoney } from "../utils/format";
import { businessToday } from "../utils/time";
import { formatHours } from "../utils/timeEntries";

const MONTH = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });

function monthLabel(key) {
  return MONTH.format(new Date(`${key}-01T00:00:00Z`));
}

function monthsBack(today, months) {
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - months, 1));
  return start.toISOString().slice(0, 10);
}

const RANGES = [
  ["3m", "3 months", 2],
  ["6m", "6 months", 5],
  ["12m", "12 months", 11],
];

function Stat({ label, value, detail, tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums", tone === "warning" && "text-warning")}>{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}

// Completed work by month as bars on one axis, with the exact numbers on hover and in the table below.
function MonthChart({ months }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...months.map((row) => row.completed_cents));
  const shown = active === null ? null : months[active];
  return (
    <div>
      <div className="mb-2 h-10 text-sm" aria-live="polite">
        {shown ? (
          <p>
            <span className="font-semibold">{monthLabel(shown.month)}</span>
            <span className="text-muted"> · completed </span>
            <span className="font-medium tabular-nums">{formatMoney(shown.completed_cents)}</span>
            <span className="text-muted"> ({shown.jobs} jobs) · collected </span>
            <span className="font-medium tabular-nums">{formatMoney(shown.collected_cents)}</span>
          </p>
        ) : (
          <p className="text-muted">Hover or tap a month for its numbers.</p>
        )}
      </div>
      <div className="flex h-48 items-end gap-0.5 border-b border-border" role="img" aria-label="Completed work by month. The numbers are in the table below.">
        {months.map((row, index) => (
          <button
            key={row.month}
            type="button"
            onPointerEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            aria-label={`${monthLabel(row.month)}: ${formatMoney(row.completed_cents)} completed`}
            className="group flex h-full min-w-0 flex-1 items-end justify-center rounded-t px-1 hover:bg-surface-2 focus-visible:bg-surface-2"
          >
            <span
              className={cx("block w-full max-w-10 rounded-t", active !== null && active !== index && "opacity-50")}
              style={{
                height: `${Math.max(row.completed_cents ? 2 : 0, (row.completed_cents / max) * 100)}%`,
                background: "var(--chart-bar)",
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {months.map((row, index) => (
          <span
            key={row.month}
            className={cx(
              "min-w-0 flex-1 truncate text-center text-[11px] text-muted",
              months.length > 8 && index % 2 === 1 && "invisible sm:visible",
            )}
          >
            {monthLabel(row.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const today = businessToday(user.timezone);
  const [range, setRange] = useState("6m");
  const [custom, setCustom] = useState({ start: monthsBack(today, 5), end: today });
  const preset = RANGES.find(([key]) => key === range);
  const start = preset ? monthsBack(today, preset[2]) : custom.start;
  const end = preset ? today : custom.end;
  const { data, error } = useAsync(api, `/api/reports?start=${start}&end=${end}`);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Reports" description="How the business is doing: work, money, quotes, and hours." />

      <div className="flex flex-wrap items-end gap-2">
        {RANGES.map(([key, label]) => (
          <Button key={key} size="sm" variant={range === key ? "primary" : "secondary"} onClick={() => setRange(key)}>
            {label}
          </Button>
        ))}
        <Button size="sm" variant={range === "custom" ? "primary" : "secondary"} onClick={() => setRange("custom")}>
          Custom
        </Button>
        {range === "custom" && (
          <>
            <Input label="From" type="date" value={custom.start} max={custom.end} onChange={(event) => setCustom((c) => ({ ...c, start: event.target.value }))} className="w-40" />
            <Input label="To" type="date" value={custom.end} min={custom.start} max={today} onChange={(event) => setCustom((c) => ({ ...c, end: event.target.value }))} className="w-40" />
          </>
        )}
      </div>

      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Completed work" value={formatMoney(data.totals.completed_cents)} detail={`${data.totals.completed_jobs} jobs`} />
            <Stat label="Collected" value={formatMoney(data.totals.collected_cents)} detail="Payments received" />
            <Stat
              label="Owed to you"
              value={formatMoney(data.totals.outstanding_cents)}
              detail={`${data.totals.outstanding_invoices} sent ${data.totals.outstanding_invoices === 1 ? "invoice" : "invoices"}, as of today`}
            />
            <Stat
              label="Overdue"
              value={formatMoney(data.totals.overdue_cents)}
              detail={`${data.totals.overdue_invoices} past due`}
              tone={data.totals.overdue_invoices ? "warning" : undefined}
            />
          </div>

          <Card title="Completed work by month">
            <MonthChart months={data.months} />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">Show as a table</summary>
              <table className="mt-2 w-full text-left tabular-nums">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1 font-medium">Month</th>
                    <th className="py-1 text-right font-medium">Jobs</th>
                    <th className="py-1 text-right font-medium">Completed</th>
                    <th className="py-1 text-right font-medium">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.months.map((row) => (
                    <tr key={row.month}>
                      <td className="py-1.5">{monthLabel(row.month)}</td>
                      <td className="py-1.5 text-right">{row.jobs}</td>
                      <td className="py-1.5 text-right">{formatMoney(row.completed_cents)}</td>
                      <td className="py-1.5 text-right">{formatMoney(row.collected_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Card>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card title="By service">
              {data.services.length ? (
                <ul className="space-y-2.5">
                  {data.services.map((row) => (
                    <li key={row.service_type}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate">{row.service_type}</span>
                        <span className="tabular-nums">
                          {formatMoney(row.cents)} <span className="text-muted">· {row.jobs}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(row.cents / Math.max(1, data.services[0].cents)) * 100}%`, background: "var(--chart-bar)" }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No completed jobs in this range.</p>
              )}
            </Card>
            <Card title="Top clients">
              {data.top_clients.length ? (
                <ol className="divide-y divide-border text-sm">
                  {data.top_clients.map((row, index) => (
                    <li key={row.id} className="flex justify-between gap-3 py-2">
                      <span className="truncate">
                        <span className="mr-2 tabular-nums text-muted">{index + 1}.</span>
                        <Link to={`/clients/${row.id}`} className="link">{row.name}</Link>
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(row.cents)} <span className="text-muted">· {row.jobs} jobs</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No completed jobs in this range.</p>
              )}
            </Card>
            <Card title="Quotes">
              <p className="text-3xl font-semibold tabular-nums">
                {data.quotes.win_rate === null ? "—" : `${Math.round(data.quotes.win_rate * 100)}%`}
              </p>
              <p className="text-sm text-muted">won, of the quotes clients answered</p>
              <p className="mt-3 text-sm">
                {data.quotes.sent} sent · {data.quotes.accepted} accepted · {data.quotes.declined} declined · {data.quotes.open} waiting
              </p>
            </Card>
            <Card title="Getting paid">
              <p className="text-3xl font-semibold tabular-nums">
                {data.days_to_pay.average === null ? "—" : `${data.days_to_pay.average} days`}
              </p>
              <p className="text-sm text-muted">on average from sending an invoice to payment</p>
              {data.days_to_pay.invoices > 0 && (
                <p className="mt-3 text-sm">
                  Median {data.days_to_pay.median} days, over {data.days_to_pay.invoices} paid{" "}
                  {data.days_to_pay.invoices === 1 ? "invoice" : "invoices"}
                </p>
              )}
            </Card>
            <Card title="Hours" className="lg:col-span-2">
              <p className="text-3xl font-semibold tabular-nums">{formatHours(data.hours.minutes)} h</p>
              <p className="text-sm text-muted">clocked in this range</p>
              {data.hours.timed_jobs > 0 && (
                <p className="mt-2 text-sm">
                  On {data.hours.timed_jobs} completed jobs with time: {formatHours(data.hours.timed_minutes)} h clocked against{" "}
                  {formatHours(data.hours.scheduled_minutes)} h scheduled.
                </p>
              )}
              {data.hours.people.length > 0 && (
                <ul className="mt-3 divide-y divide-border border-t border-border">
                  {data.hours.people.map((row) => (
                    <li key={row.person.id} className="flex items-center gap-3 py-2 text-sm">
                      <Avatar person={row.person} size="sm" />
                      <span className="flex-1">{row.person.name}</span>
                      <span className="tabular-nums">{formatHours(row.minutes)} h</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
