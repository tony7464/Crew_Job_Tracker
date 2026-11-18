import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAsync } from "../hooks";
import { formatMoney } from "../utils/format";
import { axisTop, beforeLabel, bucketLabel, formatRate, labelledIndexes, rateTrend, trend, trendText } from "../utils/stats";

const PERIODS = [
  [7, "7 days"],
  [30, "30 days"],
  [91, "13 weeks"],
];

const COMPACT = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

// Axis labels: whole dollars, compact from $10,000 up ("$12K").
function axisMoney(cents) {
  return cents >= 1_000_000 ? COMPACT.format(cents / 100) : formatMoney(cents).replace(/\.00$/, "");
}

function Arrow({ direction }) {
  if (direction !== "up" && direction !== "down") return null;
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path d={direction === "up" ? "M6 2 11 10H1z" : "M6 10 1 2h10z"} fill="currentColor" />
    </svg>
  );
}

// One headline number with how it moved. found: from trend() or rateTrend().
// good: which direction is good news ("up" by default; "down" for cancelled jobs).
function Stat({ label, value, detail, found, days, good = "up" }) {
  const text = trendText(found, days);
  const moved = found.direction === "up" || found.direction === "down";
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
      {text && (
        <p className={cx("mt-1.5 flex items-center gap-1 text-xs", moved ? (found.direction === good ? "text-success" : "text-danger") : "text-muted")}>
          <Arrow direction={found.direction} />
          <span className={moved ? "font-medium" : undefined}>{text}</span>
        </p>
      )}
    </div>
  );
}

