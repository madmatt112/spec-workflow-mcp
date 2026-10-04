import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { projectsDir, resolveSession, findTranscript } from '../transcripts.js';
import type { ActivityEvent } from '../ledger.js';

function tmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('projectsDir', () => {
  it('returns $CLAUDE_CONFIG_DIR/projects when the variable is set', () => {
    const env = { CLAUDE_CONFIG_DIR: '/cfg/claude' } as unknown as NodeJS.ProcessEnv;
    expect(projectsDir(env, '/home/someone')).toBe(join('/cfg/claude', 'projects'));
  });

  it('falls back to <home>/.claude/projects when the variable is unset', () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(projectsDir(env, '/home/someone')).toBe(join('/home/someone', '.claude', 'projects'));
  });
});

describe('resolveSession', () => {
  it('returns the session of the first activity row carrying this agentId', () => {
    const activity: ActivityEvent[] = [
      { ts: 't0', agent: 'sdd-implementer', event: 'agent.start', agentId: 'other-agent', session: 'wrong-session' },
      { ts: 't1', agent: 'sdd-implementer', event: 'tool', agentId: 'agent-123', session: 'right-session' },
      { ts: 't2', agent: 'sdd-implementer', event: 'tool', agentId: 'agent-123', session: 'later-session' },
    ];
    expect(resolveSession(activity, 'agent-123')).toBe('right-session');
  });
});

describe('findTranscript', () => {
  it('returns invalid-id when the session or the agentId fails the id pattern', async () => {
    const dir = tmpDir('transcripts-invalid-');
    expect(await findTranscript('bad session', 'agent1', dir)).toEqual({ ok: false, reason: 'invalid-id' });
    expect(await findTranscript('session1', 'bad/id', dir)).toEqual({ ok: false, reason: 'invalid-id' });
  });

  it('returns missing when the projects directory does not exist', async () => {
    const dir = join(tmpdir(), 'transcripts-missing-' + Date.now());
    expect(await findTranscript('session1', 'agent1', dir)).toEqual({ ok: false, reason: 'missing' });
  });

  it('skips a symlinked project entry, even when it holds a matching transcript', async () => {
    const dir = tmpDir('transcripts-symlink-entry-');
    const outside = tmpDir('transcripts-symlink-entry-outside-');
    mkdirSync(join(outside, 'session1', 'subagents'), { recursive: true });
    writeFileSync(join(outside, 'session1', 'subagents', 'agent-agent1.jsonl'), '{}');
    // A symlinked project entry reports isDirectory() false under withFileTypes (design probe).
    symlinkSync(outside, join(dir, 'linked-project'));

    expect(await findTranscript('session1', 'agent1', dir)).toEqual({ ok: false, reason: 'missing' });
  });

  it('skips a candidate whose realpath escapes the projects directory', async () => {
    const dir = tmpDir('transcripts-escape-');
    const outside = tmpDir('transcripts-escape-outside-');
    mkdirSync(join(dir, 'proj1'), { recursive: true });
    mkdirSync(join(outside, 'subagents'), { recursive: true });
    writeFileSync(join(outside, 'subagents', 'agent-agent1.jsonl'), '{}');
    // The session segment is a symlink that escapes the projects directory.
    symlinkSync(outside, join(dir, 'proj1', 'session1'));

    expect(await findTranscript('session1', 'agent1', dir)).toEqual({ ok: false, reason: 'missing' });
  });

  it('finds the transcript when more than one project directory holds the session', async () => {
    const dir = tmpDir('transcripts-multi-');
    mkdirSync(join(dir, 'proj-a', 'session1', 'subagents'), { recursive: true });
    mkdirSync(join(dir, 'proj-b', 'session1', 'subagents'), { recursive: true });
    writeFileSync(join(dir, 'proj-a', 'session1', 'subagents', 'agent-agent1.jsonl'), 'a');
    writeFileSync(join(dir, 'proj-b', 'session1', 'subagents', 'agent-agent1.jsonl'), 'b');

    const result = await findTranscript('session1', 'agent1', dir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([
        join(dir, 'proj-a', 'session1', 'subagents', 'agent-agent1.jsonl'),
        join(dir, 'proj-b', 'session1', 'subagents', 'agent-agent1.jsonl'),
      ]).toContain(result.path);
    }
  });
});
