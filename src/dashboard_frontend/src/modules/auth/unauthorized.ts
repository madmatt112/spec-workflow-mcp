// Patch window.fetch once so any 401 from a same-origin request raises a single
// 'sdd-unauthorized' event. The access control (controller-design.md §17)
// answers 401 for an unauthenticated request; the shell shows its login panel in
// response. The patch is installed at module load, before React mounts, so the
// first data fetches are covered too. A 401 from the login endpoint itself is
// ignored: a wrong secret is reported in the panel, not by reopening it.

export const UNAUTHORIZED_EVENT = 'sdd-unauthorized';

let patched = false;
let seenUnauthorized = false;

export function hasSeenUnauthorized(): boolean {
  return seenUnauthorized;
}

export function installUnauthorizedHandler(): void {
  if (patched || typeof window === 'undefined' || !window.fetch) return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await original(input as any, init);
    if (res.status === 401) {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (!url.includes('/api/login')) {
        seenUnauthorized = true;
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    }
    return res;
  };
}
