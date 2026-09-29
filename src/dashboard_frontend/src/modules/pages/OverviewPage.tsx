import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWs } from '../ws/WebSocketProvider';
import type { OverviewRow, Todo } from '../harness/types';

// The Overview page is read only (Req 5.8): it subscribes to the global overview
// view and shows every project's harness work plus the operator to-do list. It
// offers no control that edits the HUD file, launches a run or stops a run, and
// it fetches no harness route.

/** True for a value worth rendering; absent fields are omitted. */
function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/** Human age of an ISO timestamp relative to `now`, ticking each second. */
function fmtAge(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  let total = Math.floor((now - then) / 1000);
  if (total < 0) total = 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 min-w-0">
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!present(value)) return null;
  return (
    <div className="min-w-0">
      <span className="text-xs text-[var(--text-muted)]">{label}: </span>
      <span className="text-sm text-[var(--text-primary)] break-words">{String(value)}</span>
    </div>
  );
}

export function OverviewPage() {
  const { t } = useTranslation();
  const { subscribe, unsubscribe, watchView } = useWs();

  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [now, setNow] = useState(Date.now());

  // Subscribe to the global overview view and its two message types (Req 5.10).
  useEffect(() => {
    const release = watchView({ kind: 'overview' });

    const onRows = (d: { rows: OverviewRow[] }) => setRows(d.rows || []);
    const onTodos = (d: { todos: Todo[] }) => setTodos(d.todos || []);

    subscribe('overview-rows', onRows);
    subscribe('overview-todos', onTodos);
    return () => {
      unsubscribe('overview-rows', onRows);
      unsubscribe('overview-todos', onTodos);
      release();
    };
  }, [watchView, subscribe, unsubscribe]);

  // Tick the newest-row ages every second (Req 5.1).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Open items first; a stable sort keeps the server's order within each group.
  const sortedTodos = useMemo(
    () => [...todos].sort((a, b) => Number(a.done) - Number(b.done)),
    [todos],
  );

  return (
    <div className="space-y-6 min-w-0">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('overview.title')}</h1>

      {/* One card per project row */}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t('overview.projects.heading')}</h2>
        {rows.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r) => (
              <Card key={r.projectId}>
                <div className="flex items-start justify-between gap-2 min-w-0 mb-2">
                  <div className="font-semibold text-[var(--text-primary)] break-words min-w-0">{r.projectName}</div>
                  {r.waiting && (
                    <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[color-mix(in_srgb,var(--status-warning)_20%,transparent)] text-[var(--status-warning)]">
                      {t('overview.projects.waiting')}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <Row label={t('overview.projects.state')} value={t(`overview.projects.stateValue.${r.state}`)} />
                  <Row label={t('overview.projects.spec')} value={r.spec} />
                  <Row label={t('overview.projects.livePhase')} value={r.livePhase} />
                  <Row label={t('overview.projects.runId')} value={r.runId} />
                  <Row label={t('overview.projects.age')} value={fmtAge(r.newestTs, now)} />
                  {r.lastRow && (
                    <Row
                      label={t('overview.projects.lastRow')}
                      value={`${r.lastRow.type} — ${r.lastRow.text}${present(r.lastRow.ts) ? ` (${r.lastRow.ts})` : ''}`}
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">{t('overview.projects.empty')}</div>
        )}
      </div>

      {/* Operator to-do list, open items first (Req 5.5) */}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t('overview.todos.heading')}</h2>
        {sortedTodos.length > 0 ? (
          <div className="space-y-2">
            {sortedTodos.map((todo) => (
              <Card key={todo.id}>
                <div className="flex items-start justify-between gap-2 min-w-0 mb-1">
                  <div className={`font-medium break-words min-w-0 ${todo.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                    {todo.title}
                  </div>
                  <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                    {todo.done ? t('overview.todos.done') : t('overview.todos.open')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <Row label={t('overview.todos.owner')} value={todo.owner} />
                  <Row label={t('overview.todos.priority')} value={todo.priority} />
                  <Row label={t('overview.todos.blocks')} value={todo.blocks} />
                  <Row label={t('overview.todos.since')} value={todo.since} />
                  <Row label={t('overview.todos.note')} value={todo.note} />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">{t('overview.todos.empty')}</div>
        )}
      </div>
    </div>
  );
}
