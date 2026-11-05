// The calendar's "hidden" set and the saved schedule preferences describe the same
// thing. hidden holds "e:<employee id>", "unassigned", and "lunches".

export function hiddenFromPrefs(prefs) {
  const hidden = new Set((prefs?.hidden_employee_ids || []).map((id) => `e:${id}`));
  if (prefs && !prefs.show_unassigned) hidden.add("unassigned");
  if (prefs && !prefs.show_lunches) hidden.add("lunches");
  return hidden;
}

export function prefsFromHidden(hidden) {
  return {
    hidden_employee_ids: [...hidden]
      .filter((key) => key.startsWith("e:"))
      .map((key) => Number(key.slice(2)))
      .sort((a, b) => a - b),
    show_unassigned: !hidden.has("unassigned"),
    show_lunches: !hidden.has("lunches"),
  };
}
