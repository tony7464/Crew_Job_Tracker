export function isOwner(user) {
  return user?.role === "owner";
}

export function isEmployee(user) {
  return user?.role === "employee";
}

// Managers are employees with client access ("can_manage_clients", once called leads).
export function isManager(user) {
  return Boolean(isEmployee(user) && user.can_manage_clients);
}

export function roleLabel(user) {
  if (isOwner(user)) return "Owner";
  return isManager(user) ? "Manager" : "Employee";
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

const COMPANY_ROLE_NAMES = { owner: "Owner", manager: "Manager", employee: "Employee" };

// The role in one of your companies (user.companies[].role): "owner", "manager", or "employee".
export function companyRoleName(role) {
  return COMPANY_ROLE_NAMES[role] || "Employee";
}

// Companies this person can work in now: approved and turned on.
export function usableCompanies(user) {
  return (user?.companies || []).filter((company) => company.usable);
}
