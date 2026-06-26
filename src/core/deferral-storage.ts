import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Deferral } from '../types.js';
import { PathUtils } from './path-utils.js';

/**
 * Storage for deferred decisions using markdown files with YAML frontmatter.
 * Each deferral is stored as a single file in .spec-workflow/deferrals/
 *
 * The on-disk .md files are the SOURCE OF TRUTH — there is no separate index.
 * Reads scan the directory directly and tolerate frontmatter quoting variation
 * (double-quoted, single-quoted, or unquoted scalars) so files written by older
 * versions or by hand are never silently dropped.
 */
export class DeferralStorage {
  private deferralsDir: string;

  /** Titles with similarity >= this (within the same originSpec) are flagged as likely duplicates. */
  static readonly DUPLICATE_THRESHOLD = 0.7;

  constructor(projectPath: string) {
    this.deferralsDir = join(PathUtils.getWorkflowRoot(projectPath), 'deferrals');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.deferralsDir, { recursive: true });
  }

  private generateId(): string {
    return 'd-' + randomUUID().replace(/-/g, '').slice(0, 8);
  }

  private filePath(id: string): string {
    return join(this.deferralsDir, `${id}.md`);
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  private serializeFrontmatter(deferral: Deferral): string {
    const str = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
    const opt = (v: string | null) => (v ? str(v) : 'null');
    return [
      '---',
      `id: ${str(deferral.id)}`,
      `status: ${str(deferral.status)}`,
      `title: ${str(deferral.title)}`,
      `createdAt: ${str(deferral.createdAt)}`,
      `updatedAt: ${str(deferral.updatedAt)}`,
      `resolvedAt: ${opt(deferral.resolvedAt)}`,
      `originSpec: ${opt(deferral.originSpec)}`,
      `originPhase: ${opt(deferral.originPhase)}`,
      `revisitTrigger: ${str(deferral.revisitTrigger)}`,
      `tags: [${deferral.tags.map(t => str(t)).join(', ')}]`,
      `resolution: ${opt(deferral.resolution)}`,
      `resolvedInSpec: ${opt(deferral.resolvedInSpec)}`,
      `supersededBy: ${opt(deferral.supersededBy)}`,
      `supersedes: ${opt(deferral.supersedes)}`,
      '---',
    ].join('\n');
  }

  private toMarkdown(deferral: Deferral): string {
    return `${this.serializeFrontmatter(deferral)}

## Context
${deferral.body.context}

## Decision Deferred
${deferral.body.decision}

## Revisit Criteria
${deferral.body.revisitCriteria}
`;
  }

  // ---------------------------------------------------------------------------
  // Parsing — resilient to quoting/format variation
  // ---------------------------------------------------------------------------

  /** Split a frontmatter block into a key -> raw-value map (top-level keys only). */
  private static parseFrontmatter(fm: string): Map<string, string> {
    const fields = new Map<string, string>();
    for (const rawLine of fm.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const match = line.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
      if (!match) continue;
      // First occurrence wins; ignore indented continuation lines.
      if (!fields.has(match[1])) fields.set(match[1], match[2]);
    }
    return fields;
  }

  /** Interpret a raw frontmatter value as a scalar, tolerating quoting variation. */
  private static scalar(raw: string | undefined): string | null {
    if (raw === undefined) return null;
    const v = raw.trim();
    if (v === '' || v === 'null' || v === '~') return null;
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
      return v.slice(1, -1).replace(/\\"/g, '"');
    }
    if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
      return v.slice(1, -1).replace(/''/g, "'");
    }
    return v;
  }

  /** Interpret a raw frontmatter value as an inline array, tolerating quoting variation. */
  private static arrayValue(raw: string | undefined): string[] {
    if (raw === undefined) return [];
    const v = raw.trim();
    const match = v.match(/^\[(.*)\]$/s);
    if (!match) return [];
    const inner = match[1].trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map(s => DeferralStorage.scalar(s))
      .filter((s): s is string => s !== null && s !== '');
  }

  private parseMarkdown(content: string): Deferral | null {
    const normalized = content.replace(/^\uFEFF/, '');
    const fmMatch = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!fmMatch) return null;

    const fields = DeferralStorage.parseFrontmatter(fmMatch[1]);
    const body = fmMatch[2].replace(/\r\n/g, '\n');

    const getSection = (heading: string): string => {
      const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
      const match = body.match(regex);
      return match ? match[1].trim() : '';
    };

    const id = DeferralStorage.scalar(fields.get('id'));
    const status = DeferralStorage.scalar(fields.get('status')) as Deferral['status'];
    const title = DeferralStorage.scalar(fields.get('title'));
    if (!id || !status || !title) return null;

    return {
      id,
      status,
      title,
      createdAt: DeferralStorage.scalar(fields.get('createdAt')) || '',
      updatedAt: DeferralStorage.scalar(fields.get('updatedAt')) || '',
      resolvedAt: DeferralStorage.scalar(fields.get('resolvedAt')),
      originSpec: DeferralStorage.scalar(fields.get('originSpec')),
      originPhase: DeferralStorage.scalar(fields.get('originPhase')) as Deferral['originPhase'],
      revisitTrigger: DeferralStorage.scalar(fields.get('revisitTrigger')) || '',
      tags: DeferralStorage.arrayValue(fields.get('tags')),
      resolution: DeferralStorage.scalar(fields.get('resolution')),
      resolvedInSpec: DeferralStorage.scalar(fields.get('resolvedInSpec')),
      supersededBy: DeferralStorage.scalar(fields.get('supersededBy')),
      supersedes: DeferralStorage.scalar(fields.get('supersedes')),
      body: {
        context: getSection('Context'),
        decision: getSection('Decision Deferred'),
        revisitCriteria: getSection('Revisit Criteria'),
      },
    };
  }

  /** Distinguish a missing file from one that exists but cannot be parsed. */
  private async read(id: string): Promise<{ status: 'ok' | 'missing' | 'corrupt'; deferral?: Deferral }> {
    let content: string;
    try {
      content = await fs.readFile(this.filePath(id), 'utf-8');
    } catch {
      return { status: 'missing' };
    }
    const deferral = this.parseMarkdown(content);
    if (!deferral) return { status: 'corrupt' };
    return { status: 'ok', deferral };
  }

  /** Load a deferral for a write operation, throwing actionable errors. */
  private async loadForWrite(id: string): Promise<Deferral> {
    const r = await this.read(id);
    if (r.status === 'missing') throw new Error(`Deferral ${id} not found`);
    if (r.status === 'corrupt') {
      throw new Error(
        `Deferral ${id} exists on disk but its frontmatter could not be parsed. ` +
        `Run the deferrals 'reindex' action to normalize the store, then retry.`
      );
    }
    return r.deferral!;
  }

  // ---------------------------------------------------------------------------
  // Title similarity (duplicate detection)
  // ---------------------------------------------------------------------------

  private static normalizeTitle(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  /** Token-set Dice coefficient on normalized titles (0..1). */
  static titleSimilarity(a: string, b: string): number {
    const na = DeferralStorage.normalizeTitle(a);
    const nb = DeferralStorage.normalizeTitle(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const ta = new Set(na.split(' '));
    const tb = new Set(nb.split(' '));
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return (2 * inter) / (ta.size + tb.size);
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(
    deferral: Omit<Deferral, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'resolvedAt' | 'resolution' | 'resolvedInSpec' | 'supersededBy'>,
    supersedes?: string
  ): Promise<string> {
    await this.ensureDir();

    // Generate unique ID with collision check
    let id: string;
    let attempts = 0;
    do {
      id = this.generateId();
      attempts++;
      if (attempts > 10) throw new Error('Failed to generate unique deferral ID after 10 attempts');
    } while (await this.fileExists(id));

    const now = new Date().toISOString();
    const newDeferral: Deferral = {
      ...deferral,
      id,
      status: 'deferred',
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolution: null,
      resolvedInSpec: null,
      supersededBy: null,
      supersedes: supersedes || null,
    };

    // If superseding, mark old deferral
    if (supersedes) {
      const old = await this.loadForWrite(supersedes);
      if (old.status !== 'deferred') throw new Error(`Cannot supersede: deferral ${supersedes} is already ${old.status}`);
      old.status = 'superseded';
      old.supersededBy = id;
      old.updatedAt = now;
      await fs.writeFile(this.filePath(supersedes), this.toMarkdown(old), 'utf-8');
    }

    await fs.writeFile(this.filePath(id), this.toMarkdown(newDeferral), 'utf-8');
    return id;
  }

  async get(id: string): Promise<Deferral | null> {
    const r = await this.read(id);
    return r.status === 'ok' ? r.deferral! : null;
  }

  async list(filters?: { status?: string; originSpec?: string; tag?: string }): Promise<Deferral[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.deferralsDir);
    } catch {
      return [];
    }

    const deferrals: Deferral[] = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      let content: string;
      try {
        content = await fs.readFile(join(this.deferralsDir, file), 'utf-8');
      } catch {
        continue;
      }
      const deferral = this.parseMarkdown(content);
      if (!deferral) continue;

      if (filters?.status && deferral.status !== filters.status) continue;
      if (filters?.originSpec && deferral.originSpec !== filters.originSpec) continue;
      if (filters?.tag && !deferral.tags.includes(filters.tag)) continue;

      deferrals.push(deferral);
    }

    return deferrals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async resolve(id: string, resolution: string, resolvedInSpec?: string): Promise<void> {
    const deferral = await this.loadForWrite(id);
    if (deferral.status !== 'deferred') throw new Error(`Cannot resolve: deferral ${id} is already ${deferral.status}`);

    const now = new Date().toISOString();
    deferral.status = 'resolved';
    deferral.resolution = resolution;
    deferral.resolvedAt = now;
    deferral.updatedAt = now;
    deferral.resolvedInSpec = resolvedInSpec || null;

    await fs.writeFile(this.filePath(id), this.toMarkdown(deferral), 'utf-8');
  }

  async update(id: string, updates: {
    title?: string;
    revisitTrigger?: string;
    tags?: string[];
    context?: string;
    decision?: string;
    revisitCriteria?: string;
  }): Promise<void> {
    const deferral = await this.loadForWrite(id);

    if (updates.title !== undefined) deferral.title = updates.title;
    if (updates.revisitTrigger !== undefined) deferral.revisitTrigger = updates.revisitTrigger;
    if (updates.tags !== undefined) deferral.tags = updates.tags;
    if (updates.context !== undefined) deferral.body.context = updates.context;
    if (updates.decision !== undefined) deferral.body.decision = updates.decision;
    if (updates.revisitCriteria !== undefined) deferral.body.revisitCriteria = updates.revisitCriteria;
    deferral.updatedAt = new Date().toISOString();

    await fs.writeFile(this.filePath(id), this.toMarkdown(deferral), 'utf-8');
  }

  async delete(id: string): Promise<void> {
    await this.loadForWrite(id);

    // Check if any other deferral references this one
    const all = await this.list();
    for (const d of all) {
      if (d.id === id) continue;
      if (d.supersededBy === id || d.supersedes === id) {
        throw new Error(`Cannot delete: deferral ${d.id} references ${id}`);
      }
    }

    await fs.unlink(this.filePath(id));
  }

  /**
   * Fold a duplicate deferral (`fromId`) into a canonical one (`intoId`):
   * the duplicate is marked superseded by the canonical record, and the
   * canonical record absorbs the duplicate's tags. No data is deleted — the
   * superseded file is preserved with its full context.
   */
  async merge(fromId: string, intoId: string): Promise<void> {
    if (fromId === intoId) throw new Error('Cannot merge a deferral into itself');

    const from = await this.loadForWrite(fromId);
    const into = await this.loadForWrite(intoId);
    if (from.status !== 'deferred') throw new Error(`Cannot merge: deferral ${fromId} is ${from.status}`);
    if (into.status !== 'deferred') throw new Error(`Cannot merge: target deferral ${intoId} is ${into.status}`);

    const now = new Date().toISOString();

    into.tags = Array.from(new Set([...into.tags, ...from.tags]));
    into.supersedes = fromId;
    into.updatedAt = now;

    from.status = 'superseded';
    from.supersededBy = intoId;
    from.updatedAt = now;

    await fs.writeFile(this.filePath(intoId), this.toMarkdown(into), 'utf-8');
    await fs.writeFile(this.filePath(fromId), this.toMarkdown(from), 'utf-8');
  }

  /**
   * Find existing deferred deferrals with the same originSpec and a title
   * similar to the given one. Used to warn about likely duplicates on add.
   */
  async findDuplicates(title: string, originSpec: string | null, excludeId?: string): Promise<Array<{ id: string; title: string; similarity: number }>> {
    const candidates = await this.list({ status: 'deferred' });
    const matches: Array<{ id: string; title: string; similarity: number }> = [];
    for (const d of candidates) {
      if (excludeId && d.id === excludeId) continue;
      if ((d.originSpec || null) !== (originSpec || null)) continue;
      const similarity = DeferralStorage.titleSimilarity(title, d.title);
      if (similarity >= DeferralStorage.DUPLICATE_THRESHOLD) {
        matches.push({ id: d.id, title: d.title, similarity: Math.round(similarity * 100) / 100 });
      }
    }
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Cluster currently-deferred records into groups of likely duplicates
   * (same originSpec + high title similarity). Used by the dashboard.
   */
  async findDuplicateGroups(): Promise<Array<{ originSpec: string | null; members: Array<{ id: string; title: string }> }>> {
    const all = await this.list({ status: 'deferred' });
    const used = new Set<string>();
    const groups: Array<{ originSpec: string | null; members: Array<{ id: string; title: string }> }> = [];

    for (let i = 0; i < all.length; i++) {
      if (used.has(all[i].id)) continue;
      const cluster = [all[i]];
      for (let j = i + 1; j < all.length; j++) {
        if (used.has(all[j].id)) continue;
        if ((all[i].originSpec || null) !== (all[j].originSpec || null)) continue;
        if (DeferralStorage.titleSimilarity(all[i].title, all[j].title) >= DeferralStorage.DUPLICATE_THRESHOLD) {
          cluster.push(all[j]);
          used.add(all[j].id);
        }
      }
      if (cluster.length > 1) {
        used.add(all[i].id);
        groups.push({
          originSpec: all[i].originSpec,
          members: cluster.map(c => ({ id: c.id, title: c.title })),
        });
      }
    }
    return groups;
  }

  /**
   * Rebuild the store from the on-disk files: re-serialize every parseable
   * deferral with canonical frontmatter (uniform quoting) while preserving the
   * body verbatim. Idempotent; safe to run on legacy stores after an upgrade.
   */
  async reindex(): Promise<{ total: number; rewritten: number; unparseable: string[] }> {
    await this.ensureDir();
    let files: string[];
    try {
      files = await fs.readdir(this.deferralsDir);
    } catch {
      return { total: 0, rewritten: 0, unparseable: [] };
    }

    let total = 0;
    let rewritten = 0;
    const unparseable: string[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      total++;
      const path = join(this.deferralsDir, file);
      let content: string;
      try {
        content = await fs.readFile(path, 'utf-8');
      } catch {
        unparseable.push(file);
        continue;
      }
      const deferral = this.parseMarkdown(content);
      if (!deferral) {
        unparseable.push(file);
        continue;
      }

      // Preserve the body verbatim; only normalize the frontmatter block.
      const bodyMatch = content.replace(/^\uFEFF/, '').match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
      const body = (bodyMatch ? bodyMatch[1] : '').replace(/\r\n/g, '\n').replace(/^\n+/, '').trimEnd();
      const canonical = `${this.serializeFrontmatter(deferral)}\n\n${body}\n`;

      if (canonical !== content) {
        await fs.writeFile(path, canonical, 'utf-8');
        rewritten++;
      }
    }

    return { total, rewritten, unparseable };
  }

  async fileExists(id: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(id));
      return true;
    } catch {
      return false;
    }
  }
}
