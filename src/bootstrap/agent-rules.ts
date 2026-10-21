// src/bootstrap/agent-rules.ts
//
// The shipped agent-rules template and the three repository facts that fill it
// (design C5; Req 4 AC 1, 3-5, 7, 9). `detectFacts` reads lockfiles and the
// top-level package.json; `renderAgentRules` drops a null fact's line and fills
// the rest; `templatePath` resolves the shipped template, the same resolution as
// `src/core/workspace-initializer.ts:69`.
//
// The facts are kebab-case placeholders (`{{worktree-setup}}`) so a test
// command's single-brace `{files}` token is left alone (D6). An unreadable
// manifest means no runner, not an error.
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { InitArgs } from './init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AgentRuleFacts {
  worktreeSetup: string | null;
  testCommand: string | null;
  mergeMethod: 'merge' | 'squash';
}

/** The overriding options for fact detection, the relevant subset of `InitArgs` (design C3). */
type DetectArgs = Pick<InitArgs, 'testCommand' | 'worktreeSetup' | 'mergeMethod'>;

/** Placeholder key in the template -> field in `AgentRuleFacts`. */
const PLACEHOLDER_TO_FACT: Record<string, keyof AgentRuleFacts> = {
  'worktree-setup': 'worktreeSetup',
  'tdd-test-command': 'testCommand',
  'merge-method': 'mergeMethod',
};

/** The shipped template path, the resolution of `workspace-initializer.ts:69`. */
export function templatePath(): string {
  return join(__dirname, '..', 'markdown', 'templates', 'agent-rules-template.md');
}

/** The worktree-setup command: an override, else a lockfile, else null (Req 4 AC 3). */
function detectWorktreeSetup(top: string, override: string | undefined): string | null {
  if (override !== undefined) return override;
  if (existsSync(join(top, 'package-lock.json'))) return 'npm ci';
  if (existsSync(join(top, 'pnpm-lock.yaml'))) return 'pnpm install';
  if (existsSync(join(top, 'yarn.lock'))) return 'yarn install';
  return null;
}

/**
 * The test command: an override, else vitest, else jest from the top-level
 * package.json's dependencies/devDependencies, else null. An unreadable or
 * unparseable manifest means no runner, not an error (Req 4 AC 4).
 */
function detectTestCommand(top: string, override: string | undefined): string | null {
  if (override !== undefined) return override;
  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(join(top, 'package.json'), 'utf-8'));
  } catch {
    return null;
  }
  const manifest = (pkg ?? {}) as { dependencies?: unknown; devDependencies?: unknown };
  const deps = { ...(manifest.dependencies as object ?? {}), ...(manifest.devDependencies as object ?? {}) };
  if ('vitest' in deps) return 'npx vitest run {files}';
  if ('jest' in deps) return 'npx jest {files}';
  return null;
}

/** The three repository facts for the template (design C5, Req 4 AC 3-5). */
export function detectFacts(top: string, args: DetectArgs): AgentRuleFacts {
  return {
    worktreeSetup: detectWorktreeSetup(top, args.worktreeSetup),
    testCommand: detectTestCommand(top, args.testCommand),
    mergeMethod: args.mergeMethod ?? 'merge',
  };
}

/**
 * Fill the template: drop each line whose placeholder has a null fact, and
 * substitute the rest. The output carries no `{{key}}` placeholder (Req 4 AC 9);
 * a single-brace `{files}` token in a filled value is not template syntax.
 */
export function renderAgentRules(template: string, facts: AgentRuleFacts): string {
  const out: string[] = [];
  for (const line of template.split('\n')) {
    const match = line.match(/\{\{([a-z-]+)\}\}/);
    if (!match) {
      out.push(line);
      continue;
    }
    const factKey = PLACEHOLDER_TO_FACT[match[1]];
    const value = factKey ? facts[factKey] : undefined;
    if (value === null || value === undefined) continue;
    out.push(line.replace(match[0], value));
  }
  return out.join('\n');
}
