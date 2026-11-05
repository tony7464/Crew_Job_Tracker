import { buttonClass, cx } from "./ui/styles";
import { MapPinIcon } from "./ui/Icons";

function mapUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

// asButton: a full button (for phones in the field) instead of an inline link.
export default function MapLink({ address, asButton = false, label = "Map" }) {
  const query = typeof address === "string" ? address.trim() : "";
  if (!query) return null;

  return (
    <a
      href={mapUrl(query)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        asButton
          ? buttonClass({ variant: "secondary", size: "md" })
          : cx("link inline-flex items-center gap-0.5 text-sm")
      }
    >
      <MapPinIcon className={asButton ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {label}
    </a>
  );
}
