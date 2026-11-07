// src/dashboard_frontend/src/modules/projects/enable.ts
//
// Design C8 "Project enable state". Pure helpers, no DOM types and no React.
export const DEFAULT_OFF_NAMES: readonly string[] = ['sdd-fixture'];

export function isEnabled(id: string, name: string, off: string[], on: string[]): boolean {
  if (on.includes(id)) return true;
  if (off.includes(id)) return false;
  return !DEFAULT_OFF_NAMES.includes(name);
}

export function toggled(
  id: string,
  name: string,
  off: string[],
  on: string[]
): { off: string[]; on: string[] } {
  const currentlyEnabled = isEnabled(id, name, off, on);
  if (currentlyEnabled) {
    return { off: [...off, id], on: on.filter((x) => x !== id) };
  }
  return { off: off.filter((x) => x !== id), on: [...on, id] };
}
