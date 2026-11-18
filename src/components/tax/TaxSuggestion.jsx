import { formatWhen } from "../../utils/admin";
import { formatPercent } from "../../utils/quotes";
import { breakdownText, isStale } from "../../utils/tax";
import { Badge } from "../ui/Badge";

// What a lookup found for a ZIP code: the rate, its parts, the pages it came from, and a
// reminder that it is a suggestion to check. suggestion: from /api/tax/lookup.
export default function TaxSuggestion({ suggestion, place, children }) {
  if (!suggestion.found) {
    return (
      <div className="rounded-lg border border-border px-3 py-2.5 text-sm">
        <p className="font-medium text-fg">The lookup did not find a rate.</p>
        {suggestion.note && <p className="mt-0.5 text-muted [overflow-wrap:anywhere]">{suggestion.note}</p>}
        <p className="mt-0.5 text-muted">You can type the rate yourself.</p>
        {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
      </div>
    );
  }
  const parts = breakdownText(suggestion.breakdown);
  return (
    <div className="rounded-lg border border-primary/25 bg-primary-soft px-3 py-2.5 text-sm text-primary-soft-fg">
      <p className="font-semibold">
        Looked up: {formatPercent(suggestion.rate)}
        {place && <span className="font-normal"> for {place}</span>}
      </p>
      {parts && <p className="mt-0.5 [overflow-wrap:anywhere]">{parts}</p>}
      {suggestion.effective && <p className="mt-0.5">In effect since {suggestion.effective}.</p>}
      {suggestion.note && <p className="mt-0.5 [overflow-wrap:anywhere]">{suggestion.note}</p>}
      <ul className="mt-1.5 space-y-0.5">
        {suggestion.sources.map((source) => (
          <li key={source.url} className="flex flex-wrap items-center gap-1.5">
            <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 [overflow-wrap:anywhere]">
              {source.title}
            </a>
            {source.official && <Badge tone="success">Government site</Badge>}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs opacity-90">
        Found by AI on {formatWhen(suggestion.looked_up_at)}
        {isStale(suggestion.looked_up_at) && ", which is a while ago"}. Check it against the source before you use it.
        Whether your work is taxable at all depends on your state.
      </p>
      {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
