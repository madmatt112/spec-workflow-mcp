import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { PageLayout } from './PageLayout';
import { Group, Row } from './primitives';
import { formatDate } from '../../lib/dateUtils';
import type { Wait, ControllerWait, ControllerRun } from './types';

const KIND_LABELS: Record<string, string> = {
  gate: 'Gate', ruling: 'Ruling', retro: 'Retro', exited: 'Exited', quiet: 'Quiet',
};

const CTRL_KIND_LABELS: Record<ControllerWait['kind'], string> = {
  'gate-a': 'Gate A', 'gate-b': 'Gate B', 'retro-plan': 'Retro plan',
  merge: 'Merge', escalation: 'Escalation', error: 'Error', question: 'Question',
};

/** Controller run statuses that count as queued-or-live on the Now page. */
const CTRL_LIVE_STATUSES: ControllerRun['status'][] = ['queued', 'running', 'merging', 'paused', 'waiting'];

/** One-line detail of a controller run: status, step and pause reason. */
function ctrlRunDetail(r: ControllerRun): string {
  const parts = [r.status];
  if (r.stepKind) parts.push(r.stepKind);
  if (r.pauseReason) parts.push(r.pauseReason);
  return parts.join(' · ');
}

/**
 * The Now page (design C10 Now; Requirement 3; controller spec 16 T4). The home
 * page of waits, live runs, idle projects and recently closed specs. Controller
 * waits (from the controller, over the `controller-waits` topic) head the
 * "Waiting on you" group and open an answer sheet in the panel; the derived
 * waits below them stay read-only (spec 15).
 */

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

/** Stable identity of a wait so the open panel re-derives across pushes. */
function waitKey(w: Wait): string {
  return `${w.kind}::${w.projectId}::${w.spec ?? ''}::${w.since}`;
}

/** One-line summary of a controller wait for its row. */
function ctrlSummary(w: ControllerWait): string {
  const q0 = w.questions[0]?.text;
  switch (w.kind) {
    case 'gate-a': return `Gate A — ${w.questions.length} decision(s)`;
    case 'gate-b': return `Gate B — ${w.questions.length} item(s)`;
    case 'retro-plan': return `Retro plan — ${w.proposals?.length ?? 0} proposal(s)`;
    case 'merge': return q0 ?? 'Ready to merge';
    case 'escalation': return q0 ?? 'A reviewer escalated';
    case 'error': return q0 ?? 'A step needs a decision';
    case 'question': return q0 ?? 'A step needs one fact';
    default: return q0 ?? '';
  }
}

function KindBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[color-mix(in_srgb,var(--accent-primary,#2563eb)_15%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--accent-primary,#2563eb)]">
      {phase}
    </span>
  );
}

function Age({ value }: { value: string | null }) {
  if (!value) return null;
  return <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{value}</span>;
}

export function NowPage() {
  const navigate = useNavigate();
  const { enabled, projects } = useProjects();
  const { now, controllerWaits, controllerRuns } = useShell();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());

  // Tick ages every second, as OverviewPage does at :73-77.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Open controller waits head the group; answered ones drop out on the push.
  const ctrlWaits = useMemo(
    () => controllerWaits.filter((w) => w.state === 'open'),
    [controllerWaits]
  );
  const projectName = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.projectId, p.projectName]));
    return (id: string) => byId.get(id) ?? id;
  }, [projects]);

  const waits = useMemo(() => (now?.waits ?? []).filter((w) => enabled(w.projectId)), [now, enabled]);
  const live = useMemo(() => (now?.live ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);

  // The controller's queued and live runs (controller-tasks.md T10 item 5) head
  // the Live runs group; a ledger-derived live row for the same project drops out
  // (the controller is authoritative for its own runs).
  const ctrlLive = useMemo(
    () => controllerRuns.filter(
      (r) => enabled(r.project) && CTRL_LIVE_STATUSES.includes(r.status),
    ),
    [controllerRuns, enabled],
  );
  const ctrlProjects = useMemo(() => new Set(ctrlLive.map((r) => r.project)), [ctrlLive]);
  const legacyLive = useMemo(() => live.filter((r) => !ctrlProjects.has(r.projectId)), [live, ctrlProjects]);

  const idle = useMemo(() => (now?.idle ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);
  const closed = useMemo(() => (now?.closed ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);

  // Re-derive the selected wait from current data so a push refreshes the panel.
  const selectedCtrl = useMemo<ControllerWait | null>(
    () => (selectedKey?.startsWith('cw::') ? ctrlWaits.find((w) => `cw::${w.id}` === selectedKey) ?? null : null),
    [selectedKey, ctrlWaits]
  );
  const selected = useMemo<Wait | null>(
    () => (selectedKey && !selectedKey.startsWith('cw::') ? waits.find((w) => waitKey(w) === selectedKey) ?? null : null),
    [selectedKey, waits]
  );

  const dash = '—';
  const waitCount = ctrlWaits.length + waits.length;

  const list = (
    <div>
      <Group name="now-waits" title={'Waiting on you'} count={waitCount}>
        {waitCount === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'Nothing waiting on you.'}</p>
        ) : (
          <>
            {ctrlWaits.map((w) => (
              <Row
                key={`cw::${w.id}`}
                testId={`ctrl-wait-row-${w.id}`}
                selected={selectedKey === `cw::${w.id}`}
                onClick={() => setSelectedKey(`cw::${w.id}`)}
              >
                <KindBadge label={CTRL_KIND_LABELS[w.kind] ?? w.kind} />
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{projectName(w.project)}</span>
                <span className="shrink-0 font-medium text-[var(--text-primary)]">{w.spec || dash}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{ctrlSummary(w)}</span>
                <Age value={fmtAge(w.created, tick)} />
              </Row>
            ))}
            {waits.map((w) => (
              <Row
                key={waitKey(w)}
                testId={`wait-row-${w.kind}-${w.projectId}`}
                selected={selectedKey === waitKey(w)}
                onClick={() => setSelectedKey(waitKey(w))}
              >
                <KindBadge label={KIND_LABELS[w.kind] ?? w.kind} />
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{w.projectName}</span>
                <span className="shrink-0 font-medium text-[var(--text-primary)]">{w.spec ?? dash}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{w.summary}</span>
                <Age value={fmtAge(w.since, tick)} />
              </Row>
            ))}
          </>
        )}
      </Group>

      <Group name="now-live" title={'Live runs'} count={ctrlLive.length + legacyLive.length}>
        {ctrlLive.length + legacyLive.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'No live runs.'}</p>
        ) : (
          <>
            {ctrlLive.map((r) => (
              <Row
                key={`ctrl:${r.id}`}
                testId={`live-row-${r.project}`}
                onClick={() => navigate(`/runs/${r.project}`)}
              >
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{projectName(r.project)}</span>
                <span className="shrink-0 font-medium text-[var(--text-primary)]">{r.spec}</span>
                {r.phase && <PhaseChip phase={r.phase} />}
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{ctrlRunDetail(r)}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                  {r.tokens.toLocaleString()} {'tok'}
                </span>
                <Age value={fmtAge(r.created, tick)} />
              </Row>
            ))}
            {legacyLive.map((r) => (
              <Row
                key={`${r.projectId}:${r.runId}`}
                testId={`live-row-${r.projectId}`}
                onClick={() => navigate(`/runs/${r.projectId}`)}
              >
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
                <span className="shrink-0 font-medium text-[var(--text-primary)]">{r.spec}</span>
                {r.phase && <PhaseChip phase={r.phase} />}
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{r.detail}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                  {r.tokens.toLocaleString()} {'tok'}
                </span>
                <Age value={fmtAge(r.startedAt, tick)} />
              </Row>
            ))}
          </>
        )}
      </Group>

      <Group name="now-idle" title={'Idle projects'} count={idle.length}>
        {idle.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'No idle projects.'}</p>
        ) : (
          idle.map((r) => (
            <Row key={r.projectId} testId={`idle-row-${r.projectId}`}>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
              {r.launchable ? (
                <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{r.launchable}</span>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">
                  {r.disabledReason ?? 'No launchable spec'}
                </span>
              )}
            </Row>
          ))
        )}
      </Group>

      <Group name="now-closed" title={'Recently closed'} count={closed.length} defaultCollapsed>
        {closed.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'Nothing closed recently.'}</p>
        ) : (
          closed.map((r) => (
            <Row key={`${r.projectId}:${r.spec}`} testId={`closed-row-${r.projectId}-${r.spec}`}>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{r.spec}</span>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{formatDate(r.closedOn)}</span>
            </Row>
          ))
        )}
      </Group>
    </div>
  );

  const panel = selectedCtrl ? (
    <AnswerSheet
      key={selectedCtrl.id}
      wait={selectedCtrl}
      projectName={projectName(selectedCtrl.project)}
      onDone={() => setSelectedKey(null)}
    />
  ) : selected ? (
    <WaitPanel wait={selected} />
  ) : undefined;

  return <PageLayout list={list} panel={panel} />;
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

