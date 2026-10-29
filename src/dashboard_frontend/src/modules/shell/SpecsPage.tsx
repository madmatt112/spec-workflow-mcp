import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjects } from '../projects/ProjectProvider';
import { storeGroups, storeOf } from '../projects/stores';
import { useShell } from './ShellProvider';
import { PageLayout, ScrollBox } from './PageLayout';
import { Group, Chips, SearchBox, Pager, Row, ROWS_PER_PAGE, type Chip } from './primitives';
import { formatDate } from '../../lib/dateUtils';
import type { SpecListRow, SpecDetail } from './types';
import { Button, Pill, ui, type Tone } from '../ui/ui';

const STATE_LABELS: Record<string, string> = {
  live: 'Live', 'in-progress': 'In progress', closed: 'Closed',
  deferred: 'Deferred', 'not-started': 'Not started',
};

/**
 * The read-only Specs page (design C10 Specs, D9; Requirement 5). Every spec of
 * every enabled project grouped by project, with the shell list primitives: five
 * state chips, a search box over the spec name and a pager. Selecting a row
 * fetches the C8 spec detail route and shows the decomposition order and depends
 * paragraph, one row per run, the phase table, the deferral records and each
 * top-level file; a file row's Copy path writes the absolute `path` with
 * `navigator.clipboard.writeText`, and when the clipboard is missing or rejects
 * it shows the path in a selected read-only field (D9). The page renders no
 * document content and offers no editor-open link (Requirement 5 AC 5, 6). A
 * `shell-specs` push replaces the rows through ShellProvider, so the list and the
 * open panel refresh with no reload (Requirement 5 AC 7).
 */

const STATES = ['live', 'in-progress', 'closed', 'deferred', 'not-started'] as const;

const STATE_TONE: Record<string, Tone> = {
  live: 'accent',
  'in-progress': 'accent',
  closed: 'success',
  deferred: 'neutral',
  'not-started': 'neutral',
};

function StateBadge({ state }: { state: SpecListRow['state'] }) {
  return (
    <Pill tone={STATE_TONE[state] ?? STATE_TONE['not-started']} className="shrink-0">
      {STATE_LABELS[state] ?? state}
    </Pill>
  );
}

/** Document versions as `R4 D3 T2`, dropping each part that is missing (D18). */
function formatVersions(v: SpecListRow['versions']): string {
  const parts: string[] = [];
  if (v.requirements) parts.push(`R${v.requirements.replace(/^v/, '')}`);
  if (v.design) parts.push(`D${v.design.replace(/^v/, '')}`);
  if (v.tasks) parts.push(`T${v.tasks.replace(/^v/, '')}`);
  return parts.join(' ');
}

