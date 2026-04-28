import { readFile, stat } from 'fs/promises';

export type HygieneSignal = {
  file: string;
  line: number;
  pattern: 'console' | 'todo' | 'fixme' | 'debugger';
  text: string;
};

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_TEXT_LENGTH = 120;

const PATTERNS: Array<{ pattern: HygieneSignal['pattern']; regex: RegExp }> = [
  { pattern: 'console', regex: /console\.(log|warn|error|debug|info|trace)\s*\(/ },
  { pattern: 'todo', regex: /\bTODO\b/ },
  { pattern: 'fixme', regex: /\bFIXME\b/ },
  { pattern: 'debugger', regex: /\bdebugger\b/ },
];

async function scanFile(file: string): Promise<HygieneSignal[]> {
  try {
    const stats = await stat(file);
    if (stats.size > MAX_FILE_SIZE) {
      return [];
    }
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    const signals: HygieneSignal[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, regex } of PATTERNS) {
        if (regex.test(line)) {
          const trimmed = line.trim();
          const text = trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;
          signals.push({ file, line: i + 1, pattern, text });
        }
      }
    }
    return signals;
  } catch {
    return [];
  }
}

export async function computeHygieneSignals(files: string[]): Promise<HygieneSignal[]> {
  const results = await Promise.all(files.map(scanFile));
  return results.flat();
}