function DetailText({ heading, body }: { heading: string; body?: string | null }) {
  if (!body || !body.trim()) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{heading}</h4>
      <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controller wait answer sheets (T4). One sheet per kind; submitting POSTs the
// answer and the server's next `controller-waits` push drops the row.
// ---------------------------------------------------------------------------

/** The question id a non-gate decision records under. */
function decisionKey(wait: ControllerWait): string {
  return wait.questions[0]?.id ?? wait.kind;
}

/** Recommended pick, else the first option, else '' for free text. */
function defaultValue(q: ControllerWait['questions'][number]): string {
  if (q.recommended) return q.recommended;
  if (!q.free && q.options && q.options.length > 0) return q.options[0];
  return '';
}

/** Split a raw proposal block into its bold title and the prose that follows. */
function splitProposal(block: string): { title: string; body: string } {
  const m = block.match(/\*\*([\s\S]*?)\*\*/);
  if (!m) return { title: block.replace(/^-\s*/, '').trim(), body: '' };
  const title = m[1].replace(/\s+/g, ' ').trim();
  const body = block.slice((m.index ?? 0) + m[0].length).replace(/\s+/g, ' ').trim();
  return { title, body };
}

function SheetHeader({ wait, projectName, title }: { wait: ControllerWait; projectName: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <KindBadge label={CTRL_KIND_LABELS[wait.kind] ?? wait.kind} />
        <span className="text-xs text-[var(--text-muted)]">{projectName}</span>
      </div>
      <h2 className="mt-1 break-words text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {wait.spec && <p className="text-xs text-[var(--text-muted)]">{wait.spec}</p>}
    </div>
  );
}

function SubmitButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="answer-submit"
      className="rounded-md bg-[var(--accent-primary,#2563eb)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
    >
      {label}
    </button>
  );
}

