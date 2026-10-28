import React, { useEffect, useState } from 'react';
import { useWs } from '../ws/WebSocketProvider';

/** Show the banner only after the socket has been down this long, so a quick reconnect does not flash it. */
const GRACE_MS = 3000;

/**
 * Full-width notice while the dashboard cannot reach the controller: what is
 * wrong, that the data on screen may be stale, when the next retry is, and a
 * button to retry now. Hidden while connected and during the first seconds of a
 * drop.
 */
export function ConnectionBanner() {
  const { connected, nextRetryAt, retryNow } = useWs();
  const [downSince, setDownSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setDownSince(connected ? null : (prev) => prev ?? Date.now());
  }, [connected]);

  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [connected]);

  if (connected || downSince === null || now - downSince < GRACE_MS) return null;
  const wait = nextRetryAt ? Math.max(0, Math.ceil((nextRetryAt - now) / 1000)) : null;

  return (
    <div
      role="alert"
      data-testid="connection-banner"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-4 py-2 text-sm text-[var(--status-error)]"
    >
      <span className="font-medium">{"Can't reach the controller."}</span>
      <span className="text-[var(--text-secondary)]">
        {'What you see may be out of date.'}
        {wait !== null && ` Retrying in ${wait}s.`}
      </span>
      <button
        type="button"
        onClick={retryNow}
        className="rounded-md border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
      >
        {'Retry now'}
      </button>
    </div>
  );
}
