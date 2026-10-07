// src/dashboard/shell/file-cache.ts
//
// One never-throwing reader for every shell derivation (design.md C2). An entry
// is reused while the file's statSync mtimeMs and size are unchanged; a missing
// or unreadable path (including a directory) gives undefined, [] or null and
// never throws. `jsonl` uses parseJsonl, so a torn trailing line is skipped.
import { readFileSync, statSync } from 'fs';
import { parseJsonl } from '../../watch/ledger.js';

interface Entry {
  mtimeMs: number;
  size: number;
  text: string;
}

export class FileCache {
  private entries = new Map<string, Entry>();

  /** The file's UTF-8 text, or undefined when it is missing or unreadable. */
  text(path: string): string | undefined {
    let mtimeMs: number;
    let size: number;
    try {
      const s = statSync(path);
      mtimeMs = s.mtimeMs;
      size = s.size;
    } catch {
      return undefined;
    }
    const cached = this.entries.get(path);
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
      return cached.text;
    }
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      // A directory or an unreadable file: readFileSync throws.
      return undefined;
    }
    this.entries.set(path, { mtimeMs, size, text });
    return text;
  }

  /** The file parsed as JSON lines; a missing file or torn tail gives fewer or no rows. */
  jsonl<T>(path: string): T[] {
    return parseJsonl<T>(this.text(path));
  }

  /** The file's modified time in ms, or null when it is missing or unreadable. */
  mtimeMs(path: string): number | null {
    try {
      return statSync(path).mtimeMs;
    } catch {
      return null;
    }
  }
}
