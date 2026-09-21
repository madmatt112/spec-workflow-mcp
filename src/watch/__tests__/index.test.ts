import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runWatch } from '../index.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '../../__tests__/fixtures/usage-ledger.jsonl');

/** Just enough of a raw-mode TTY to drive the key loop and observe its release. */
class FakeTty extends EventEmitter {
  isTTY = true;
  raw: boolean | undefined;
  paused = false;
  unrefed = false;
  setRawMode(v: boolean) { this.raw = v; return this; }
  resume() { this.paused = false; return this; }
  pause() { this.paused = true; return this; }
  unref() { this.unrefed = true; return this; }
  setEncoding() { return this; }
}

class FakeOut {
  isTTY = true;
  columns = 100;
  chunks: string[] = [];
  write(s: string) { this.chunks.push(s); return true; }
}

function specStore(): string {
  const root = mkdtempSync(join(tmpdir(), 'sdd-watch-'));
  const wf = join(root, '.spec-workflow');
  mkdirSync(join(wf, 'specs', 's'), { recursive: true });
  writeFileSync(join(wf, 'specs', 's', 'tasks.md'), '# Tasks\n- [ ] 1. One\n');
  return wf;
}

/** A temp store holding the committed fixture as the `usage-fixture` spec's ledger (D8). */
function fixtureStore(): string {
  const root = mkdtempSync(join(tmpdir(), 'sdd-watch-'));
  const wf = join(root, '.spec-workflow');
  mkdirSync(join(wf, 'specs', 'usage-fixture'), { recursive: true });
  copyFileSync(FIXTURE, join(wf, 'specs', 'usage-fixture', 'harness-events.jsonl'));
  return wf;
}

describe('runWatch', () => {
  it('releases stdin and returns when q is pressed', async () => {
    const input = new FakeTty();
    const out = new FakeOut();
    const done = runWatch({
      workflowRoot: specStore(),
      specName: 's',
      color: false,
      now: () => new Date('2026-09-13T10:00:00.000Z'),
      out: out as unknown as NodeJS.WriteStream,
      input: input as unknown as NodeJS.ReadStream,
    });
    // runWatch checks the spec directory first, then draws and attaches the key listener.
    await new Promise(r => setTimeout(r, 100));
    expect(input.raw).toBe(true);
    expect(input.listenerCount('data')).toBe(1);
    input.emit('data', 'q');
    await done;
    expect(input.raw).toBe(false);
    expect(input.paused).toBe(true);
    expect(input.unrefed).toBe(true);
    expect(input.listenerCount('data')).toBe(0);
    expect(process.listenerCount('SIGINT')).toBe(0);
    expect(out.chunks.join('')).toContain('?1049l');
  });

  it('renders once and returns without touching stdin in --once mode', async () => {
    const input = new FakeTty();
    const out = new FakeOut();
    await runWatch({ workflowRoot: specStore(), specName: 's', once: true, color: false, out: out as unknown as NodeJS.WriteStream, input: input as unknown as NodeJS.ReadStream });
    expect(input.raw).toBeUndefined();
    expect(out.chunks.join('')).toContain('no harness-events.jsonl');
  });

  it('renders the fixture --once frame with the live phase and orchestrator tier line', async () => {
    const input = new FakeTty();
    const out = new FakeOut();
    await runWatch({ workflowRoot: fixtureStore(), specName: 'usage-fixture', once: true, color: false, out: out as unknown as NodeJS.WriteStream, input: input as unknown as NodeJS.ReadStream });
    const frame = out.chunks.join('');
    expect(frame).toContain('tokens 1.6M');
    expect(frame).toContain('+ sdd-document-orchestrator');
    expect(frame).toContain('requirements phase, spawn 2');
    expect(frame).toContain('1.0M tok');
    expect(frame).toContain('declared claude-opus-4-8 high');
    expect(frame).toContain('actual claude-opus-4-8');
    expect(frame).not.toContain('!=');
  });
});
