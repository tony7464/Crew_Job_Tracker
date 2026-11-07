import { apiUrl } from "../api";

// Same values as the server (JOB_PHOTO_KINDS).
export const PHOTO_KINDS = [
  ["before", "Before"],
  ["after", "After"],
  ["progress", "Progress"],
  ["issue", "Issue"],
];
export const KIND_LABELS = Object.fromEntries(PHOTO_KINDS);
export const KIND_TONES = { before: "neutral", after: "success", progress: "primary", issue: "danger" };
export const MAX_CAPTION = 200;
export const MAX_NOTE_PHOTOS = 10;

// Photo links are signed R2 URLs (absolute) or, in local development, API paths.
export function photoSrc(photo, size = "full") {
  return apiUrl(size === "thumb" ? photo.thumb_url : photo.url);
}
