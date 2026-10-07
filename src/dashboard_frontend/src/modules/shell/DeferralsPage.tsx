import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../projects/ProjectProvider';
import { useShell, DeferralRecord } from './ShellProvider';
import { PageLayout } from './PageLayout';
import { Group, Chips, SearchBox, Pager, Row, ROWS_PER_PAGE, type Chip } from './primitives';
import { formatDate } from '../../lib/dateUtils';

/**
 * The read-only Deferrals page (design C10 Deferrals, D15; Requirement 7 AC 2).
 * Every enabled project's deferral records in one group per project, with the
 * shell list primitives: status chips, a search box over title/id/origin spec
 * and a pager. Selecting a row shows the whole record in the panel. A
 * `deferrals-update` push replaces a project's records through ShellProvider,
 * so the list and the open panel refresh with no reload.
 */

const STATUSES = ['deferred', 'resolved', 'superseded'] as const;

interface FullDeferral extends DeferralRecord {
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  originPhase?: string | null;
  revisitTrigger?: string;
  tags?: string[];
  resolution?: string | null;
  resolvedInSpec?: string | null;
  body?: { context?: string; decision?: string; revisitCriteria?: string };
}

interface Item {
  projectId: string;
  projectName: string;
  d: FullDeferral;
}

const STATUS_STYLES: Record<string, string> = {
  deferred: 'bg-[color-mix(in_srgb,var(--accent-primary,#2563eb)_15%,transparent)] text-[var(--accent-primary,#2563eb)]',
  resolved: 'bg-[color-mix(in_srgb,#22c55e_18%,transparent)] text-green-600 dark:text-green-400',
  superseded: 'bg-[var(--surface-inset)] text-[var(--text-muted)]',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.superseded}`}>
      {status}
    </span>
  );
}

function key(projectId: string, id: string): string {
  return `${projectId}::${id}`;
}

export function DeferralsPage() {
  const { t } = useTranslation();
  const { projects, enabled } = useProjects();
  const { deferralsByProject } = useShell();

  const [active, setActive] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const enabledProjects = useMemo(
    () => projects.filter((p) => enabled(p.projectId)),
    [projects, enabled]
  );
  const enabledKey = enabledProjects.map((p) => p.projectId).join(',');

  // Status counts across every enabled project's records (not the search / chip).
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { deferred: 0, resolved: 0, superseded: 0 };
    for (const p of enabledProjects) {
      for (const d of (deferralsByProject[p.projectId]?.deferrals ?? [])) {
        if (counts[d.status] !== undefined) counts[d.status] += 1;
      }
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, deferralsByProject]);

  // Flatten the filtered records of every enabled project, in project order.
  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Item[] = [];
    for (const p of enabledProjects) {
      const recs = (deferralsByProject[p.projectId]?.deferrals ?? []) as FullDeferral[];
      for (const d of recs) {
        if (active.length && !active.includes(d.status)) continue;
        if (q) {
          const hay = `${d.title ?? ''} ${d.id ?? ''} ${d.originSpec ?? ''}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        out.push({ projectId: p.projectId, projectName: p.projectName, d });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, deferralsByProject, active, query]);

  // Reset to the first page whenever the filter set changes.
  useEffect(() => { setPage(0); }, [active, query, enabledKey]);

  const totalByProject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.projectId] = (m[it.projectId] ?? 0) + 1;
    return m;
  }, [items]);

  const pageItems = items.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const groups = enabledProjects
    .map((p) => ({ p, rows: pageItems.filter((it) => it.projectId === p.projectId) }))
    .filter((g) => g.rows.length > 0);

  // Resolve the selected record from current data so a push refreshes the panel.
  const selected = useMemo<Item | null>(() => {
    if (!selectedKey) return null;
    for (const p of enabledProjects) {
      for (const d of (deferralsByProject[p.projectId]?.deferrals ?? []) as FullDeferral[]) {
        if (key(p.projectId, d.id) === selectedKey) {
          return { projectId: p.projectId, projectName: p.projectName, d };
        }
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, enabledKey, deferralsByProject]);

  const chips: Chip[] = STATUSES.map((s) => ({
    value: s,
    label: t(`shell.deferrals.status.${s}`, s),
    count: statusCounts[s],
  }));

  const toggle = (value: string) =>
    setActive((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const list = (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        <SearchBox onChange={setQuery} placeholder={t('shell.deferrals.search', 'Search title, id or origin spec')} />
        <Chips chips={chips} active={active} onToggle={toggle} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-secondary)]">
          {t('shell.deferrals.empty', 'No deferrals.')}
        </div>
      ) : (
        <>
          {groups.map(({ p, rows }) => (
            <Group key={p.projectId} name={p.projectId} title={p.projectName} count={totalByProject[p.projectId]}>
              {rows.map(({ d }) => (
                <Row
                  key={d.id}
                  testId={`deferral-row-${p.projectId}-${d.id}`}
                  selected={selectedKey === key(p.projectId, d.id)}
                  onClick={() => setSelectedKey(key(p.projectId, d.id))}
                >
                  <StatusBadge status={d.status} />
                  <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">{d.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{d.title}</span>
                  <span className="hidden shrink-0 text-xs text-[var(--text-secondary)] sm:inline">
                    {d.originSpec || t('shell.deferrals.projectScope', 'Project-level')}
                  </span>
                  <span className="hidden shrink-0 text-xs text-[var(--text-muted)] md:inline">
                    {formatDate(d.updatedAt)}
                  </span>
                </Row>
              ))}
            </Group>
          ))}
          <Pager total={items.length} page={page} onPage={setPage} />
        </>
      )}
    </div>
  );

  return <PageLayout list={list} panel={selected ? <DeferralPanel item={selected} /> : undefined} />;
}

