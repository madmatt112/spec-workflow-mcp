/**
 * Per-source W breakdown of one subagent transcript (design Component 2).
 *
 * A pure function spec 9 can call without the tool: no file or environment reads and no
 * tokenizer (Requirement 1 criterion 10, design D7). It groups a transcript's assistant
 * lines into calls by `message.id`, labels each context block by its source, splits each
 * call's input W over `base` and those sources by size, and charges output W to
 * `own-output`. Source totals equal `w` by construction.
 *
 * The call/usage rules mirror `readUsage` (harness/hooks/sdd-activity.sh:68-98): one usage
 * per `message.id`, the last line's winning, a line with no id its own call.
 */

export interface SourceRow {
  source: string;
  w: number;
  share: number;
}

export interface TranscriptBreakdown {
  calls: number;
  peak: number;
  base: number;
  w: number;
  rows: SourceRow[];
}

interface Block {
  src: string;
  chars: number;
}

interface Call {
  usage: Record<string, unknown> | null;
  context: Block[];
}

function num(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function strLen(x: unknown): number {
  return typeof x === 'string' ? x.length : 0;
}

function jsonLen(v: unknown): number {
  try {
    return JSON.stringify(v ?? {}).length;
  } catch {
    return 0;
  }
}

/** Characters of a tool result: a string's length, the sum of an array's text parts (JSON
 * length for a non-text part), else the JSON length of the whole. */
function resultLen(c: unknown): number {
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c)) {
    return c.reduce(
      (a, b) => a + (b && typeof (b as { text?: unknown }).text === 'string' ? (b as { text: string }).text.length : jsonLen(b)),
      0,
    );
  }
  return JSON.stringify(c ?? '').length;
}

/** The source label of a `tool_use` block, per the design C2 table. */
function labelTool(tu: { name?: unknown; input?: unknown }): string {
  const n = typeof tu.name === 'string' ? tu.name : '';
  const i = (tu.input && typeof tu.input === 'object' ? tu.input : {}) as Record<string, unknown>;
  if (n === 'Agent' || n === 'Task') return 'worker-report';
  if (n === 'Read') {
    const f = typeof i.file_path === 'string' ? i.file_path : '';
    if (f.includes('/skills/')) return 'skill';
    if (f.includes('.spec-workflow/')) return 'read:spec-store';
    return 'read:other';
  }
  if (n === 'Bash') return 'bash';
  if (n.startsWith('mcp__')) {
    const parts = n.split('__');
    const tool = parts[parts.length - 1];
    return 'mcp:' + tool + (i.action != null ? '.' + String(i.action) : '');
  }
  if (n === 'Skill') return 'skill';
  return 'tool:' + n;
}

/** The source label of a user text block: worker-report for a task notification, skill for
 * meta text, else prompt. */
function labelUserText(text: unknown, isMeta: unknown): string {
  if (typeof text === 'string' && /task-notification/.test(text)) return 'worker-report';
  if (isMeta === true) return 'skill';
  return 'prompt';
}

/**
 * Break one subagent transcript into per-source W. Returns null when no assistant line
 * carries `message.usage`.
 */
export function breakdownTranscript(text: string): TranscriptBreakdown | null {
  const blocks: Block[] = [];
  const toolName = new Map<string, string>();
  const calls: Call[] = [];
  const callByKey = new Map<string, Call>();
  let autoId = 0;

  for (const raw of text.split('\n')) {
    let e: { type?: unknown; message?: Record<string, unknown>; isMeta?: unknown };
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!e || typeof e !== 'object') continue;

    if (e.type === 'assistant' && e.message && typeof e.message === 'object') {
      const msg = e.message as Record<string, unknown>;
      const id = msg.id;
      const key = typeof id === 'string' && id ? id : `__noid_${autoId++}`;
      let call = callByKey.get(key);
      if (!call) {
        call = { usage: null, context: blocks.slice() };
        callByKey.set(key, call);
        calls.push(call);
      }
      const u = msg.usage;
      if (u && typeof u === 'object') call.usage = u as Record<string, unknown>;
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (!b || typeof b !== 'object') continue;
          if (b.type === 'tool_use') {
            if (typeof b.id === 'string') toolName.set(b.id, labelTool(b));
            blocks.push({ src: 'own-output', chars: jsonLen(b.input) });
          } else if (b.type === 'text') {
            blocks.push({ src: 'own-output', chars: strLen(b.text) });
          } else if (b.type === 'thinking') {
            blocks.push({ src: 'own-output', chars: strLen(b.thinking) });
          }
        }
      }
    } else if (e.type === 'user' && e.message && typeof e.message === 'object') {
      const msg = e.message as Record<string, unknown>;
      const content = msg.content;
      if (typeof content === 'string') {
        blocks.push({ src: labelUserText(content, e.isMeta), chars: content.length });
      } else if (Array.isArray(content)) {
        for (const b of content) {
          if (!b || typeof b !== 'object') continue;
          if (b.type === 'tool_result') {
            const src = (typeof b.tool_use_id === 'string' && toolName.get(b.tool_use_id)) || 'tool:?';
            blocks.push({ src, chars: resultLen(b.content) });
          } else if (b.type === 'text') {
            blocks.push({ src: labelUserText(b.text, e.isMeta), chars: strLen(b.text) });
          }
        }
      }
    }
  }

  const active = calls.filter((c) => c.usage !== null);
  if (active.length === 0) return null;

  const ctxOf = (u: Record<string, unknown>): number =>
    num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens);
  const inWOf = (u: Record<string, unknown>): number => {
    const cc = (u.cache_creation && typeof u.cache_creation === 'object' ? u.cache_creation : {}) as Record<string, unknown>;
    return (
      num(u.input_tokens) +
      1.25 * num(cc.ephemeral_5m_input_tokens) +
      2 * num(cc.ephemeral_1h_input_tokens) +
      0.1 * num(u.cache_read_input_tokens)
    );
  };
  const charsOf = (ctx: Block[]): number => ctx.reduce((a, b) => a + b.chars, 0);

  const first = active[0].usage as Record<string, unknown>;
  const baseSizing = Math.max(0, ctxOf(first) - charsOf(active[0].context) / 3.5);

  const totals = new Map<string, number>();
  const add = (src: string, v: number): void => {
    if (v !== 0) totals.set(src, (totals.get(src) ?? 0) + v);
  };

  let w = 0;
  let peak = 0;

  for (const call of active) {
    const u = call.usage as Record<string, unknown>;
    const ctx = ctxOf(u);
    const inW = inWOf(u);
    const outW = 5 * num(u.output_tokens);
    if (ctx > peak) peak = ctx;
    w += inW + outW;

    const C = charsOf(call.context);
    if (C === 0 || ctx === 0) {
      add('base', inW);
    } else {
      const b = Math.min(baseSizing, ctx);
      add('base', (inW * b) / ctx);
      const remainder = (inW * (ctx - b)) / ctx;
      for (const blk of call.context) {
        add(blk.src, remainder * (blk.chars / C));
      }
    }
    add('own-output', outW);
  }

  const base = totals.get('base') ?? 0;
  const rows: SourceRow[] = [...totals.entries()]
    .filter(([, v]) => v > 0)
    .map(([source, value]) => ({ source, w: value, share: w === 0 ? 0 : value / w }))
    .sort((a, b) => b.w - a.w);

  return { calls: active.length, peak, base, w, rows };
}
