// Joins the optional API origin (VITE_API_BASE) onto a root-relative API path.
// Empty base: the path is returned as is ("/api/..."), for the Vite proxy and
// the monolith. Absolute URLs (Stripe, webcal, Google) are never touched.
export function joinApiBase(base, path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return path;
  const origin = (base || "").trim().replace(/\/+$/, "");
  return origin ? origin + path : path;
}