// Sales for each day (or week) as bars on one axis. The exact numbers show on hover,
// tap, or keyboard focus, and in the table below.
function SalesChart({ series }) {
  const [active, setActive] = useState(null);
  const top = axisTop(Math.max(0, ...series.map((bucket) => bucket.sales_cents)));
  const shown = active === null ? null : series[active];
  const labelled = labelledIndexes(series.length);
  return (
    <div>
      <div className="mb-2 min-h-10 text-sm" aria-live="polite">
        {shown ? (
          <p>
            <span className="font-semibold tabular-nums">{formatMoney(shown.sales_cents)}</span>
            <span className="text-muted">
              {" "}
              · {bucketLabel(shown)} · {shown.jobs} {shown.jobs === 1 ? "job" : "jobs"}
              {shown.new_customers > 0 && ` · ${shown.new_customers} new ${shown.new_customers === 1 ? "customer" : "customers"}`}
              {shown.collected_cents > 0 && ` · ${formatMoney(shown.collected_cents)} collected`}
            </span>
          </p>
        ) : (
          <p className="text-muted">Hover or tap a bar for its numbers.</p>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex h-48 w-12 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted" aria-hidden="true">
          <span className="-mt-1.5">{axisMoney(top)}</span>
          <span>{axisMoney(top / 2)}</span>
          <span className="-mb-1.5">$0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative flex h-48 items-end border-b border-border"
            role="img"
            aria-label="Sales over the period. The numbers are in the table below."
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-border/60" aria-hidden="true" />
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border/60" aria-hidden="true" />
            {series.map((bucket, index) => (
              <button
                key={bucket.start}
                type="button"
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onBlur={() => setActive(null)}
                aria-label={`${bucketLabel(bucket)}: ${formatMoney(bucket.sales_cents)}`}
                className="relative flex h-full min-w-0 flex-1 items-end justify-center px-px hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <span
                  className={cx("block w-full max-w-6 rounded-t", active !== null && active !== index && "opacity-50")}
                  style={{
                    height: `${bucket.sales_cents ? Math.max(1.5, (bucket.sales_cents / top) * 100) : 0}%`,
                    background: "var(--chart-bar)",
                  }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex">
            {series.map((bucket, index) => (
              <span key={bucket.start} className="relative h-4 min-w-0 flex-1">
                {labelled.has(index) && (
                  <span
                    className={cx(
                      "absolute top-0 whitespace-nowrap text-[11px] text-muted",
                      index === 0 ? "left-0" : index === series.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {bucketLabel({ start: bucket.start, end: bucket.start })}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesTable({ series, weekly }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted">Show as a table</summary>
      <table className="mt-2 w-full text-left tabular-nums">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 font-medium">{weekly ? "Week" : "Day"}</th>
            <th className="py-1 text-right font-medium">Jobs</th>
            <th className="py-1 text-right font-medium">Sales</th>
            <th className="py-1 text-right font-medium">Collected</th>
            <th className="py-1 text-right font-medium">New customers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {series.map((bucket) => (
            <tr key={bucket.start}>
              <td className="py-1.5">{bucketLabel(bucket)}</td>
              <td className="py-1.5 text-right">{bucket.jobs}</td>
              <td className="py-1.5 text-right">{formatMoney(bucket.sales_cents)}</td>
              <td className="py-1.5 text-right">{formatMoney(bucket.collected_cents)}</td>
              <td className="py-1.5 text-right">{bucket.new_customers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// A share as a bar against its whole, with the figure and what it means in words.
function Meter({ label, value, explain, found, days }) {
  const text = trendText(found, days);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{formatRate(value)}</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${Math.round((Number(value) || 0) * 100)}%`, background: "var(--chart-bar)" }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">{explain}</p>
      {text && (
        <p className={cx("mt-0.5 flex items-center gap-1 text-xs", found.direction === "up" ? "text-success" : found.direction === "down" ? "text-danger" : "text-muted")}>
          <Arrow direction={found.direction} />
          {text}
        </p>
      )}
    </div>
  );
}

const count = (value, one, many) => `${value} ${value === 1 ? one : many}`;

export default function StatsPage() {
  const [days, setDays] = useState(30);
  const { data, error } = useAsync(api, `/api/stats?days=${days}`);
  // While another period loads, the last one stays on screen.
  const m = data?.metrics;
  const before = beforeLabel(data?.days ?? days);
  const weekly = data?.bucket_days === 7;
  const quiet = m && !m.sales_cents.current && !m.sales_cents.previous && !m.customers_served.current;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Statistics"
        description="How sales, customers, and new work are trending, next to the same stretch of time before."
      />

      <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
        {PERIODS.map(([value, label]) => (
          <Button key={value} size="sm" variant={days === value ? "primary" : "secondary"} aria-pressed={days === value} onClick={() => setDays(value)}>
            Last {label}
          </Button>
        ))}
      </div>

      {error ? (
        <ErrorMessage error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          {quiet && (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted shadow-card">
              Nothing to chart yet. Mark a job completed and it shows up here.{" "}
              <Link to="/jobs" className="link">
                Go to jobs
              </Link>
            </p>
          )}

          <section aria-label="Sales" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Sales"
              value={formatMoney(m.sales_cents.current)}
              detail="Completed work"
              found={trend(m.sales_cents.current, m.sales_cents.previous)}
              days={data.days}
            />
            <Stat
              label="Collected"
              value={formatMoney(m.collected_cents.current)}
              detail="Payments received"
              found={trend(m.collected_cents.current, m.collected_cents.previous)}
              days={data.days}
            />
            <Stat
              label="Jobs completed"
              value={m.jobs_completed.current}
              detail={m.jobs_cancelled.current ? `${m.jobs_cancelled.current} cancelled` : undefined}
              found={trend(m.jobs_completed.current, m.jobs_completed.previous)}
              days={data.days}
            />
            <Stat
              label="Average job"
              value={m.average_job_cents.current == null ? "–" : formatMoney(m.average_job_cents.current)}
              found={
                m.average_job_cents.current == null || m.average_job_cents.previous == null
                  ? { direction: "none" }
                  : trend(m.average_job_cents.current, m.average_job_cents.previous)
              }
              days={data.days}
            />
          </section>

          <Card title={weekly ? "Sales by week" : "Sales by day"} description="Completed work, by the day of the job.">
            <SalesChart series={data.series} />
            <SalesTable series={data.series} weekly={weekly} />
          </Card>

          <Card title="Customers" description="A customer is new in the period with their first completed job, and returning after that.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Customers served"
                value={m.customers_served.current}
                found={trend(m.customers_served.current, m.customers_served.previous)}
                days={data.days}
              />
              <Stat
                label="New customers"
                value={m.new_customers.current}
                found={trend(m.new_customers.current, m.new_customers.previous)}
                days={data.days}
              />
              <Stat
                label="Returning customers"
                value={m.returning_customers.current}
                found={trend(m.returning_customers.current, m.returning_customers.previous)}
                days={data.days}
              />
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Meter
                label="Retention"
                value={m.retention_rate.current}
                explain={
                  m.retention_rate.current == null
                    ? `No customers were served in ${before}, so there is nobody to keep yet.`
                    : `Of the ${count(m.customers_served.previous, "customer", "customers")} served in ${before}, this share came back.`
                }
                found={rateTrend(m.retention_rate.current, m.retention_rate.previous)}
                days={data.days}
              />
              <Meter
                label="Repeat business"
                value={m.repeat_rate.current}
                explain={
                  m.repeat_rate.current == null
                    ? "No customers served in this period yet."
                    : m.returning_customers.current === 0
                      ? `None of the ${count(m.customers_served.current, "customer", "customers")} served had used you before.`
                      : `${m.returning_customers.current} of the ${count(m.customers_served.current, "customer", "customers")} served had used you before.`
                }
                found={rateTrend(m.repeat_rate.current, m.repeat_rate.previous)}
                days={data.days}
              />
            </div>
          </Card>

          <section aria-label="New work" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Requests"
              value={m.requests.current}
              detail="From your request form"
              found={trend(m.requests.current, m.requests.previous)}
              days={data.days}
            />
            <Stat
              label="Quotes sent"
              value={m.quotes_sent.current}
              found={trend(m.quotes_sent.current, m.quotes_sent.previous)}
              days={data.days}
            />
            <Stat
              label="Quotes won"
              value={formatRate(m.quote_win_rate.current)}
              detail="Of the quotes answered"
              found={rateTrend(m.quote_win_rate.current, m.quote_win_rate.previous)}
              days={data.days}
            />
            <Stat
              label="Jobs cancelled"
              value={m.jobs_cancelled.current}
              found={trend(m.jobs_cancelled.current, m.jobs_cancelled.previous)}
              days={data.days}
              good="down"
            />
          </section>

          <p className="text-xs text-muted">
            For month-by-month totals, top clients, and hours, see{" "}
            <Link to="/reports" className="link">
              Reports
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