function fmtBytes(size: number): string {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function key(store: string, spec: string): string {
  return `${store}::${spec}`;
}

interface Item {
  store: string;
  row: SpecListRow;
}

export function SpecsPage() {
  const { projects, enabled } = useProjects();
  const { specRows } = useShell();

  const [active, setActive] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groups = useMemo(() => storeGroups(projects, enabled), [projects, enabled]);
  const enabledGroups = useMemo(() => groups.filter((g) => g.enabled), [groups]);
  const enabledKey = enabledGroups.map((g) => g.store).join(',');

  // State counts across every enabled store's rows (not the search / chip).
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {
      live: 0, 'in-progress': 0, closed: 0, deferred: 0, 'not-started': 0,
    };
    const enabledStores = new Set(enabledGroups.map((g) => g.store));
    for (const r of specRows) {
      if (enabledStores.has(storeOf(projects, r.projectId)) && counts[r.state] !== undefined) {
        counts[r.state] += 1;
      }
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, specRows]);

  // Flatten the filtered rows of every enabled store, in group order.
  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Item[] = [];
    for (const g of enabledGroups) {
      for (const r of specRows) {
        if (storeOf(projects, r.projectId) !== g.store) continue;
        if (active.length && !active.includes(r.state)) continue;
        if (q && !r.spec.toLowerCase().includes(q)) continue;
        out.push({ store: g.store, row: r });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, specRows, active, query]);

  // Reset to the first page whenever the filter set changes.
  useEffect(() => { setPage(0); }, [active, query, enabledKey]);

  const totalByStore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.store] = (m[it.store] ?? 0) + 1;
    return m;
  }, [items]);

  const pageItems = items.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const groupsWithRows = enabledGroups
    .map((g) => ({ g, rows: pageItems.filter((it) => it.store === g.store) }))
    .filter((x) => x.rows.length > 0);

  // Resolve the selected row from current data so a push refreshes the panel.
  const selected = useMemo<Item | null>(() => {
    if (!selectedKey) return null;
    for (const g of enabledGroups) {
      for (const r of specRows) {
        if (storeOf(projects, r.projectId) === g.store && key(g.store, r.spec) === selectedKey) {
          return { store: g.store, row: r };
        }
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, enabledKey, specRows]);

  const chips: Chip[] = STATES.map((s) => ({
    value: s,
    label: STATE_LABELS[s] ?? s,
    count: stateCounts[s],
  }));

  const toggle = (value: string) =>
    setActive((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const list = (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        <SearchBox onChange={setQuery} placeholder={'Search specs'} />
        <Chips chips={chips} active={active} onToggle={toggle} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-secondary)]">
          {'No specs.'}
        </div>
      ) : (
        <>
          {groupsWithRows.map(({ g, rows }) => (
            <Group key={g.store} name={g.store} title={g.representative.projectName} count={totalByStore[g.store]}>
              {rows.map(({ row: r }) => {
                const versions = formatVersions(r.versions);
                const prs = r.prs.map((n) => `#${n}`).join(' ');
                return (
                  <Row
                    key={r.spec}
                    testId={`spec-row-${r.projectId}-${r.spec}`}
                    selected={selectedKey === key(g.store, r.spec)}
                    onClick={() => setSelectedKey(key(g.store, r.spec))}
                  >
                    <StateBadge state={r.state} />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{r.spec}</span>
                    {r.phase && <span className="hidden shrink-0 text-xs text-[var(--text-secondary)] sm:inline">{r.phase}</span>}
                    {versions && <span className="hidden shrink-0 font-mono text-xs text-[var(--text-muted)] md:inline">{versions}</span>}
                    <span className="hidden shrink-0 text-xs tabular-nums text-[var(--text-muted)] md:inline">{r.tasks.done}/{r.tasks.total}</span>
                    {prs && <span className="hidden shrink-0 text-xs text-[var(--text-muted)] lg:inline">{prs}</span>}
                    {r.deferrals > 0 && (
                      <span className="hidden shrink-0 text-xs text-[var(--text-muted)] lg:inline">
                        {r.deferrals} {'deferred'}
                      </span>
                    )}
                    {r.retro && <span className="hidden shrink-0 text-xs text-[var(--text-secondary)] lg:inline">{r.retro}</span>}
                    {r.updated && <span className="hidden shrink-0 text-xs text-[var(--text-muted)] xl:inline">{formatDate(r.updated)}</span>}
                  </Row>
                );
              })}
            </Group>
          ))}
          <Pager total={items.length} page={page} onPage={setPage} />
        </>
      )}
    </div>
  );

  return (
    <PageLayout
      list={list}
      panel={selected ? <SpecPanel key={selectedKey ?? undefined} item={selected} /> : undefined}
    />
  );
}

// --- Panel -----------------------------------------------------------------

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
      {children}
    </div>
  );
}

const DEFERRAL_STATUS_TONE: Record<string, Tone> = {
  deferred: 'accent',
  resolved: 'success',
  superseded: 'neutral',
};

