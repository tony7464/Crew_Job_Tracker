// How the pieces this app adds to the website editor's side panel look. That panel is the
// editor's own and is always light, whatever theme the app is in, so these use plain light
// colors, not the app's theme colors (which turn dark with the app).
export const PANEL_BUTTON =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 " +
  "hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50";
export const PANEL_QUIET =
  "inline-flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
  "disabled:pointer-events-none disabled:opacity-50";
export const PANEL_INPUT =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-blue-600 focus:outline-none";
export const PANEL_NOTE = "text-xs text-slate-500";
