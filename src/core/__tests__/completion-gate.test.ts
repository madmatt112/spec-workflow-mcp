import { describe, it, expect } from 'vitest';
import { ledgerHasUnresolvedCompletionGate } from '../completion-gate.js';
import { LedgerEvent } from '../../watch/ledger.js';

function ev(type: string, extra: Partial<LedgerEvent> = {}): LedgerEvent {
  return { ts: '2026-01-01T00:00:00.000Z', type, ...extra };
}

describe('ledgerHasUnresolvedCompletionGate', () => {
  it('blocks when the newest phase.end has result escalate and nothing reopens', () => {
    const ledger: LedgerEvent[] = [
      ev('phase.start', { ts: '2026-01-01T00:00:01.000Z', phase: 'implementation' }),
      ev('phase.end', { ts: '2026-01-01T00:00:02.000Z', phase: 'implementation', result: 'escalate' }),
    ];
    expect(ledgerHasUnresolvedCompletionGate(ledger)).toBe(true);
  });

  it('blocks when the newest phase.end has no result key', () => {
    const ledger: LedgerEvent[] = [
      ev('phase.end', { ts: '2026-01-01T00:00:02.000Z', phase: 'implementation', state: 'tasks 18/18' }),
    ];
    expect(ledgerHasUnresolvedCompletionGate(ledger)).toBe(true);
  });

  it('does not block when a later phase.start reopens a phase', () => {
    const ledger: LedgerEvent[] = [
      ev('phase.end', { ts: '2026-01-01T00:00:02.000Z', phase: 'implementation', result: 'escalate' }),
      ev('phase.start', { ts: '2026-01-01T00:00:03.000Z', phase: 'implementation' }),
    ];
    expect(ledgerHasUnresolvedCompletionGate(ledger)).toBe(false);
  });

  it('does not block when the newest phase.end resolved normally', () => {
    const ledger: LedgerEvent[] = [
      ev('phase.end', { ts: '2026-01-01T00:00:02.000Z', phase: 'implementation', result: 'complete' }),
    ];
    expect(ledgerHasUnresolvedCompletionGate(ledger)).toBe(false);
  });

  it('does not block an empty ledger', () => {
    expect(ledgerHasUnresolvedCompletionGate([])).toBe(false);
  });
});
