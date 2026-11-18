// Names for a list of clients to pick from, as a Map of id to label. Two clients can share
// a name (one customer with two addresses, each its own client), so those also show their
// address, or their phone when they have no address.
export function clientLabels(clients) {
  const key = (client) => String(client.name).trim().toLowerCase();
  const counts = new Map();
  for (const client of clients) counts.set(key(client), (counts.get(key(client)) || 0) + 1);
  return new Map(
    clients.map((client) => {
      const detail = counts.get(key(client)) > 1 && (client.address || client.phone);
      return [client.id, detail ? `${client.name} (${detail})` : client.name];
    }),
  );
}
