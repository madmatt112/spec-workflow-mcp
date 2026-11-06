// src/dashboard_frontend/src/modules/ws/retry-delay.ts
//
// Design C10 "Reconnect". Pure, no DOM types, no React.
export function retryDelayFor(delay: number, cap: number | null): number {
  return cap === null ? delay : Math.min(delay, cap);
}
