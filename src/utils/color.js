// Same palette as EMPLOYEE_PALETTE in server/models.py.
export const EMPLOYEE_PALETTE = [
  ["#2563eb", "Blue"],
  ["#16a34a", "Green"],
  ["#d97706", "Amber"],
  ["#dc2626", "Red"],
  ["#7c3aed", "Violet"],
  ["#0891b2", "Cyan"],
  ["#db2777", "Pink"],
  ["#65a30d", "Lime"],
  ["#ea580c", "Orange"],
  ["#4f46e5", "Indigo"],
  ["#0d9488", "Teal"],
  ["#9333ea", "Purple"],
];

// Used for people with no color yet, and for unassigned jobs.
export const FALLBACK_COLOR = "#64748b";

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value) {
  return typeof value === "string" && HEX.test(value);
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// Black or white, whichever has more contrast on a solid background of this color.
export function readableText(hex) {
  if (!isHexColor(hex)) return "#ffffff";
  const light = luminance(hex);
  // Contrast with white is 1.05 / (L + 0.05); with black, (L + 0.05) / 0.05.
  return 1.05 / (light + 0.05) >= (light + 0.05) / 0.05 ? "#ffffff" : "#111827";
}

export function personColor(person) {
  return isHexColor(person?.color) ? person.color : FALLBACK_COLOR;
}

export function initials(name = "") {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
