import React, { useMemo, useState } from 'react';
import { useProjects } from '../projects/ProjectProvider';
import { storeGroups } from '../projects/stores';
import { useShell, DeferralRecord, type DeferralsPayload } from './ShellProvider';
import type { StoreGroup } from '../projects/stores';
import { Button, Pill, TextInput } from '../ui/ui';

/**
 * The Deferrals queue (design C10; Requirement 6, 7). One flat table of
 * every `deferred` record across every enabled spec store, oldest first,
 * each with a Resolve button that opens an in-row box posting to the
 * resolve route task 8 adds. No chips, search, pager or detail panel; a
 * `deferrals-update` push replaces a project's records through
 * ShellProvider, so a resolved row leaves with no reload.
 */

interface FullDeferral extends DeferralRecord {
  owner?: 'matthew' | 'harness' | null;
  createdAt?: string;
  tags?: string[];
}

interface Item {
  store: string;
  projectId: string;
  projectName: string;
  d: FullDeferral;
}

/** A group's records come from the first project in it with a payload
 * (design C12): `deferralsByProject` is built per store, so whichever
 * member's payload has arrived carries the whole store's records. */
function recordsOf(group: StoreGroup, deferralsByProject: Record<string, DeferralsPayload>): FullDeferral[] {
  const withPayload = group.projects.find((p) => deferralsByProject[p.projectId]);
  return withPayload ? (deferralsByProject[withPayload.projectId]?.deferrals ?? []) as FullDeferral[] : [];
}

/** Age under 24 h as whole hours, else whole days (design D22). */
function ageText(createdAt?: string): string {
  if (!createdAt) return '';
  const hours = Math.floor((Date.now() - Date.parse(createdAt)) / (3600 * 1000));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function DeferralsPage() {
  const { projects, enabled } = useProjects();
  const { deferralsByProject } = useShell();

  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  const groups = useMemo(() => storeGroups(projects, enabled), [projects, enabled]);
  const enabledGroups = useMemo(() => groups.filter((g) => g.enabled), [groups]);
  const enabledKey = enabledGroups.map((g) => g.store).join(',');

  // Every enabled store's open records, oldest first, ties by id (Requirement 6 AC1, AC3).
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const g of enabledGroups) {
      for (const d of recordsOf(g, deferralsByProject)) {
        if (d.status !== 'deferred') continue;
        out.push({ store: g.store, projectId: g.representative.projectId, projectName: g.representative.projectName, d });
      }
    }
    out.sort((a, b) => {
      const ca = a.d.createdAt ?? '';
      const cb = b.d.createdAt ?? '';
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.d.id < b.d.id ? -1 : a.d.id > b.d.id ? 1 : 0;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, deferralsByProject]);

  function openResolve(id: string) {
    setOpenId(id);
    setText('');
    setError(null);
  }

  function cancelResolve() {
    setOpenId(null);
    setText('');
    setError(null);
  }

  async function confirmResolve(item: Item) {
    const trimmed = text.trim();
    if (!trimmed || inFlight) return;
    setInFlight(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${item.projectId}/deferrals/${item.d.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: trimmed }),
      });
      if (res.ok) {
        setOpenId(null);
        setText('');
      } else {
        const body = await res.json().catch(() => ({} as { error?: string }));
        setError(body?.error || 'Failed to resolve.');
      }
    } catch {
      setError('Failed to resolve.');
    } finally {
      setInFlight(false);
    }
  }

  return (
    <div data-testid="page-list">
      {items.length === 0 ? (
        <p data-testid="deferrals-empty" className="text-sm text-[var(--text-muted)]">
          {'Queue empty'}
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const { d } = item;
            const isOpen = openId === d.id;
            return (
              <div
                key={d.id}
                className="border-b border-[var(--border-default)] py-2"
                data-testid={`deferral-row-${item.projectId}-${d.id}`}
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="shrink-0 tabular-nums text-xs text-[var(--text-muted)]">{ageText(d.createdAt)}</span>
                  <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">{d.id}</span>
                  <span className="shrink-0 text-[var(--text-secondary)]">{item.projectName}</span>
                  <span className="shrink-0 text-xs text-[var(--text-secondary)]">{d.originSpec || 'project'}</span>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {Array.isArray(d.tags) ? d.tags.join(', ') : ''}
                  </span>
                  {d.owner && <Pill tone="neutral" className="shrink-0">{d.owner}</Pill>}
                  <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{d.title}</span>
                  {!isOpen && (
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`deferral-resolve-${d.id}`}
                      onClick={() => openResolve(d.id)}
                    >
                      {'Resolve'}
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-2 flex flex-col gap-2 rounded-md border border-[var(--border-default)] p-2">
                    <TextInput
                      data-testid={`deferral-resolution-${d.id}`}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={'Resolution'}
                    />
                    {error && (
                      <p data-testid={`deferral-resolve-error-${d.id}`} className="text-xs text-[var(--tone-danger-fg)]">
                        {error}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        data-testid={`deferral-resolve-confirm-${d.id}`}
                        disabled={text.trim().length === 0 || inFlight}
                        onClick={() => confirmResolve(item)}
                      >
                        {'Resolve'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        data-testid={`deferral-resolve-cancel-${d.id}`}
                        onClick={cancelResolve}
                      >
                        {'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
