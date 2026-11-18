import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAsync } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Spinner } from "./ui/Feedback";
import { AlertIcon, CheckIcon, InfoIcon, RefreshIcon } from "./ui/Icons";
import { cx } from "./ui/styles";
import { useCountUp } from "./ui/useMotion";

const STATUS = {
  act: { icon: AlertIcon, className: "text-danger", label: "Needs action" },
  watch: { icon: InfoIcon, className: "text-warning", label: "Keep an eye on" },
  good: { icon: CheckIcon, className: "text-success", label: "Good" },
};
const PRIORITY_TONE = { high: "danger", medium: "warning", low: "neutral" };

function scoreTone(score) {
  if (score === null || score === undefined) return "neutral";
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

const RING_COLOR = { success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-muted" };
const RING_LENGTH = 2 * Math.PI * 20;

// The score as a ring that fills as the number counts up.
function ScoreRing({ score }) {
  const shown = useCountUp(score, 1200);
  return (
    <span
      className={cx("relative inline-flex h-14 w-14 shrink-0 items-center justify-center", RING_COLOR[scoreTone(score)])}
      title="Share of checks that look good"
      role="img"
      aria-label={`Score: ${score} out of 100`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="20" strokeWidth="5" className="stroke-surface-2" />
        <circle
          cx="24"
          cy="24"
          r="20"
          strokeWidth="5"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - shown / 100)}
        />
      </svg>
      <span className="font-display text-base font-bold tabular-nums text-fg">{shown}</span>
    </span>
  );
}

function Signal({ signal }) {
  const { icon: Icon, className, label } = STATUS[signal.status] || STATUS.watch;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", className)} aria-label={label} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{signal.title}</p>
        <p className="text-xs text-muted">{signal.detail}</p>
      </div>
      {signal.to && signal.status !== "good" && (
        <Link to={signal.to} className="shrink-0 text-sm font-medium text-primary hover:underline">
          {signal.action || "Open"}
        </Link>
      )}
    </li>
  );
}

function Insights({ result, aiConfigured, onRefresh, refreshing }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          What to do this week
          <Badge tone="primary">AI</Badge>
        </h3>
        {aiConfigured && (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Spinner className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
            Refresh
          </Button>
        )}
      </div>
      <ol className="space-y-2">
        {result.insights.map((item, index) => (
          <li key={`${index}-${item.title}`} className="rounded-lg border border-border p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
              {item.title}
              {item.priority === "high" && <Badge tone={PRIORITY_TONE.high}>Do first</Badge>}
            </p>
            <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
            {item.to && (
              <Link to={item.to} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
                Open
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        Written by Claude from your totals and counts only; no customer names or contact details are shared. Check
        before acting.
      </p>
    </section>
  );
}

// Dashboard: the business checkup (score and signals) and this week's suggestions.
export default function BusinessHealthCard() {
  const { data, setData, error } = useAsync(api, "/api/business/health");
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const body = await api("/api/business/health/insights", { method: "POST" });
      setData((current) => ({ ...current, insights: body.insights }));
    } catch (err) {
      setRefreshError(err);
    } finally {
      setRefreshing(false);
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!data) {
    return (
      <Card title="Business health">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" /> Checking your numbers…
        </p>
      </Card>
    );
  }

  const ai = data.insights?.source === "ai";
  const needs = data.signals.filter((signal) => signal.status !== "good");
  const shown = showAll ? data.signals : needs.length ? needs : data.signals.slice(0, 3);

  return (
    <Card
      title="Business health"
      description="The last 30 days next to the 30 before, and what's owed now."
      actions={
        data.score !== null && <ScoreRing score={data.score} />
      }
    >
      <div className={cx("grid gap-6", ai && "lg:grid-cols-2")}>
        <div>
          <ul className="divide-y divide-border">
            {shown.map((signal) => (
              <Signal key={signal.key} signal={signal} />
            ))}
          </ul>
          {data.signals.length > shown.length || showAll ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-1 text-sm font-medium text-primary hover:underline"
            >
              {showAll ? "Show only what needs attention" : `Show all ${data.signals.length} checks`}
            </button>
          ) : null}
          {!ai && (
            <p className="mt-3 text-xs text-muted">
              {data.ai_configured
                ? "AI suggestions are unavailable right now; these checks are up to date."
                : "AI suggestions turn on when the server has an Anthropic API key."}
            </p>
          )}
        </div>
        {ai && (
          <div>
            <Insights result={data.insights} aiConfigured={data.ai_configured} onRefresh={refresh} refreshing={refreshing} />
            <ErrorMessage error={refreshError} />
          </div>
        )}
      </div>
    </Card>
  );
}
