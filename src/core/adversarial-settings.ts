import * as nodeFs from 'node:fs';
import type { Stats } from 'node:fs';
import { PathUtils } from './path-utils.js';

export type RunnerKey = 'adversarial' | 'taskReview';

export type AdversarialSettings = {
  adversarial?: { model?: string; [k: string]: unknown };
  taskReview?: { model?: string; [k: string]: unknown };
  features?: { typecheck?: boolean; [k: string]: unknown };
  model?: string;
  cli?: string;
  cliArgs?: string[];
};

type CacheEntry = { mtimeMs: number; size: number; settings: AdversarialSettings };

const cache = new Map<string, CacheEntry>();
const warnedKeys = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

function clearLoadWarnings(absPath: string): void {
  const prefix = `load:${absPath}:`;
  for (const key of [...warnedKeys]) {
    if (key.startsWith(prefix)) warnedKeys.delete(key);
  }
}

function formatLoadWarning(absPath: string, reason: string, detail: string): string {
  return `[spec-workflow] adversarial-settings.json: ${reason} (path: ${absPath}); falling back to defaults. ${detail}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  for (const v of Object.values(value)) deepFreeze(v);
  return Object.freeze(value);
}

function describeValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function getSettingsPath(projectPath: string): string {
  return PathUtils.safeJoin(
    PathUtils.getWorkflowRoot(projectPath),
    'adversarial-settings.json',
  );
}

export function loadSettings(projectPath: string): AdversarialSettings {
  const absPath = getSettingsPath(projectPath);

  let stats: Stats;
  try {
    stats = nodeFs.statSync(absPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {};
    }
    warnOnce(
      `load:${absPath}:io-stat`,
      formatLoadWarning(
        absPath,
        `stat failed (${code ?? 'unknown'})`,
        (err as Error).message,
      ),
    );
    return {};
  }

  const cached = cache.get(absPath);
  if (cached) {
    if (cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      return cached.settings;
    }
    // (mtime, size) advanced — file was edited. Clear warn-once flags scoped to
    // this file so a recovered file can surface a different cause without dedup masking.
    clearLoadWarnings(absPath);
  }

  const cacheEmpty = (): AdversarialSettings => {
    const empty = deepFreeze({} as AdversarialSettings);
    cache.set(absPath, { mtimeMs: stats.mtimeMs, size: stats.size, settings: empty });
    return empty;
  };

  let raw: string;
  try {
    raw = nodeFs.readFileSync(absPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    warnOnce(
      `load:${absPath}:io-read`,
      formatLoadWarning(
        absPath,
        `read failed (${code ?? 'unknown'})`,
        (err as Error).message,
      ),
    );
    return cacheEmpty();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    warnOnce(
      `load:${absPath}:json-parse`,
      formatLoadWarning(absPath, 'JSON parse failed', (err as Error).message),
    );
    return cacheEmpty();
  }

  if (!isPlainObject(parsed)) {
    warnOnce(
      `load:${absPath}:top-shape`,
      formatLoadWarning(
        absPath,
        'top-level value is not an object',
        `received: ${describeValue(parsed)}`,
      ),
    );
    return cacheEmpty();
  }

  const settings = deepFreeze(parsed as AdversarialSettings);
  cache.set(absPath, { mtimeMs: stats.mtimeMs, size: stats.size, settings });
  return settings;
}

export function resolveRunnerModel(
  settings: AdversarialSettings,
  runner: RunnerKey,
): string | undefined {
  const block: unknown = settings[runner];

  if (block !== undefined && block !== null) {
    if (!isPlainObject(block)) {
      warnOnce(
        `runner-block-non-object:${runner}`,
        `[spec-workflow] adversarial-settings.json: '${runner}' is present but not an object (received: ${describeValue(block)}); falling back to defaults.`,
      );
    } else {
      const model = (block as Record<string, unknown>).model;
      if (model !== undefined) {
        if (typeof model === 'string') {
          if (model !== '') return model;
          // Empty string: explicitly cleared, fall through to legacy.
        } else {
          warnOnce(
            `runner-model-non-string:${runner}`,
            `[spec-workflow] adversarial-settings.json: '${runner}.model' is present but not a string (received: ${describeValue(model)}); falling back to defaults.`,
          );
        }
      }
    }
  }

  const legacy = settings.model;
  if (typeof legacy === 'string') {
    if (legacy !== '') return legacy;
  } else if (legacy !== undefined && legacy !== null) {
    warnOnce(
      'legacy-model-non-string',
      `[spec-workflow] adversarial-settings.json: legacy 'model' is present but not a string (received: ${describeValue(legacy)}); falling back to defaults.`,
    );
  }
  return undefined;
}

export function isTypecheckEnabled(settings: AdversarialSettings): boolean {
  const features = settings.features;
  if (features === undefined || features === null) return true;

  if (!isPlainObject(features)) {
    warnOnce(
      'features-non-object',
      `[spec-workflow] adversarial-settings.json: 'features' is present but not an object (received: ${describeValue(features)}); falling back to defaults.`,
    );
    return true;
  }

  const tc = (features as Record<string, unknown>).typecheck;
  if (tc === undefined) return true;
  if (typeof tc === 'boolean') return tc;
  if (tc === '') return true;

  const repr = describeValue(tc);
  warnOnce(
    `features-typecheck-non-boolean:${repr}`,
    `[spec-workflow] adversarial-settings.json: 'features.typecheck' is present but not a boolean (received: ${repr}); falling back to defaults.`,
  );
  return true;
}

// Test-only: reset module state between cases.
export function __resetForTests(): void {
  cache.clear();
  warnedKeys.clear();
}
