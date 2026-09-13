import { promises as fs, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import chokidar from 'chokidar';
import { ActivityEvent, LedgerEvent, buildModel, parseHandoffActiveSpec, parseJsonl } from './ledger.js';
import { render } from './render.js';

export interface WatchOptions {
  /** The directory that contains `specs/`, `HANDOFF.md`, ... (ends in `.spec-workflow`). */
  workflowRoot: string;
  specName?: string;
  /** Render once to stdout and return (for scripts and tests). */
  once?: boolean;
  color?: boolean;
  now?: () => Date;
  out?: NodeJS.WriteStream;
  /** The key source (default `process.stdin`); injectable for tests. */
  input?: NodeJS.ReadStream;
}

const ESC = String.fromCharCode(27) + '[';
const CLEAR = `${ESC}H${ESC}2J`;
const ALT_SCREEN_ON = `${ESC}?1049h${ESC}?25l`;
const ALT_SCREEN_OFF = `${ESC}?25h${ESC}?1049l`;
const CTRL_C = String.fromCharCode(3);

function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return undefined;
  }
}

/** HANDOFF lives inside the workflow root when it exists there, else beside it. */
export function handoffPath(workflowRoot: string): string {
  const inside = join(workflowRoot, 'HANDOFF.md');
  if (existsSync(inside)) return inside;
  return join(workflowRoot, '..', 'HANDOFF.md');
}

/** `--spec`, else the HANDOFF routing header, else the spec with the newest ledger. */
export function resolveSpec(workflowRoot: string, specName?: string): string {
  if (specName) return specName;
  const fromHandoff = parseHandoffActiveSpec(readIfExists(handoffPath(workflowRoot)));
  if (fromHandoff) return fromHandoff;
  const specsDir = join(workflowRoot, 'specs');
  let best: { name: string; mtime: number } | undefined;
  const names = existsSync(specsDir)
    ? readdirSync(specsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    : [];
  for (const name of names) {
    const ledger = join(specsDir, name, 'harness-events.jsonl');
    if (!existsSync(ledger)) continue;
    const mtime = statSync(ledger).mtimeMs;
    if (!best || mtime > best.mtime) best = { name, mtime };
  }
  if (best) return best.name;
  throw new Error(`No active spec: pass --spec <name>. HANDOFF has no routing header and no spec under ${specsDir} has a harness-events.jsonl.`);
}

export function renderOnce(workflowRoot: string, spec: string, opts: { now: Date; width: number; color: boolean }): string {
  const specDir = join(workflowRoot, 'specs', spec);
  const model = buildModel({
    spec,
    ledger: parseJsonl<LedgerEvent>(readIfExists(join(specDir, 'harness-events.jsonl'))),
    activity: parseJsonl<ActivityEvent>(readIfExists(join(specDir, 'harness-activity.jsonl'))),
    tasksMd: readIfExists(join(specDir, 'tasks.md')),
    handoffMd: readIfExists(handoffPath(workflowRoot)),
  });
  return render(model, opts);
}

export async function runWatch(options: WatchOptions): Promise<void> {
  const out = options.out ?? process.stdout;
  const now = options.now ?? (() => new Date());
  const color = options.color ?? Boolean(out.isTTY && !process.env.NO_COLOR);
  const spec = resolveSpec(options.workflowRoot, options.specName);
  const specDir = join(options.workflowRoot, 'specs', spec);
  try {
    await fs.access(specDir);
  } catch {
    throw new Error(`Spec directory not found: ${specDir}`);
  }

  const width = () => Math.max(60, Math.min(160, out.columns ?? 100));
  if (options.once) {
    out.write(renderOnce(options.workflowRoot, spec, { now: now(), width: width(), color }) + '\n');
    return;
  }

  const stdin = options.input ?? process.stdin;
  const interactive = Boolean(stdin.isTTY && out.isTTY);
  const draw = () => {
    const frame = renderOnce(options.workflowRoot, spec, { now: now(), width: width(), color });
    out.write(`${CLEAR}${frame}\n`);
  };

  if (interactive) out.write(ALT_SCREEN_ON);
  draw();

  const watcher = chokidar.watch(
    [join(specDir, 'harness-events.jsonl'), join(specDir, 'harness-activity.jsonl'), join(specDir, 'tasks.md'), handoffPath(options.workflowRoot)],
    { ignoreInitial: true, persistent: true, ignorePermissionErrors: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } },
  );
  let pending: NodeJS.Timeout | undefined;
  const schedule = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(draw, 120);
  };
  watcher.on('add', schedule).on('change', schedule).on('unlink', schedule);
  const tick = setInterval(draw, 1000);

  await new Promise<void>((resolve) => {
    const onKey = (key: string) => {
      if (key === 'q' || key === CTRL_C) stop();
    };
    const stop = () => {
      clearInterval(tick);
      if (pending) clearTimeout(pending);
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      if (interactive) {
        // A resumed raw-mode stdin with a listener keeps the event loop alive after the
        // view is gone; release it so the process exits as soon as the watcher closes.
        stdin.removeListener('data', onKey);
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.unref?.();
        out.write(ALT_SCREEN_OFF);
      }
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    if (interactive) {
      stdin.setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.on('data', onKey);
    }
  });
  await watcher.close();
}