function AnswerSheet({ wait, projectName, onDone }: { wait: ControllerWait; projectName: string; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const q of wait.questions) v[q.id] = defaultValue(q);
    return v;
  });
  const [approved, setApproved] = useState<boolean[]>(() => (wait.proposals ?? []).map(() => true));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (id: string, value: string) => setValues((prev) => ({ ...prev, [id]: value }));

  async function submit(answers: Record<string, string>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/controller/waits/${wait.id}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers, by: 'operator' }),
      });
      if (!res.ok) throw new Error(`answer failed (${res.status})`);
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'answer failed');
      setSubmitting(false);
    }
  }

  const title =
    wait.kind === 'gate-a' ? 'Gate A' :
    wait.kind === 'gate-b' ? 'Gate B' :
    CTRL_KIND_LABELS[wait.kind] ?? wait.kind;

  const questionFields = wait.questions.map((q) => (
    <div key={q.id}>
      <p className="mb-1 whitespace-normal break-words text-sm font-medium text-[var(--text-primary)]">{q.text}</p>
      {!q.free && q.options && q.options.length > 0 ? (
        <div className="space-y-1">
          {q.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="radio"
                name={q.id}
                checked={values[q.id] === opt}
                onChange={() => setValue(q.id, opt)}
                data-testid={`answer-opt-${q.id}`}
              />
              {opt}
              {q.recommended === opt && <span className="text-xs text-[var(--text-muted)]">(recommended)</span>}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={values[q.id] ?? ''}
          onChange={(e) => setValue(q.id, e.target.value)}
          data-testid={`answer-text-${q.id}`}
          rows={2}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-2 py-1 text-sm text-[var(--text-primary)]"
        />
      )}
      {q.reason && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{q.reason}</p>}
    </div>
  ));

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (wait.kind === 'gate-a' || wait.kind === 'gate-b') {
    body = <div className="space-y-4">{questionFields}</div>;
    footer = (
      <>
        <p className="text-xs text-[var(--text-muted)]">
          Mechanics are recorded, not asked. Leave the recommended pick to record the agent's choice unchanged.
        </p>
        <SubmitButton label={'Answer and continue'} onClick={() => submit(values)} disabled={submitting} />
      </>
    );
  } else if (wait.kind === 'retro-plan') {
    body = (
      <div className="space-y-4">
        {questionFields}
        {wait.proposals && wait.proposals.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Proposals</h4>
            <div className="space-y-2">
              {wait.proposals.map((p, i) => {
                const { title, body } = splitProposal(p);
                return (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      id={`proposal-${i}`}
                      checked={approved[i]}
                      onChange={() => setApproved((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                      data-testid={`proposal-${i}`}
                      aria-label={`Approve ${title}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`proposal-${i}`} className="cursor-pointer whitespace-normal break-words font-medium text-[var(--text-primary)]">
                        {title}
                      </label>
                      {body && (
                        <details className="mt-0.5">
                          <summary className="cursor-pointer text-xs text-[var(--text-muted)]">Details</summary>
                          <p className="mt-1 whitespace-normal break-words text-[var(--text-secondary)]">{body}</p>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
    footer = (
      <SubmitButton
        label={'Approve plan and continue'}
        disabled={submitting}
        onClick={() => {
          const answers = { ...values };
          (wait.proposals ?? []).forEach((_, i) => { answers[`proposal:${i}`] = approved[i] ? 'approve' : 'drop'; });
          submit(answers);
        }}
      />
    );
  } else if (wait.kind === 'merge') {
    body = questionFields.length > 0 ? <div className="space-y-4">{questionFields}</div>
      : <p className="text-sm text-[var(--text-secondary)]">{ctrlSummary(wait)}</p>;
    footer = (
      <div className="flex gap-2">
        <SubmitButton label={'Merge'} disabled={submitting} onClick={() => submit({ [decisionKey(wait)]: 'merge' })} />
        <button
          type="button"
          onClick={() => submit({ [decisionKey(wait)]: 'hold' })}
          disabled={submitting}
          data-testid="answer-hold"
          className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-hover)]"
        >
          Hold
        </button>
      </div>
    );
  } else if (wait.kind === 'error' || wait.kind === 'escalation') {
    body = questionFields.length > 0 ? <div className="space-y-4">{questionFields}</div>
      : <p className="text-sm text-[var(--text-secondary)]">{ctrlSummary(wait)}</p>;
    footer = (
      <div className="flex gap-2">
        <SubmitButton label={'Retry'} disabled={submitting} onClick={() => submit({ [decisionKey(wait)]: 'retry' })} />
        <button
          type="button"
          onClick={() => submit({ [decisionKey(wait)]: 'abandon' })}
          disabled={submitting}
          data-testid="answer-abandon"
          className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-hover)]"
        >
          Abandon
        </button>
      </div>
    );
  } else {
    // question
    body = <div className="space-y-4">{questionFields.length > 0 ? questionFields : (
      <textarea
        value={values['answer'] ?? ''}
        onChange={(e) => setValue('answer', e.target.value)}
        data-testid="answer-text-answer"
        rows={3}
        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-2 py-1 text-sm text-[var(--text-primary)]"
      />
    )}</div>;
    footer = <SubmitButton label={'Answer and continue'} disabled={submitting} onClick={() => submit(values)} />;
  }

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="now-answer-sheet">
      <SheetHeader wait={wait} projectName={projectName} title={title} />
      <div className="space-y-4 border-t border-[var(--border-default)] pt-3">
        {body}
        <DetailText heading={'Advice'} body={wait.advice} />
        {error && <p className="text-sm text-[var(--accent-danger,#dc2626)]">{error}</p>}
        <div className="flex items-center gap-3">{footer}</div>
      </div>
    </div>
  );
}

function WaitDetail({ wait }: { wait: Wait }) {
  const d = wait.detail;
  switch (d.kind) {
    case 'gate':
      if (d.items && d.items.length > 0) {
        return (
          <div className="space-y-3">
            {d.items.map((it, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{it.header}</h4>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{it.question}</p>
                {it.options.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--text-primary)]">
                    {it.options.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );
      }
      if (d.questions && d.questions.trim()) {
        return <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{d.questions}</p>;
      }
      return <p className="text-sm text-[var(--text-muted)]">{'no gate payload'}</p>;
    case 'ruling':
      return (
        <div className="space-y-1.5">
          <Field label={'Phase'} value={d.phase} />
          <Field label={'State'} value={d.state} />
          <DetailText heading={'Note'} body={d.note} />
        </div>
      );
    case 'retro':
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-primary)]">
          {d.lines.map((line, i) => (
            <li key={i} className="whitespace-pre-wrap">{line}</li>
          ))}
        </ul>
      );
    case 'exited':
      return (
        <div className="space-y-1.5">
          <Field label={'Exit code'} value={d.exitCode === null ? '—' : String(d.exitCode)} />
          <Field label={'Signal'} value={d.signal ?? '—'} />
          <Field label={'End time'} value={formatDate(d.endedAt ?? undefined)} />
          <Field label={'Log path'} value={<span className="font-mono text-xs">{d.logPath}</span>} />
        </div>
      );
    case 'quiet':
      return (
        <div className="space-y-1.5">
          <Field label={'Agent'} value={d.agent} />
          <Field label={'Last tool'} value={d.lastTool ?? '—'} />
          <Field label={'Last activity'} value={formatDate(d.lastActivityAt)} />
        </div>
      );
    default:
      return null;
  }
}

function WaitPanel({ wait }: { wait: Wait }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="now-panel">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <KindBadge label={KIND_LABELS[wait.kind] ?? wait.kind} />
          <span className="text-xs text-[var(--text-muted)]">{wait.projectName}</span>
        </div>
        <h2 className="mt-1 break-words text-base font-semibold text-[var(--text-primary)]">
          {wait.spec ?? '—'}
        </h2>
      </div>
      <div className="border-t border-[var(--border-default)] pt-3">
        <WaitDetail wait={wait} />
      </div>
    </div>
  );
}
