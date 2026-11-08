export function isOwner(user) {
  return user?.role === "owner";
}

export function isEmployee(user) {
  return user?.role === "employee";
}

export function hasClientAccess(user) {
  return isOwner(user) || Boolean(isEmployee(user) && user.can_manage_clients);
}

// The team schedule: the owner, and employees with client access (read-only, no prices).
export function canSeeTeamSchedule(user) {
  return hasClientAccess(user);
}

// The requests inbox: the owner, and employees with client access (they turn requests into clients).
export function canSeeRequests(user) {
  return hasClientAccess(user);
}

// Quoting on site: the owner, and employees the owner lets quote their estimate visits.
export function canQuote(user) {
  return isOwner(user) || Boolean(isEmployee(user) && user.can_quote);
}

export function homePath(user) {
  if (!user) return "/login";
  return isOwner(user) ? "/dashboard" : "/my-jobs";
}

// allow: "owner", "employee", "clients", "team", "requests", or undefined for any logged-in user.
export function canVisit(user, allow) {
  if (!allow) return Boolean(user);
  if (allow === "owner") return isOwner(user);
  if (allow === "employee") return isEmployee(user);
  if (allow === "clients") return hasClientAccess(user);
  if (allow === "team") return canSeeTeamSchedule(user);
  if (allow === "requests") return canSeeRequests(user);
  return false;
}
