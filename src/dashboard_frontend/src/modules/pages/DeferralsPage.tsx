import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiActions, useApiData, Deferral, DeferralsResponse, DeferredSpec } from '../api/api';
import { useWs } from '../ws/WebSocketProvider';
import { formatDate } from '../../lib/dateUtils';

type StatusFilter = 'all' | 'deferred' | 'resolved' | 'superseded';

/** Sentinel for deferrals with no originSpec — decisions deferred at project level. */
const PROJECT_SCOPE = '__project__';

const STATUS_STYLES: Record<Deferral['status'], string> = {
  deferred: 'bg-[color-mix(in_srgb,var(--interactive-primary)_15%,transparent)] text-[var(--interactive-primary)]',
  resolved: 'bg-[color-mix(in_srgb,#22c55e_18%,transparent)] text-green-600 dark:text-green-400',
  superseded: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]',
};

function StatusBadge({ status }: { status: Deferral['status'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--surface-hover)] text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

const EMPTY: DeferralsResponse = { deferrals: [], duplicateGroups: [], deferredSpecs: [] };

export function DeferralsPage() {
  const { t } = useTranslation();
  const { projectId } = useApiData();
  const { getDeferrals } = useApiActions();
  const { subscribe, unsubscribe } = useWs();

  const [data, setData] = useState<DeferralsResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [status, setStatus] = useState<StatusFilter>('all');
  const [scope, setScope] = useState<string>('all');
  const [tag, setTag] = useState<string>('all');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(() => {
    if (!projectId) {
      setData(EMPTY);
      return;
    }
    setLoading(true);
    setError('');
    getDeferrals()
      .then((res) => setData({
        deferrals: res.deferrals || [],
        duplicateGroups: res.duplicateGroups || [],
        deferredSpecs: res.deferredSpecs || [],
      }))
      .catch((e) => setError(e?.message || 'Failed to load deferrals'))
      .finally(() => setLoading(false));
  }, [projectId, getDeferrals]);

  useEffect(() => { load(); }, [load]);

  // Live updates: the server pushes the whole payload when the store changes.
  useEffect(() => {
    const handler = (payload: DeferralsResponse) => {
      if (!payload?.deferrals) return;
      setData({
        deferrals: payload.deferrals,
        duplicateGroups: payload.duplicateGroups || [],
        deferredSpecs: payload.deferredSpecs || [],
      });
    };
    subscribe('deferrals-update', handler);
    return () => { unsubscribe('deferrals-update', handler); };
  }, [subscribe, unsubscribe]);

  const originSpecs = useMemo(
    () => Array.from(new Set(data.deferrals.map(d => d.originSpec).filter((s): s is string => !!s))).sort(),
    [data.deferrals]
  );
  const hasProjectScoped = useMemo(() => data.deferrals.some(d => !d.originSpec), [data.deferrals]);
  const tags = useMemo(
    () => Array.from(new Set(data.deferrals.flatMap(d => d.tags))).sort(),
    [data.deferrals]
  );

  const filtered = useMemo(() => data.deferrals.filter(d => {
    if (status !== 'all' && d.status !== status) return false;
    if (scope === PROJECT_SCOPE && d.originSpec) return false;
    if (scope !== 'all' && scope !== PROJECT_SCOPE && d.originSpec !== scope) return false;
    if (tag !== 'all' && !d.tags.includes(tag)) return false;
    return true;
  }), [data.deferrals, status, scope, tag]);

  const counts = useMemo(() => ({
    deferred: data.deferrals.filter(d => d.status === 'deferred').length,
    resolved: data.deferrals.filter(d => d.status === 'resolved').length,
    superseded: data.deferrals.filter(d => d.status === 'superseded').length,
  }), [data.deferrals]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const jumpTo = useCallback((id: string) => {
    setHighlightId(id);
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (!projectId) {
    return (
      <div className="p-6 text-[var(--text-secondary)]">
        {t('deferrals.noProject')}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t('deferrals.title')}
        </h1>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          {t('common.refresh')}
        </button>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {t('deferrals.subtitle', {
          deferred: counts.deferred,
          resolved: counts.resolved,
          superseded: counts.superseded,
        })}
      </p>

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Deferred specs — whole specs postponed in the build order */}
      <DeferredSpecsSection specs={data.deferredSpecs} t={t} />

      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
        {t('deferrals.decisionsHeading')}
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-3">
        {t('deferrals.decisionsDescription')}
      </p>

      {/* Duplicate detection */}
      {data.duplicateGroups.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-400/50 bg-amber-50/60 dark:bg-amber-900/15 p-3">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
            {t('deferrals.duplicatesHeading', { count: data.duplicateGroups.length })}
          </div>
          <ul className="space-y-2">
            {data.duplicateGroups.map((group, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)]">
                {group.originSpec && <span className="font-mono text-xs mr-2">[{group.originSpec}]</span>}
                {group.members.map((m, j) => (
                  <React.Fragment key={m.id}>
                    {j > 0 && <span className="mx-1">·</span>}
                    <button onClick={() => jumpTo(m.id)} className="underline hover:text-[var(--interactive-primary)]">
                      {m.title}
                    </button>
                  </React.Fragment>
                ))}
                <span className="ml-2 text-xs italic">{t('deferrals.duplicatesHint')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select label={t('deferrals.filterStatus')} value={status} onChange={(v) => setStatus(v as StatusFilter)}
          options={[['all', t('common.all')], ['deferred', 'deferred'], ['resolved', 'resolved'], ['superseded', 'superseded']]} />
        <Select label={t('deferrals.filterScope')} value={scope} onChange={setScope}
          options={[
            ['all', t('common.all')],
            ...(hasProjectScoped ? [[PROJECT_SCOPE, t('deferrals.scopeProject')] as [string, string]] : []),
            ...originSpecs.map(s => [s, s] as [string, string]),
          ]} />
        <Select label={t('deferrals.filterTag')} value={tag} onChange={setTag}
          options={[['all', t('common.all')], ...tags.map(s => [s, s] as [string, string])]} />
      </div>

      {loading && data.deferrals.length === 0 ? (
        <div className="text-[var(--text-secondary)]">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-[var(--text-secondary)] border border-dashed border-[var(--border-default)] rounded-md p-8 text-center">
          {data.deferrals.length === 0
            ? t('deferrals.empty')
            : t('deferrals.emptyFiltered')}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <DeferralCard
              key={d.id}
              deferral={d}
              highlighted={highlightId === d.id}
              expanded={expandedIds.has(d.id)}
              onToggle={toggleExpanded}
              onJump={jumpTo}
              setRef={(el) => { cardRefs.current[d.id] = el; }}
              t={t}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeferredSpecsSection({ specs, t }: { specs: DeferredSpec[]; t: TFn }) {
  if (specs.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
        {t('deferrals.specsHeading', { count: specs.length })}
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-3">
        {t('deferrals.specsDescription')}
      </p>
      <ul className="space-y-2">
        {specs.map((s) => (
          <li key={s.name} className="rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] p-3">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
              <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                {t('deferrals.deferredAt')}: {formatDate(s.deferredAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{s.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] text-sm text-[var(--text-primary)] min-w-[10rem]"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function DetailSection({ heading, body }: { heading: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1">{heading}</h4>
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function DeferralCard({ deferral: d, highlighted, expanded, onToggle, onJump, setRef, t }: {
  deferral: Deferral;
  highlighted: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onJump: (id: string) => void;
  setRef: (el: HTMLDivElement | null) => void;
  t: TFn;
}) {
  const muted = d.status !== 'deferred';
  const hasDetails = Boolean(d.body.context.trim() || d.body.decision.trim() || d.body.revisitCriteria.trim());
  return (
    <li>
      <div
        ref={setRef}
        className={`rounded-md border p-4 transition-colors ${muted ? 'opacity-70' : ''} ${
          highlighted ? 'border-[var(--interactive-primary)] ring-1 ring-[var(--interactive-primary)]' : 'border-[var(--border-default)]'
        } bg-[var(--surface-panel)]`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className={`font-medium text-[var(--text-primary)] ${d.status === 'superseded' ? 'line-through' : ''}`}>
            {d.title}
          </h3>
          <StatusBadge status={d.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--text-secondary)]">
          <span className="font-mono">{d.id}</span>
          <Chip>{d.originSpec ? `${t('deferrals.originSpec')}: ${d.originSpec}` : t('deferrals.scopeProject')}</Chip>
          {d.originPhase && <Chip>{d.originPhase}</Chip>}
          {d.tags.map((tg) => <Chip key={tg}>#{tg}</Chip>)}
        </div>

        {d.revisitTrigger && (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            <span className="font-medium">{t('deferrals.revisit')}:</span> {d.revisitTrigger}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span>{t('deferrals.created')}: {formatDate(d.createdAt)}</span>
          {d.status === 'resolved' && (
            <span>
              {t('deferrals.resolved')}: {formatDate(d.resolvedAt || undefined)}
              {d.resolvedInSpec ? ` (${d.resolvedInSpec})` : ''}
            </span>
          )}
          {d.supersedes && (
            <span>
              {t('deferrals.supersedes')}:{' '}
              <button onClick={() => onJump(d.supersedes!)} className="font-mono underline hover:text-[var(--interactive-primary)]">{d.supersedes}</button>
            </span>
          )}
          {d.supersededBy && (
            <span>
              {t('deferrals.supersededBy')}:{' '}
              <button onClick={() => onJump(d.supersededBy!)} className="font-mono underline hover:text-[var(--interactive-primary)]">{d.supersededBy}</button>
            </span>
          )}
        </div>

        {d.status === 'resolved' && d.resolution && (
          <p className="mt-2 text-sm text-[var(--text-secondary)] italic">{d.resolution}</p>
        )}

        {hasDetails && (
          <>
            <button
              onClick={() => onToggle(d.id)}
              aria-expanded={expanded}
              className="mt-3 text-xs font-medium text-[var(--interactive-primary)] hover:underline"
            >
              {expanded ? t('deferrals.hideDetails') : t('deferrals.showDetails')}
            </button>
            {expanded && (
              <div className="mt-3 pt-3 border-t border-[var(--border-default)] space-y-3">
                <DetailSection heading={t('deferrals.context')} body={d.body.context} />
                <DetailSection heading={t('deferrals.decision')} body={d.body.decision} />
                <DetailSection heading={t('deferrals.revisitCriteria')} body={d.body.revisitCriteria} />
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}
