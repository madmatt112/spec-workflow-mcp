import React, { useState } from 'react';
import { Button } from '../ui/ui';

/**
 * Opens (or reports) the operator's advisor conversation (design C7, C12),
 * hosted in the header.
 */
export function OpenAdvisor() {
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<{ state: 'live'; name: string } | { state: 'command'; command: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch('/api/controller/advisor/open', { method: 'POST' });
      if (!res.ok) throw new Error(`open failed (${res.status})`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e?.message ?? 'open failed');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button variant="secondary" onClick={open} disabled={opening} data-testid="open-advisor">
        {'Open advisor'}
      </Button>
      {result && (
        <span className="min-w-0 whitespace-normal break-words text-xs text-(--text-muted)">
          {result.state === 'live'
            ? `Running: open "${result.name}" in the Claude app, or tmux attach -t ${result.name}`
            : `Did not start. Run in a terminal: ${result.command}`}
        </span>
      )}
      {error && <span className="text-xs text-(--tone-danger-fg)">{error}</span>}
    </div>
  );
}
