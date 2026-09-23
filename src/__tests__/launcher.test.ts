import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Integration test for the launcher body harness/skills/sdd-continue/references/sdd-launch.sh
// (Component 3, Requirements 2, 3, 4, 7). Drives the real body with a stub `claude` first on
// PATH and a temp config root, and asserts the refusals, the two ledger rows, the child's
// argv and environment, and both exit paths. Assertions read only fields node 20 guarantees:
// execFileSync options input/env/cwd, the thrown error's status/stdout/stderr, and fs
// read/write/mkdir/existsSync (design Testing Strategy, .spec-workflow/agent-rules.md:30-32).

const BODY = join(dirname(fileURLToPath(import.meta.url)), '../../harness/skills/sdd-continue/references/sdd-launch.sh');

const RUN = 'RUN-1';
const REPORT = 'launcher-stub-report: ok\n';
const FAKE_KEY = 'sk-deepseek-fake-test-000';
const REVIEWER_TOOLS = 'Read,Grep,Glob,Bash,Write';

// Fixture transcript of hook-spawn-events.test.ts:58-94: three assistant entries with
// message.usage (two models), one user entry, one assistant entry without usage, one torn
// line. The test computes the expected sums from these literals itself.
const usageEntries = [
  { model: 'claude-opus-4-8', input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 200 },
  { model: 'claude-sonnet-5', input_tokens: 50, output_tokens: 10, cache_creation_input_tokens: 3, cache_read_input_tokens: 40 },
  { model: 'claude-opus-4-8', input_tokens: 7, output_tokens: 2, cache_creation_input_tokens: 1, cache_read_input_tokens: 8 },
];
const expected = {
  input: usageEntries.reduce((n, u) => n + u.input_tokens, 0),
  output: usageEntries.reduce((n, u) => n + u.output_tokens, 0),
  cacheWrite: usageEntries.reduce((n, u) => n + u.cache_creation_input_tokens, 0),
  cacheRead: usageEntries.reduce((n, u) => n + u.cache_read_input_tokens, 0),
};
const expectedTokens = expected.input + expected.output + expected.cacheWrite + expected.cacheRead;
const expectedModel = 'claude-opus-4-8+claude-sonnet-5';

const transcriptText = [
  ...usageEntries.map((u) => JSON.stringify({
    type: 'assistant',
    message: {
      model: u.model,
      usage: {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_creation_input_tokens: u.cache_creation_input_tokens,
        cache_read_input_tokens: u.cache_read_input_tokens,
      },
    },
  })),
  JSON.stringify({ type: 'user', message: { content: 'hi' } }),
  JSON.stringify({ type: 'assistant', message: { model: 'claude-ignored', content: [] } }),
  '{ torn line — not json',
].join('\n') + '\n';

// The event.sh from formats.md:170-182, with the run values baked in.
function eventScriptText(ledger: string, spec: string): string {
  return `#!/bin/bash
# usage: bash event.sh <type> key=value ...   (values may contain spaces; quote them)
export SDD_LEDGER="${ledger}"
export SDD_RUN="${RUN}"
export SDD_SPEC="${spec}"
node -e '
const [type, ...kv] = process.argv.slice(1);
const e = { ts: new Date().toISOString(), run: process.env.SDD_RUN, spec: process.env.SDD_SPEC, type };
for (const a of kv) { const i = a.indexOf("="); if (i > 0) e[a.slice(0, i)] = a.slice(i + 1); }
require("fs").appendFileSync(process.env.SDD_LEDGER, JSON.stringify(e) + "\\n");
' "$@"
`;
}

// A stub `claude`: dumps its argv and environment to files, writes the fixture transcript at
// CLAUDE_CONFIG_DIR/projects/SLUG/SID.jsonl for the slug of STUB_CODE_ROOT, prints a fixed
// report, and exits per STUB_EXIT.
function stubText(): string {
  return `#!/bin/bash
printf '%s\\0' "$@" > "$STUB_ARGV_FILE"
env > "$STUB_ENV_FILE"
sid=""
prev=""
for a in "$@"; do
  if [ "$prev" = "--session-id" ]; then sid="$a"; break; fi
  prev="$a"
done
if [ -z "\${STUB_NO_TRANSCRIPT:-}" ]; then
  slug=$(printf '%s' "$STUB_CODE_ROOT" | sed 's/[^A-Za-z0-9]/-/g')
  tdir="$CLAUDE_CONFIG_DIR/projects/$slug"
  mkdir -p "$tdir"
  cat "$STUB_TRANSCRIPT" > "$tdir/$sid.jsonl"
fi
printf '%s' "$STUB_REPORT"
exit "\${STUB_EXIT:-0}"
`;
}

