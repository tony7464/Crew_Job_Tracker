import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, apiUrl } from "../api";
import ConfirmDelete from "../components/ConfirmDelete";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import MapLink from "../components/MapLink";
import { Badge, QuoteStatusBadge, RequestStatusBadge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PlusIcon,
  UsersIcon,
} from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAuth } from "../context/useAuth";
import { notifyRequestsChanged, useAsync } from "../hooks";
import { formatMoney, statusLabel } from "../utils/format";
import { REQUEST_STATUSES, formatReceived, formatWindow } from "../utils/requests";
import { isOwner } from "../utils/roles";

const STATUS_HINTS = {
  new: "No decision yet.",
  quoted: "You sent a price.",
  won: "They booked the work.",
  lost: "They went elsewhere or did not go ahead.",
};

export default function RequestDetail() {
  const { id } = useParams();
  return <RequestDetailView key={id} id={id} />;
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 shrink-0 text-muted">
        <Icon className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}

function StatusControl({ status, onChange }) {
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  async function pick(next) {
    if (next === status || saving) return;
    setSaving(next);
    setError(null);
    try {
      await onChange(next);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2">
        {REQUEST_STATUSES.map((value) => (
          <label
            key={value}
            className={cx(
              "cursor-pointer rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2",
              "has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-fg has-focus-visible:ring-4 has-focus-visible:ring-ring",
              saving && "pointer-events-none opacity-70",
            )}
          >
            <input
              type="radio"
              name="status"
              value={value}
              checked={(saving || status) === value}
              onChange={() => pick(value)}
              className="sr-only"
            />
            <span className="block font-medium">{statusLabel(value)}</span>
            <span className="mt-0.5 block text-xs opacity-80">{STATUS_HINTS[value]}</span>
          </label>
        ))}
      </div>
      <ErrorMessage error={error} className="mt-3" />
    </div>
  );
}

function ClientLink({ request, onConvert }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      await onConvert();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (request.client) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Converted to{" "}
          <span className="font-medium">{request.client.name}</span>
          {request.client.archived && <Badge className="ml-2">Archived</Badge>}
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/clients/${request.client.id}`} variant="secondary">
            <UsersIcon />
            Open client
          </ButtonLink>
          <Button disabled title="This request already has a client">
            Convert to client
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Adds a client with this name, phone, email, and address, and links them to this request.
      </p>
      <Button onClick={convert} disabled={busy}>
        <UsersIcon />
        {busy ? "Converting…" : "Convert to client"}
      </Button>
      <ErrorMessage error={error} />
    </div>
  );
}

// Quotes on this request. The owner opens them and sees totals; employees with client
// access only see that they exist and their status (the API sends them no amounts).
function RequestQuotes({ request, owner }) {
  const won = request.quotes.some((quote) => quote.status === "accepted");
  return (
    <div className="space-y-3">
      {request.quotes.length ? (
        <ul className="divide-y divide-border">
          {request.quotes.map((quote) => (
            <li key={quote.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 text-sm">
                {owner ? (
                  <Link to={`/quotes/${quote.id}`} className="link block truncate font-medium">{quote.title}</Link>
                ) : (
                  <span className="block truncate font-medium text-fg">{quote.title}</span>
                )}
                <span className="text-xs text-subtle">
                  Quote #{quote.id}
                  {owner && quote.total_cents !== undefined && ` · ${formatMoney(quote.total_cents)}`}
                </span>
              </div>
              <QuoteStatusBadge quote={quote} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {owner ? "Price the work and send the client a link to accept it." : "No quotes yet. The owner sends quotes."}
        </p>
      )}
      {owner && !won && (
        <ButtonLink to={`/quotes/new?request_id=${request.id}`} variant={request.quotes.length ? "secondary" : "primary"}>
          <PlusIcon />
          {request.quotes.length ? "Another quote" : "Create quote"}
        </ButtonLink>
      )}
    </div>
  );
}

function Lightbox({ photos, index, onIndex, onClose }) {
  const photo = photos[index];
  const many = photos.length > 1;
  const go = (step) => onIndex((index + step + photos.length) % photos.length);

  useEffect(() => {
    if (!many) return undefined;
    function onKey(event) {
      if (event.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, index, photos.length, onIndex]);

  return (
    <Modal title={`Photo ${index + 1} of ${photos.length}`} onClose={onClose} size="lg">
      <div className="flex items-center justify-center rounded-lg bg-surface-2">
        <img
          src={apiUrl(photo.url)}
          alt={`Photo ${index + 1} of ${photos.length}`}
          width={photo.width}
          height={photo.height}
          className="max-h-[65dvh] w-auto max-w-full object-contain"
        />
      </div>
      {many && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => go(-1)}>
            <ChevronLeftIcon />
            Previous
          </Button>
          <a href={apiUrl(photo.url)} target="_blank" rel="noopener" className="link text-sm">
            Open full size
          </a>
          <Button variant="secondary" onClick={() => go(1)}>
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </Modal>
  );
}

function PhotoGrid({ photos }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="block aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-2 transition hover:opacity-90"
              aria-label={`Open photo ${index + 1}`}
            >
              <img src={apiUrl(photo.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function RequestDetailView({ id }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: request, setData, error } = useAsync(api, `/api/requests/${id}`);

  // Opening the request marked it read on the server; update the menu badge.
  const loadedId = request?.id;
  useEffect(() => {
    if (loadedId) notifyRequestsChanged();
  }, [loadedId]);

  async function changeStatus(status) {
    setData(await api(`/api/requests/${id}`, { method: "PATCH", body: { status } }));
    notifyRequestsChanged();
  }

  async function convert() {
    const result = await api(`/api/requests/${id}/convert`, { method: "POST" });
    setData(result.request);
  }

  const back = { to: "/requests", label: "Requests" };
  if (error?.status === 404) {
    return (
      <>
        <PageHeader title="Request not found" back={back} />
        <EmptyState title="This request does not exist or was deleted." />
      </>
    );
  }
  if (error) return <ErrorMessage error={error} />;
  if (!request) return <Loading />;

  const timeZone = user.timezone;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {request.name}
            <RequestStatusBadge status={request.status} />
          </span>
        }
        description={`${request.service_type} · Received ${formatReceived(request.created_at, timeZone)}`}
        back={back}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Contact and address">
            <dl className="space-y-3">
              <Detail icon={PhoneIcon} label="Phone">
                {request.phone ? (
                  <a href={`tel:${request.phone}`} className="link">{request.phone}</a>
                ) : (
                  <span className="text-muted">No phone</span>
                )}
              </Detail>
              <Detail icon={MailIcon} label="Email">
                {request.email ? (
                  <a href={`mailto:${request.email}`} className="link break-all">{request.email}</a>
                ) : (
                  <span className="text-muted">No email</span>
                )}
              </Detail>
              <Detail icon={MapPinIcon} label="Address">
                <span className="flex flex-wrap items-center gap-x-2">
                  {request.address} <MapLink address={request.address} />
                </span>
              </Detail>
            </dl>
          </Card>
          <Card title="When works for them">
            {request.preferred_windows.length || request.preferred_text ? (
              <dl className="space-y-3">
                {request.preferred_windows.map((option, index) => (
                  <Detail key={`${option.date}-${option.window}-${index}`} icon={CalendarIcon} label={`Preferred day ${index + 1}`}>
                    {formatWindow(option)}
                  </Detail>
                ))}
                {request.preferred_text && (
                  <Detail icon={ClockIcon} label="Other timing">
                    {request.preferred_text}
                  </Detail>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted">No preferred times given.</p>
            )}
          </Card>
          <Card title="Notes">
            {request.notes ? (
              <p className="whitespace-pre-wrap text-sm">{request.notes}</p>
            ) : (
              <p className="text-sm text-muted">No notes.</p>
            )}
          </Card>
          <Card
            title="Photos"
            description={request.photos.length ? `${request.photos.length} ${request.photos.length === 1 ? "photo" : "photos"}. Tap one to see it larger.` : undefined}
          >
            {request.photos.length ? (
              <PhotoGrid photos={request.photos} />
            ) : (
              <p className="text-sm text-muted">No photos.</p>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Status">
            <StatusControl status={request.status} onChange={changeStatus} />
          </Card>
          <Card title="Quotes">
            <RequestQuotes request={request} owner={isOwner(user)} />
          </Card>
          <Card title="Client">
            <ClientLink request={request} onConvert={convert} />
          </Card>
        </div>
      </div>
      {isOwner(user) && (
        <ConfirmDelete
          label="Delete request"
          description={`Permanently deletes this request${request.photos.length ? " and its photos" : ""}.${request.client ? " The client made from it is kept." : ""} This cannot be undone.`}
          onConfirm={async () => {
            await api(`/api/requests/${id}`, { method: "DELETE" });
            notifyRequestsChanged();
            navigate("/requests");
          }}
        />
      )}
    </div>
  );
}
