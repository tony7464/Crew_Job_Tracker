import { Link } from "react-router-dom";
import MapLink from "./MapLink";
import { Badge } from "./ui/Badge";
import { DataTable } from "./ui/DataTable";

const COLUMNS = [
  {
    key: "name",
    header: "Client",
    cell: (client) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Link
          to={`/clients/${client.id}`}
          className={`font-medium hover:text-primary hover:underline ${client.archived ? "text-muted" : "text-fg"}`}
        >
          {client.name}
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
        <a href={`tel:${client.phone}`} className="link font-normal">{client.phone}</a>
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
          {client.address} <MapLink address={client.address} />
        </span>
      ) : (
        <span className="text-subtle">—</span>
      ),
  },
  {
    key: "notes",
    header: "Notes",
    mobile: false,
    className: "max-w-xs",
    cell: (client) => <span className="line-clamp-1 text-muted">{client.notes || "—"}</span>,
  },
];

export default function ClientList({ clients }) {
  return <DataTable columns={COLUMNS} rows={clients} caption="Clients" />;
}
