import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImplementationLogManager } from '../implementation-log-manager.js';
import type { ImplementationLogEntry } from '../../types.js';

describe('ImplementationLogManager serialisation round-trip (retro P3)', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
  });

  async function newManager(): Promise<ImplementationLogManager> {
    const specDir = await fs.mkdtemp(join(tmpdir(), 'impl-log-mgr-'));
    dirs.push(specDir);
    return new ImplementationLogManager(specDir);
  }

  it('keeps a tag-like summary on one line and leaves the file and stat sections intact', async () => {
    const manager = await newManager();
    // The task-6 log: a mangled tool call dropped the file list into the summary
    // as literal tag text with embedded newlines. Serialised verbatim it leaked
    // those lines into the document body and the following sections mis-parsed.
    const summary =
      'Added render_verify(rep).</summary>\n' +
      '<filesModified">["jobscout/verify.py"]</filesModified>\n' +
      '<filesCreated">[]';
    const entry: Omit<ImplementationLogEntry, 'id'> = {
      taskId: '6',
      timestamp: '2026-10-02T20:32:37.735Z',
      summary,
      filesModified: ['jobscout/verify.py'],
      filesCreated: [],
      statistics: { linesAdded: 78, linesRemoved: 0, filesChanged: 1 },
      artifacts: { functions: [] },
    };

    await manager.addLogEntry(entry);
    const loaded = (await manager.loadLog()).entries;
    expect(loaded).toHaveLength(1);
    const back = loaded[0];

    // The summary survives as a single line: no embedded newline leaks into the body.
    expect(back.summary).not.toContain('\n');
    expect(back.summary).toContain('render_verify');
    // The tag-like text in the summary did not corrupt the file or stat sections.
    expect(back.filesModified).toEqual(['jobscout/verify.py']);
    expect(back.filesCreated).toEqual([]);
    expect(back.statistics.linesAdded).toBe(78);
    expect(back.statistics.filesChanged).toBe(1);
  });
});