function SpecPanel({ item }: { item: Item }) {
  const { row } = item;
  const { projectId, projectName } = row;
  const spec = row.spec;
  const updated = row.updated;

  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch the C8 detail route; re-fetch when the row's `updated` moves so an open
  // panel refreshes within 5 s of a ledger or HANDOFF change (Requirement 5 AC 7).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/shell/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(spec)}`)
      .then((res) => {
        if (res.status === 404) {
          if (alive) { setNotFound(true); setDetail(null); }
          return null;
        }
        if (alive) setNotFound(false);
        return res.ok ? res.json() : null;
      })
      .then((data) => { if (alive && data) setDetail(data as SpecDetail); })
      .catch(() => { /* a transient fetch error keeps the previous detail */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId, spec, updated]);

  const dash = '—';

  return (
    <div className={`${ui.panel} p-4`} data-testid="spec-panel">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-base font-semibold text-[var(--text-primary)]">{spec}</h2>
        <StateBadge state={row.state} />
      </div>

      {notFound ? (
        <p className="text-sm text-[var(--text-secondary)]" data-testid="spec-not-found">
          {'spec not found'}
        </p>
      ) : !detail ? (
        <p className="text-sm text-[var(--text-muted)]">
          {loading ? 'Loading…' : dash}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Field label={'Project'} value={projectName} />
            <Field label={'Order'} value={detail.order ?? undefined} />
            <Field label={'Depends on'} value={detail.dependsOn || undefined} />
          </div>

          <Section title={'Runs'}>
            {detail.runs.length === 0 ? (
              <p className="px-1 text-sm text-[var(--text-muted)]">{'No runs.'}</p>
            ) : (
              <ScrollBox>
                <table className={`${ui.table} border-collapse`} data-testid="spec-runs-table">
                  <thead>
                    <tr>
                      <th className={ui.th}>{'Run'}</th>
                      <th className={ui.th}>{'Start'}</th>
                      <th className={ui.th}>{'End'}</th>
                      <th className={ui.th}>{'Status'}</th>
                      <th className={ui.th}>{'Tokens'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.runs.map((r) => (
                      <tr key={r.runId} className="border-t border-[var(--border-default)]">
                        <td className={`${ui.td} font-mono text-xs`}>{r.runId}</td>
                        <td className={ui.td}>{formatDate(r.start)}</td>
                        <td className={ui.td}>{r.end ? formatDate(r.end) : dash}</td>
                        <td className={ui.td}>{r.status ?? dash}</td>
                        <td className={`${ui.td} tabular-nums`}>{r.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollBox>
            )}
          </Section>

          <Section title={'Phases'}>
            {detail.phases.length === 0 ? (
              <p className="px-1 text-sm text-[var(--text-muted)]">{'No phases.'}</p>
            ) : (
              <ScrollBox>
                <table className={`${ui.table} border-collapse`} data-testid="spec-phases-table">
                  <thead>
                    <tr>
                      <th className={ui.th}>{'Phase'}</th>
                      <th className={ui.th}>{'State'}</th>
                      <th className={ui.th}>{'Result'}</th>
                      <th className={ui.th}>{'Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.phases.map((p, i) => (
                      <tr key={`${p.phase}-${i}`} className="border-t border-[var(--border-default)]">
                        <td className={ui.td}>{p.phase}</td>
                        <td className={ui.td}>{p.state || dash}</td>
                        <td className={ui.td}>{p.result || dash}</td>
                        <td className={ui.td}>{p.date ? formatDate(p.date) : dash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollBox>
            )}
          </Section>

          <Section title={'Deferrals'}>
            {detail.deferrals.length === 0 ? (
              <p className="px-1 text-sm text-[var(--text-muted)]">{'No deferrals.'}</p>
            ) : (
              <div className="space-y-1">
                {detail.deferrals.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm" data-testid={`spec-deferral-${d.id}`}>
                    <Pill tone={DEFERRAL_STATUS_TONE[d.status] ?? DEFERRAL_STATUS_TONE.superseded} className="shrink-0">
                      {d.status}
                    </Pill>
                    <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">{d.id}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{d.title}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={'Files'}>
            {detail.files.length === 0 ? (
              <p className="px-1 text-sm text-[var(--text-muted)]">{'No files.'}</p>
            ) : (
              <div className="space-y-1">
                {detail.files.map((f) => <FileRow key={f.path} file={f} />)}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function FileRow({ file }: { file: SpecDetail['files'][number] }) {
  const [fallback, setFallback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copy = useCallback(async () => {
    // Write the original absolute path; fall back to a selected field when the
    // clipboard API is missing or rejects (D9, Requirement 5 AC 5).
    try {
      const clip = navigator.clipboard;
      if (clip && typeof clip.writeText === 'function') {
        await clip.writeText(file.path);
        setFallback(false);
        return;
      }
    } catch {
      /* fall through to the text field */
    }
    setFallback(true);
  }, [file.path]);

  useEffect(() => {
    if (fallback && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [fallback]);

  return (
    <div className="py-1" data-testid={`spec-file-${file.name}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{file.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{fmtBytes(file.size)}</span>
        <Button variant="secondary" size="sm" onClick={copy} data-testid={`copy-path-${file.name}`} className="shrink-0">
          {'Copy path'}
        </Button>
      </div>
      {fallback && (
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={file.path}
          data-testid={`copy-path-field-${file.name}`}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded-md border border-(--border-default) bg-(--surface-inset) px-3 py-1.5 font-mono text-xs text-(--text-primary)"
        />
      )}
    </div>
  );
}
