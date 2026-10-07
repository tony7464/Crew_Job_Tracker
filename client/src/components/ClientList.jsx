import { Link } from "react-router-dom";

export default function ClientList({ clients }) {
  if (!clients.length) {
    return <p className="text-slate-500">No clients yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
      {clients.map((client) => (
        <li key={client.id}>
          <Link to={`/clients/${client.id}`} className="block px-4 py-3 hover:bg-slate-50">
            <span className="font-medium">{client.name}</span>
            {client.phone && <span className="mt-1 block text-sm text-slate-500">{client.phone}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
