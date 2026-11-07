import { api } from "../api";

// [value, label] for the Repeat picker. The value is "repeat:every"; "" does not repeat.
export const REPEAT_OPTIONS = [
  ["", "Does not repeat"],
  ["weekly:1", "Every week"],
  ["weekly:2", "Every 2 weeks"],
  ["weekly:3", "Every 3 weeks"],
  ["weekly:4", "Every 4 weeks"],
  ["monthly:1", "Every month"],
  ["monthly:2", "Every 2 months"],
  ["monthly:3", "Every 3 months"],
];

export function repeatValue(series) {
  return series ? `${series.repeat}:${series.every}` : "";
}

// { repeat, every } from a picker value, or null for "does not repeat".
export function parseRepeat(value) {
  if (!value) return null;
  const [repeat, every] = value.split(":");
  return { repeat, every: Number(every) };
}

// The picker's options, plus the series' own pattern if it is not one of them.
export function repeatOptions(series) {
  const value = repeatValue(series);
  if (!value || REPEAT_OPTIONS.some(([option]) => option === value)) return REPEAT_OPTIONS;
  const unit = series.repeat === "weekly" ? "weeks" : "months";
  return [...REPEAT_OPTIONS, [value, `Every ${series.every} ${unit}`]];
}

// Add a job from JobForm's body. With body.repeat set, the job is then made to repeat,
// as the series' first visit.
export async function createJob(body) {
  const { repeat, ...job } = body;
  const created = await api("/api/jobs", { method: "POST", body: job });
  if (repeat) {
    try {
      await api("/api/series", { method: "POST", body: { from_job_id: created.id, ...repeat } });
    } catch (err) {
      const error = new Error(`The job was added, but it could not be set to repeat: ${err.message} Open the job to try again.`);
      error.status = err.status;
      throw error;
    }
  }
  return created;
}
