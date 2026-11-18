import { Link } from "react-router-dom";
import { matchParts, phoneMatchParts } from "../utils/clientSearch";
import MapLink from "./MapLink";
import { Badge } from "./ui/Badge";
import { DataTable } from "./ui/DataTable";

// Text with what the search found in it marked.
function Marked({ parts }) {
  return parts.map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded-sm bg-warning-soft text-warning-soft-fg">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

// query: the search these clients were found with, marked where each one matched.
function columns(query) {
  const marked = (text) => <Marked parts={matchParts(text, query)} />;
  return [
    {
      key: "name",
      header: "Client",
      cell: (client) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link
            to={`/clients/${client.id}`}
            className={`font-medium hover:text-primary hover:underline ${client.archived ? "text-muted" : "text-fg"}`}
          >
            {marked(client.name)}
          </Link>
          {client.archived && <Badge>Archived</Badge>}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (client) =>
        client.phone ? (
          <a href={`tel:${client.phone}`} className="link font-normal">
            <Marked parts={phoneMatchParts(client.phone, query)} />
          </a>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "address",
      header: "Address",
      cell: (client) =>
        client.address ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 text-muted">
            {marked(client.address)} <MapLink address={client.address} />
          </span>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "email",
      header: "Email",
      mobile: false,
      className: "max-w-56",
      cell: (client) =>
        client.email ? (
          <a href={`mailto:${client.email}`} className="link font-normal [overflow-wrap:anywhere]">
            {marked(client.email)}
          </a>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "notes",
      header: "Notes",
      mobile: false,
      className: "max-w-xs",
      cell: (client) => <span className="line-clamp-1 text-muted">{client.notes ? marked(client.notes) : "—"}</span>,
    },
  ];
}

export default function ClientList({ clients, query = "" }) {
  return <DataTable columns={columns(query)} rows={clients} caption="Clients" />;
}