// process.env.PATH with every directory that holds a `claude` executable removed, so the
// launcher's `command -v claude` fails while bash, node and the coreutils stay reachable.
function pathWithoutClaude(): string {
  return (process.env.PATH ?? '')
    .split(':')
    .filter((d) => d && !existsSync(join(d, 'claude')))
    .join(':');
}

describe('sdd-launch.sh launcher body', () => {
  let root: string;
  let checkout: string;   // SDD_CODE_ROOT
  let store: string;      // SDD_SPEC_STORE_REPO outside the code root
  let specDir: string;
  let ledger: string;
  let cfgDir: string;
  let xdgState: string;
  let stubDir: string;
  let eventScript: string;
  let transcriptFixture: string;
  let argvFile: string;
  let envFile: string;
  let sddSpec: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'launcher-'));
    checkout = join(root, 'checkout');
    store = join(root, 'store');
    specDir = join(root, 'store-spec');
    ledger = join(specDir, 'harness-events.jsonl');
    cfgDir = join(root, 'config');
    xdgState = join(root, 'state');
    stubDir = join(root, 'bin');
    eventScript = join(specDir, 'event.sh');
    transcriptFixture = join(root, 'transcript.jsonl');
    argvFile = join(root, 'argv.txt');
    envFile = join(root, 'env.txt');
    // Unique per test so the body's /tmp/scratchpad/sdd/<spec> scratch never collides.
    sddSpec = `provider-per-role-launchtest-${root.split('-').pop()}`;

    await fs.mkdir(checkout, { recursive: true });
    await fs.mkdir(store, { recursive: true });
    await fs.mkdir(specDir, { recursive: true });
    await fs.mkdir(cfgDir, { recursive: true });
    await fs.mkdir(xdgState, { recursive: true });
    await fs.mkdir(stubDir, { recursive: true });

    await fs.writeFile(eventScript, eventScriptText(ledger, sddSpec));
    await fs.writeFile(transcriptFixture, transcriptText);
    writeFileSync(join(stubDir, 'claude'), stubText(), { mode: 0o755 });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(join('/tmp/scratchpad/sdd', sddSpec), { recursive: true, force: true });
  });

  interface Opts {
    providers?: string;
    storeRepo?: string;
    noKey?: boolean;
    noClaude?: boolean;
    stubExit?: string;
    noTranscript?: boolean;
  }

  function makeEnv(opts: Opts): Record<string, string> {
    const env: Record<string, string> = {
      PATH: opts.noClaude ? pathWithoutClaude() : `${stubDir}:${process.env.PATH}`,
      HOME: root,
      CLAUDE_CONFIG_DIR: cfgDir,
      XDG_STATE_HOME: xdgState,
      // Per-run launch.sh exports (design.md:113-121).
      SDD_LAUNCH_BODY: BODY,
      SDD_EVENT_SCRIPT: eventScript,
      SDD_SPEC_DIR: specDir,
      SDD_RUN: RUN,
      SDD_SPEC: sddSpec,
      SDD_CODE_ROOT: checkout,
      SDD_SPEC_STORE_REPO: opts.storeRepo ?? store,
      SDD_HARNESS_REPO: checkout,
      SDD_PROVIDERS: opts.providers ?? 'sdd-reviewer:deepseek:deepseek-v4-pro',
      // A sentinel that the child must never carry (env -u ANTHROPIC_API_KEY).
      ANTHROPIC_API_KEY: 'sentinel-must-be-stripped',
      // Stub knobs.
      STUB_ARGV_FILE: argvFile,
      STUB_ENV_FILE: envFile,
      STUB_CODE_ROOT: checkout,
      STUB_TRANSCRIPT: transcriptFixture,
      STUB_REPORT: REPORT,
    };
    if (!opts.noKey) env.DEEPSEEK_API_KEY = FAKE_KEY;
    if (opts.stubExit) env.STUB_EXIT = opts.stubExit;
    if (opts.noTranscript) env.STUB_NO_TRANSCRIPT = '1';
    return env;
  }

  function runBody(agent: string, message: string, opts: Opts = {}): { status: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync('bash', [BODY, agent, message], { env: makeEnv(opts), cwd: checkout });
      return { status: 0, stdout: stdout.toString(), stderr: '' };
    } catch (e: any) {
      return {
        status: e.status,
        stdout: (e.stdout ?? Buffer.from('')).toString(),
        stderr: (e.stderr ?? Buffer.from('')).toString(),
      };
    }
  }

  function eventLines(): Array<Record<string, unknown>> {
    if (!existsSync(ledger)) return [];
    return readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  function childArgs(): string[] {
    const parts = readFileSync(argvFile, 'utf8').split('\0');
    parts.pop(); // trailing '' after the last NUL
    return parts;
  }

  function argVal(args: string[], flag: string): string | undefined {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  }

  function childEnv(): Record<string, string> {
    const m: Record<string, string> = {};
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) m[line.slice(0, i)] = line.slice(i + 1);
    }
    return m;
  }

  // --- Refusals: exit 2, one stderr line, no ledger row (Req 4.3, 2.8, Error Handling 1, 3). ---

  it('refuses with exit 2 and writes no row when DEEPSEEK_API_KEY is unset', () => {
    const r = runBody('sdd-reviewer', 'msg', { noKey: true });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('launcher: DEEPSEEK_API_KEY unset');
    expect(eventLines()).toHaveLength(0);
  });

  it('refuses with exit 2 and writes no row for an agent absent from SDD_PROVIDERS', () => {
    const r = runBody('sdd-checker', 'msg', { providers: 'sdd-reviewer:deepseek:deepseek-v4-pro' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('sdd-checker is not a deepseek provider');
    expect(eventLines()).toHaveLength(0);
  });

  it('refuses with exit 2 and writes no row for a mapped agent whose file is missing', () => {
    const r = runBody('sdd-ghost', 'msg', { providers: 'sdd-ghost:deepseek:deepseek-v4-pro' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('agent file missing for sdd-ghost');
    expect(eventLines()).toHaveLength(0);
  });

  it('refuses with exit 2 and writes no row when claude is not on PATH', () => {
    const r = runBody('sdd-reviewer', 'msg', { noClaude: true });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('claude not on PATH');
    expect(eventLines()).toHaveLength(0);
  });

  // --- The two ledger rows on a successful run (Req 2.2, 3.1, 3.2). ---

  it('writes the spawn.start keys for a deepseek-v4-pro worker', () => {
    const r = runBody('sdd-reviewer', 'Read and execute the instructions in /tmp/x.md');
    expect(r.status).toBe(0);
    const start = eventLines().find((e) => e.type === 'spawn.start')!;
    expect(start).toMatchObject({
      type: 'spawn.start',
      agent: 'sdd-reviewer',
      role: 'reviewer',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      effort: 'not-applied',
      run: RUN,
      spec: sddSpec,
    });
  });

  it('sums the transcript into spawn.end with the fixture literals and joined model (Req 3.1, 3.2)', () => {
    const r = runBody('sdd-reviewer', 'msg');
    expect(r.status).toBe(0);
    const events = eventLines();
    expect(events).toHaveLength(2);
    const end = events.find((e) => e.type === 'spawn.end')!;
    expect(end).toMatchObject({
      type: 'spawn.end',
      agent: 'sdd-reviewer',
      provider: 'deepseek',
      model: expectedModel,
      input: String(expected.input),
      output: String(expected.output),
      cacheWrite: String(expected.cacheWrite),
      cacheRead: String(expected.cacheRead),
      tokens: String(expectedTokens),
      run: RUN,
      spec: sddSpec,
    });
  });

  // --- The child argv and environment (Req 2.5, 2.6, 4.4, 7.5). ---

  it('builds the child env: no ANTHROPIC_API_KEY, the base URL, the token, the alias, scratch state', () => {
    const r = runBody('sdd-reviewer', 'msg');
    expect(r.status).toBe(0);
    const env = childEnv();
    expect('ANTHROPIC_API_KEY' in env).toBe(false);
    expect(env.ANTHROPIC_BASE_URL).toBe('https://api.deepseek.com/anthropic');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe(FAKE_KEY);
    expect(env.ANTHROPIC_MODEL).toBe('claude-opus-4-8');
    expect(env.XDG_STATE_HOME.startsWith('/tmp/scratchpad/sdd/')).toBe(true);
  });

  it('maps deepseek-v4-pro to claude-opus-4-8 on both --model and ANTHROPIC_MODEL', () => {
    runBody('sdd-reviewer', 'msg', { providers: 'sdd-reviewer:deepseek:deepseek-v4-pro' });
    expect(argVal(childArgs(), '--model')).toBe('claude-opus-4-8');
    expect(childEnv().ANTHROPIC_MODEL).toBe('claude-opus-4-8');
  });

  it('maps deepseek-flash to claude-sonnet-5 on both --model and ANTHROPIC_MODEL', () => {
    runBody('sdd-reviewer', 'msg', { providers: 'sdd-reviewer:deepseek:deepseek-flash' });
    expect(argVal(childArgs(), '--model')).toBe('claude-sonnet-5');
    expect(childEnv().ANTHROPIC_MODEL).toBe('claude-sonnet-5');
  });

  it('passes the fixed flags, the frontmatter --tools list, and a UUID --session-id', () => {
    runBody('sdd-reviewer', 'msg');
    const args = childArgs();
    expect(args).toContain('--strict-mcp-config');
    expect(argVal(args, '--permission-prompts')).toBe('none');
    expect(argVal(args, '--permission-mode')).toBe('auto');
    expect(argVal(args, '--output-format')).toBe('text');
    expect(argVal(args, '--tools')).toBe(REVIEWER_TOOLS);
    expect(argVal(args, '--session-id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('gives a fresh --session-id per call', () => {
    runBody('sdd-reviewer', 'msg');
    const sid1 = argVal(childArgs(), '--session-id');
    runBody('sdd-reviewer', 'msg');
    const sid2 = argVal(childArgs(), '--session-id');
    expect(sid1).toBeTruthy();
    expect(sid2).toBeTruthy();
    expect(sid1).not.toBe(sid2);
  });

  it('passes --mcp-config and --allowedTools for the reviser only (Req 2.6, D10)', () => {
    runBody('sdd-reviser', 'msg', { providers: 'sdd-reviser:deepseek:deepseek-v4-pro' });
    const reviser = childArgs();
    expect(reviser).toContain('--mcp-config');
    expect(argVal(reviser, '--mcp-config')).toBe(join(checkout, '.mcp.json'));
    expect(reviser).toContain('--allowedTools');
    expect(argVal(reviser, '--allowedTools')).toContain('mcp__spec-workflow__adversarial-response');

    runBody('sdd-reviewer', 'msg');
    const reviewer = childArgs();
    expect(reviewer).not.toContain('--mcp-config');
    expect(reviewer).not.toContain('--allowedTools');
  });

  it('passes --add-dir when the spec store repo is outside the code root, not when equal (Req 2.7, D9)', () => {
    runBody('sdd-reviewer', 'msg', { storeRepo: store });
    const outside = childArgs();
    expect(outside).toContain('--add-dir');
    expect(argVal(outside, '--add-dir')).toBe(store);

    runBody('sdd-reviewer', 'msg', { storeRepo: checkout });
    expect(childArgs()).not.toContain('--add-dir');
  });

  // --- Both exit paths (Req 2.2, 2.8, 3.2). ---

  it('prints the stub report and exits 0 when the child succeeds', () => {
    const r = runBody('sdd-reviewer', 'msg');
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(REPORT);
  });

  it('exits 1 but still writes one spawn.end when the child exits non-zero', () => {
    const r = runBody('sdd-reviewer', 'msg', { stubExit: '1' });
    expect(r.status).toBe(1);
    const ends = eventLines().filter((e) => e.type === 'spawn.end');
    expect(ends).toHaveLength(1);
  });

  it('writes tokens=unknown with no model or usage keys when the transcript is missing (Req 3.2, 3.3)', () => {
    const r = runBody('sdd-reviewer', 'msg', { noTranscript: true });
    expect(r.status).toBe(0);
    const end = eventLines().find((e) => e.type === 'spawn.end')!;
    expect(end.tokens).toBe('unknown');
    expect(end.model).toBeUndefined();
    expect(end.input).toBeUndefined();
  });
});
