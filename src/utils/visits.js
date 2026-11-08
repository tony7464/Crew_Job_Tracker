// Estimate visits: free visits (Job.kind "estimate") to look at the work and quote it.

export function isEstimate(job) {
  return job?.kind === "estimate";
}

function minutesOf(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

// The jobs on the same day that overlap [time, time + minutes), among those with any of
// the people in crewIds (or every job when crewIds is empty). Cancelled jobs never count.
export function overlaps(jobs, { date, time, minutes, crewIds = [], skipId = null }) {
  if (!date || !time) return [];
  const start = minutesOf(time);
  const end = start + minutes;
  const crew = new Set(crewIds);
  return jobs.filter((job) => {
    if (job.id === skipId || job.status === "cancelled" || job.date !== date) return false;
    if (crew.size && !job.assignees.some((person) => crew.has(person.id))) return false;
    const jobStart = minutesOf(job.time);
    const jobEnd = jobStart + (job.duration_minutes ?? 60);
    return jobStart < end && start < jobEnd;
  });
}
