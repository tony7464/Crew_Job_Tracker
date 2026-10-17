export default function MapLink({ address }) {
  const query = typeof address === "string" ? address.trim() : "";
  if (!query) return null;

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-800 hover:underline"
    >
      Map
    </a>
  );
}
