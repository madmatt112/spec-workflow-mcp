import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Integration test for harness/hooks/sdd-activity.sh (Component 5, Requirement 3).
// Drives the real hook script with a fake pointer file and hook payloads and asserts on
// the JSON lines it appends. Assertions read only fields the node 20 fs docs guarantee.

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../../harness/hooks/sdd-activity.sh');

describe('sdd-activity.sh spawn events', () => {
  let root: string;
  let checkout: string;
  let specDir: string;
  let xdgState: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'hook-spawn-'));
    checkout = join(root, 'checkout');
    specDir = join(root, 'store', '.spec-workflow', 'specs', 'harness-bookkeeping');
    xdgState = join(root, 'state');
    await fs.mkdir(checkout, { recursive: true });
    await fs.mkdir(specDir, { recursive: true });
    await fs.mkdir(join(xdgState, 'sdd'), { recursive: true });
    await fs.writeFile(join(xdgState, 'sdd', 'active-run'), `${checkout}\t${specDir}\tRUN-1\n`);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  function runHook(payload: Record<string, unknown>): void {
    execFileSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: checkout, ...payload }),
      env: { ...process.env, HOME: root, XDG_STATE_HOME: xdgState },
    });
  }

  function eventLines(): Array<Record<string, unknown>> {
    const p = join(specDir, 'harness-events.jsonl');
    if (!existsSync(p)) return [];
    return readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  it('writes one spawn.start for a brief-launched sdd worker on PreToolUse', () => {
    runHook({
      hook_event_name: 'PreToolUse',
      agent_type: 'spec-workflow-harness:sdd-implementation-orchestrator',
      session_id: 's1',
      agent_id: 'a1',
      tool_name: 'Agent',
      tool_input: {
        subagent_type: 'spec-workflow-harness:sdd-implementer',
        prompt: 'Read and execute the instructions in /tmp/scratchpad/sdd/harness-bookkeeping/impl-brief-task-5.md',
      },
    });

    const events = eventLines();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'spawn.start',
      run: 'RUN-1',
      spec: basename(specDir),
      agent: 'sdd-implementer',
      role: 'impl',
    });
    expect(typeof events[0].ts).toBe('string');

    // The existing activity write stays intact (Requirement 3.7).
    const activity = readFileSync(join(specDir, 'harness-activity.jsonl'), 'utf8').trim();
    expect(JSON.parse(activity).event).toBe('tool');
  });

  it('derives role from the brief filename stem before -brief', () => {
    runHook({
      hook_event_name: 'PreToolUse',
      agent_type: 'spec-workflow-harness:sdd-document-orchestrator',
      tool_input: {
        subagent_type: 'spec-workflow-harness:sdd-adjudicator',
        prompt: 'brief: /tmp/scratchpad/sdd/harness-bookkeeping/adjudication-brief-requirements.md',
      },
    });
    const events = eventLines();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'spawn.start', agent: 'sdd-adjudicator', role: 'adjudication' });
  });

  it('writes one spawn.end for a non-orchestrator sdd worker on SubagentStop', () => {
    runHook({
      hook_event_name: 'SubagentStop',
      agent_type: 'spec-workflow-harness:sdd-implementer',
      session_id: 's1',
      agent_id: 'a1',
    });
    const events = eventLines();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'spawn.end',
      run: 'RUN-1',
      spec: basename(specDir),
      agent: 'sdd-implementer',
    });
    expect(events[0].role).toBeUndefined();
  });

  it('writes no spawn.end for an orchestrator on SubagentStop', () => {
    runHook({
      hook_event_name: 'SubagentStop',
      agent_type: 'spec-workflow-harness:sdd-implementation-orchestrator',
    });
    expect(eventLines()).toHaveLength(0);
  });

  it('writes no spawn.start when the spawned child is not an sdd-* agent (3.4)', () => {
    runHook({
      hook_event_name: 'PreToolUse',
      agent_type: 'spec-workflow-harness:sdd-implementation-orchestrator',
      tool_input: {
        subagent_type: 'Explore',
        prompt: 'Read /tmp/scratchpad/sdd/harness-bookkeeping/impl-brief-task-5.md',
      },
    });
    expect(eventLines()).toHaveLength(0);
  });

  it('writes no spawn.start when the prompt carries no brief path', () => {
    runHook({
      hook_event_name: 'PreToolUse',
      agent_type: 'spec-workflow-harness:sdd-implementation-orchestrator',
      tool_input: {
        subagent_type: 'spec-workflow-harness:sdd-reviewer',
        prompt: 'Review the requirements against the adversarial prompt.',
      },
    });
    expect(eventLines()).toHaveLength(0);
  });
});
