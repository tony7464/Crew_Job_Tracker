import { statusLabel } from "../../utils/format";
import { RepeatIcon } from "./Icons";
import { BADGE_TONES, INVOICE_STATUS_TONES, QUOTE_STATUS_TONES, REQUEST_STATUS_TONES, STATUS_TONES, cx } from "./styles";

// tone: neutral | primary | success | warning | danger
export function Badge({ tone = "neutral", className, title, children }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] || "neutral"}>{statusLabel(status)}</Badge>;
}

export function RequestStatusBadge({ status }) {
  return <Badge tone={REQUEST_STATUS_TONES[status] || "neutral"}>{statusLabel(status)}</Badge>;
}

// A quote's status, plus Expired or Closed when a sent quote can no longer be answered.
export function QuoteStatusBadge({ quote }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={QUOTE_STATUS_TONES[quote.status] || "neutral"}>{statusLabel(quote.status)}</Badge>
      {quote.closed_reason === "expired" && <Badge tone="warning">Expired</Badge>}
      {quote.closed_reason === "request_accepted" && (
        <Badge tone="neutral" title="Another quote on this request was accepted">Closed</Badge>
      )}
    </span>
  );
}

// An invoice's status, plus Overdue for a sent invoice past its due date, and
// Needs attention when a payment could not be applied (see the invoice page).
export function InvoiceStatusBadge({ invoice }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={INVOICE_STATUS_TONES[invoice.status] || "neutral"}>{statusLabel(invoice.status)}</Badge>
      {invoice.overdue && <Badge tone="warning">Overdue</Badge>}
      {invoice.needs_attention && (
        <Badge tone="danger" title="A payment could not be applied to this invoice">Needs attention</Badge>
      )}
    </span>
  );
}

// How a recurring visit repeats, such as "Every 2 weeks".
export function RepeatBadge({ text }) {
  return (
    <Badge tone="primary" title="This visit is part of a recurring series">
      <RepeatIcon className="h-3 w-3" />
      {text}
    </Badge>
  );
}

export function PaidBadge({ paid }) {
  return <Badge tone={paid ? "success" : "warning"}>{paid ? "Paid" : "Unpaid"}</Badge>;
}