function DetailText({ heading, body }: { heading: string; body?: string }) {
  if (!body || !body.trim()) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{heading}</h4>
      <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{body}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function DeferralPanel({ item }: { item: Item }) {
  const { t } = useTranslation();
  const { d, projectName } = item;
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="deferral-panel">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-base font-semibold text-[var(--text-primary)]">{d.title}</h2>
        <StatusBadge status={d.status} />
      </div>

      <div className="space-y-1.5">
        <Field label={t('shell.deferrals.id', 'ID')} value={<span className="font-mono text-xs">{d.id}</span>} />
        <Field label={t('shell.deferrals.project', 'Project')} value={projectName} />
        <Field label={t('shell.deferrals.originSpec', 'Origin spec')} value={d.originSpec || t('shell.deferrals.projectScope', 'Project-level')} />
        <Field label={t('shell.deferrals.phase', 'Phase')} value={d.originPhase || undefined} />
        <Field label={t('shell.deferrals.created', 'Created')} value={formatDate(d.createdAt)} />
        <Field label={t('shell.deferrals.updated', 'Updated')} value={formatDate(d.updatedAt)} />
        {d.status === 'resolved' && (
          <Field
            label={t('shell.deferrals.resolved', 'Resolved')}
            value={`${formatDate(d.resolvedAt || undefined)}${d.resolvedInSpec ? ` (${d.resolvedInSpec})` : ''}`}
          />
        )}
        {Array.isArray(d.tags) && d.tags.length > 0 && (
          <Field
            label={t('shell.deferrals.tags', 'Tags')}
            value={
              <span className="flex flex-wrap gap-1">
                {d.tags.map((tg) => (
                  <span key={tg} className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">#{tg}</span>
                ))}
              </span>
            }
          />
        )}
      </div>

      <div className="mt-3 space-y-3 border-t border-[var(--border-default)] pt-3">
        <DetailText heading={t('shell.deferrals.revisitTrigger', 'Revisit trigger')} body={d.revisitTrigger} />
        {d.status === 'resolved' && <DetailText heading={t('shell.deferrals.resolution', 'Resolution')} body={d.resolution || undefined} />}
        <DetailText heading={t('shell.deferrals.context', 'Context')} body={d.body?.context} />
        <DetailText heading={t('shell.deferrals.decision', 'Decision')} body={d.body?.decision} />
        <DetailText heading={t('shell.deferrals.revisitCriteria', 'Revisit criteria')} body={d.body?.revisitCriteria} />
      </div>
    </div>
  );
}
