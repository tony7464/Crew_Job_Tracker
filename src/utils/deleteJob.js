// The wording for deleting a job: the same on the job page and in the calendar's quick view.
// job: needs kind ("work" or "estimate") and series_id.
export function deleteJobCopy(job) {
  const estimate = job?.kind === "estimate";
  const parts = [
    estimate
      ? "Removes this visit, its notes log, photos, and materials. Its quote stays as a draft."
      : "Removes this job, its notes log, and its photos.",
  ];
  if (job?.series_id) parts.push("Only this visit is removed; the rest of the repeating series stays.");
  parts.push("This cannot be undone.");
  return { label: estimate ? "Delete visit" : "Delete job", description: parts.join(" ") };
}
