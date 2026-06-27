import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiActions, useApiData, Deferral, DeferralsResponse } from '../api/api';
import { formatDate } from '../../lib/dateUtils';

type StatusFilter = 'all' | 'deferred' | 'resolved' | 'superseded';

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

export function DeferralsPage() {
  const { t } = useTranslation();
  const { projectId } = useApiData();
  const { getDeferrals } = useApiActions();

  const [data, setData] = useState<DeferralsResponse>({ deferrals: [], duplicateGroups: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [status, setStatus] = useState<StatusFilter>('all');
  const [originSpec, setOriginSpec] = useState<string>('all');
  const [tag, setTag] = useState<string>('all');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(() => {
    if (!projectId) {
      setData({ deferrals: [], duplicateGroups: [] });
      return;
    }
    setLoading(true);
    setError('');
    getDeferrals()
      .then((res) => setData(res))
      .catch((e) => setError(e?.message || 'Failed to load deferrals'))
      .finally(() => setLoading(false));
  }, [projectId, getDeferrals]);

  useEffect(() => { load(); }, [load]);

  const originSpecs = useMemo(
    () => Array.from(new Set(data.deferrals.map(d => d.originSpec).filter((s): s is string => !!s))).sort(),
    [data.deferrals]
  );
  const tags = useMemo(
    () => Array.from(new Set(data.deferrals.flatMap(d => d.tags))).sort(),
    [data.deferrals]
  );

  const filtered = useMemo(() => data.deferrals.filter(d => {
    if (status !== 'all' && d.status !== status) return false;
    if (originSpec !== 'all' && d.originSpec !== originSpec) return false;
    if (tag !== 'all' && !d.tags.includes(tag)) return false;
    return true;
  }), [data.deferrals, status, originSpec, tag]);

  const counts = useMemo(() => ({
    deferred: data.deferrals.filter(d => d.status === 'deferred').length,
    resolved: data.deferrals.filter(d => d.status === 'resolved').length,
    superseded: data.deferrals.filter(d => d.status === 'superseded').length,
  }), [data.deferrals]);

  const jumpTo = useCallback((id: string) => {
    setHighlightId(id);
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (!projectId) {
    return (
      <div className="p-6 text-[var(--text-secondary)]">
        {t('deferrals.noProject', 'Select a project to view deferred decisions.')}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t('deferrals.title', 'Deferred Decisions')}
        </h1>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          {t('common.refresh', 'Refresh')}
        </button>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {t('deferrals.subtitle', 'Decisions explicitly deferred during spec work. {{deferred}} open, {{resolved}} resolved, {{superseded}} superseded.', {
          deferred: counts.deferred,
          resolved: counts.resolved,
          superseded: counts.superseded,
        })}
      </p>

      {/* Duplicate detection */}
      {data.duplicateGroups.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-400/50 bg-amber-50/60 dark:bg-amber-900/15 p-3">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
            {t('deferrals.duplicatesHeading', 'Potential duplicates ({{count}} group(s))', { count: data.duplicateGroups.length })}
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
                <span className="ml-2 text-xs italic">{t('deferrals.duplicatesHint', '— consider merging')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select label={t('deferrals.filterStatus', 'Status')} value={status} onChange={(v) => setStatus(v as StatusFilter)}
          options={[['all', t('common.all', 'All')], ['deferred', 'deferred'], ['resolved', 'resolved'], ['superseded', 'superseded']]} />
        <Select label={t('deferrals.filterOriginSpec', 'Origin spec')} value={originSpec} onChange={setOriginSpec}
          options={[['all', t('common.all', 'All')], ...originSpecs.map(s => [s, s] as [string, string])]} />
        <Select label={t('deferrals.filterTag', 'Tag')} value={tag} onChange={setTag}
          options={[['all', t('common.all', 'All')], ...tags.map(s => [s, s] as [string, string])]} />
      </div>

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {loading && data.deferrals.length === 0 ? (
        <div className="text-[var(--text-secondary)]">{t('common.loading', 'Loading…')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-[var(--text-secondary)] border border-dashed border-[var(--border-default)] rounded-md p-8 text-center">
          {data.deferrals.length === 0
            ? t('deferrals.empty', 'No deferred decisions recorded for this project yet.')
            : t('deferrals.emptyFiltered', 'No deferrals match the current filters.')}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <DeferralCard
              key={d.id}
              deferral={d}
              highlighted={highlightId === d.id}
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

function DeferralCard({ deferral: d, highlighted, onJump, setRef, t }: {
  deferral: Deferral;
  highlighted: boolean;
  onJump: (id: string) => void;
  setRef: (el: HTMLDivElement | null) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const muted = d.status !== 'deferred';
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
          {d.originSpec && <Chip>{t('deferrals.originSpec', 'spec')}: {d.originSpec}</Chip>}
          {d.originPhase && <Chip>{d.originPhase}</Chip>}
          {d.tags.map((tg) => <Chip key={tg}>#{tg}</Chip>)}
        </div>

        {d.revisitTrigger && (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            <span className="font-medium">{t('deferrals.revisit', 'Revisit')}:</span> {d.revisitTrigger}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span>{t('deferrals.created', 'Created')}: {formatDate(d.createdAt)}</span>
          {d.status === 'resolved' && (
            <span>
              {t('deferrals.resolved', 'Resolved')}: {formatDate(d.resolvedAt || undefined)}
              {d.resolvedInSpec ? ` (${d.resolvedInSpec})` : ''}
            </span>
          )}
          {d.supersedes && (
            <span>
              {t('deferrals.supersedes', 'Supersedes')}:{' '}
              <button onClick={() => onJump(d.supersedes!)} className="font-mono underline hover:text-[var(--interactive-primary)]">{d.supersedes}</button>
            </span>
          )}
          {d.supersededBy && (
            <span>
              {t('deferrals.supersededBy', 'Superseded by')}:{' '}
              <button onClick={() => onJump(d.supersededBy!)} className="font-mono underline hover:text-[var(--interactive-primary)]">{d.supersededBy}</button>
            </span>
          )}
        </div>

        {d.status === 'resolved' && d.resolution && (
          <p className="mt-2 text-sm text-[var(--text-secondary)] italic">{d.resolution}</p>
        )}
      </div>
    </li>
  );
}
