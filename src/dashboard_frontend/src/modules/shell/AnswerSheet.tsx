import React, { useState } from 'react';
import type { ControllerWait } from './types';
import { Button, ui } from '../ui/ui';

// The controller-wait answer sheet (design C10, D31, D33; task 11).

const CTRL_KIND_LABELS: Record<ControllerWait['kind'], string> = {
  'gate-a': 'Gate A', 'gate-b': 'Gate B', 'retro-plan': 'Retro plan',
  merge: 'Merge', escalation: 'Escalation', error: 'Error', question: 'Question',
};

function KindBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-(--surface-inset) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
      {label}
    </span>
  );
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

function DetailText({ heading, body }: { heading: string; body?: string | null }) {
  if (!body || !body.trim()) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{heading}</h4>
      <p className="whitespace-pre-wrap text-sm text-(--text-primary)">{body}</p>
    </div>
  );
}

/** "Second opinion" on an open wait (design C7, C12): disabled while running. */
function SecondOpinionButton({ wait }: { wait: ControllerWait }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = wait.opinionStatus?.state === 'running';
  const failureReason = wait.opinionStatus?.state === 'failed' ? wait.opinionStatus.reason : undefined;

  async function press() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/controller/waits/${wait.id}/second-opinion`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; reason?: string }));
        throw new Error(body?.reason ?? body?.error ?? `second opinion failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message ?? 'second opinion failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={press} disabled={running || pending} data-testid="second-opinion">
        {'Second opinion'}
      </Button>
      {(failureReason || error) && (
        <span className="min-w-0 text-xs text-(--tone-danger-fg)">{failureReason ?? error}</span>
      )}
    </div>
  );
}

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
        <span className="text-xs text-(--text-muted)">{projectName}</span>
      </div>
      <h2 className="mt-1 break-words text-base font-semibold text-(--text-primary)">{title}</h2>
      {wait.spec && <p className="text-xs text-(--text-muted)">{wait.spec}</p>}
    </div>
  );
}

function SubmitButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="primary" onClick={onClick} disabled={disabled} data-testid="answer-submit">
      {label}
    </Button>
  );
}

export function AnswerSheet({ wait, projectName, onDone }: { wait: ControllerWait; projectName: string; onDone: () => void }) {
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

  const questionFields = wait.questions.map((q) => {
    const pick = wait.opinion?.picks.find((p) => p.question === q.id);
    return (
    <div key={q.id}>
      <p className="mb-1 whitespace-normal break-words text-sm font-medium text-(--text-primary)">{q.text}</p>
      {!q.free && q.options && q.options.length > 0 ? (
        <div className="space-y-1">
          {q.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-(--text-secondary)">
              <input
                type="radio"
                name={q.id}
                checked={values[q.id] === opt}
                onChange={() => setValue(q.id, opt)}
                data-testid={`answer-opt-${q.id}`}
              />
              {opt}
              {q.recommended === opt && <span className="text-xs text-(--text-muted)">(recommended)</span>}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={values[q.id] ?? ''}
          onChange={(e) => setValue(q.id, e.target.value)}
          data-testid={`answer-text-${q.id}`}
          rows={2}
          className="w-full rounded-md border border-(--border-default) bg-(--surface-inset) px-3 py-1.5 text-sm text-(--text-primary)"
        />
      )}
      {q.reason && <p className="mt-0.5 text-xs text-(--text-muted)">{q.reason}</p>}
      {pick && (
        <p className="mt-1 text-xs text-(--text-secondary)" data-testid={`opinion-pick-${q.id}`}>
          <span className="font-medium text-(--text-primary)">{'Advisor pick: '}{pick.pick}</span>
          {' — '}{pick.reason}
        </p>
      )}
    </div>
    );
  });

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (wait.kind === 'gate-a' || wait.kind === 'gate-b') {
    body = <div className="space-y-4">{questionFields}</div>;
    footer = (
      <>
        <p className="text-xs text-(--text-muted)">
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
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Proposals</h4>
            <div className="space-y-2">
              {wait.proposals.map((p, i) => {
                const { title, body } = splitProposal(p);
                return (
                  <div key={i} className="flex items-start gap-2 text-sm text-(--text-secondary)">
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
                      <label htmlFor={`proposal-${i}`} className="cursor-pointer whitespace-normal break-words font-medium text-(--text-primary)">
                        {title}
                      </label>
                      {body && (
                        <details className="mt-0.5">
                          <summary className="cursor-pointer text-xs text-(--text-muted)">Details</summary>
                          <p className="mt-1 whitespace-normal break-words text-(--text-secondary)">{body}</p>
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
      : <p className="text-sm text-(--text-secondary)">{ctrlSummary(wait)}</p>;
    footer = (
      <div className="flex gap-2">
        <SubmitButton label={'Merge'} disabled={submitting} onClick={() => submit({ [decisionKey(wait)]: 'merge' })} />
        <Button
          variant="secondary"
          onClick={() => submit({ [decisionKey(wait)]: 'hold' })}
          disabled={submitting}
          data-testid="answer-hold"
        >
          Hold
        </Button>
      </div>
    );
  } else if (wait.kind === 'error' || wait.kind === 'escalation') {
    body = questionFields.length > 0 ? <div className="space-y-4">{questionFields}</div>
      : <p className="text-sm text-(--text-secondary)">{ctrlSummary(wait)}</p>;
    footer = (
      <div className="flex gap-2">
        <SubmitButton label={'Retry'} disabled={submitting} onClick={() => submit({ [decisionKey(wait)]: 'retry' })} />
        <Button
          variant="secondary"
          onClick={() => submit({ [decisionKey(wait)]: 'abandon' })}
          disabled={submitting}
          data-testid="answer-abandon"
        >
          Abandon
        </Button>
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
        className="w-full rounded-md border border-(--border-default) bg-(--surface-inset) px-3 py-1.5 text-sm text-(--text-primary)"
      />
    )}</div>;
    footer = <SubmitButton label={'Answer and continue'} disabled={submitting} onClick={() => submit(values)} />;
  }

  return (
    <div className={`${ui.panel} p-4`} data-testid="now-answer-sheet">
      <SheetHeader wait={wait} projectName={projectName} title={title} />
      <div className="space-y-4 border-t border-(--border-default) pt-3">
        {body}
        <SecondOpinionButton wait={wait} />
        {wait.opinion ? (
          <DetailText heading={'Opinion'} body={wait.opinion.summary} />
        ) : (
          <DetailText heading={'Advice'} body={wait.advice} />
        )}
        {error && <p className="text-sm text-(--tone-danger-fg)">{error}</p>}
        <div className="flex items-center gap-3">{footer}</div>
      </div>
    </div>
  );
}
