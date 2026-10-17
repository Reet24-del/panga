'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { errorText } from '@/lib/client/api';
import { locateQuote, segmentText } from '@/lib/evidence';
import { DIFFICULTIES, buildPressurePlan } from '@/lib/rehearsal';
import { findMoneyMentions } from '@/lib/reply-check';
import type { Commitment, CommitmentClass, Deal, Difficulty, Integrations, Rehearsal as RehearsalT, Requirement, Turn } from '@/lib/types';
import { ErrorNote } from '../ui';
import type { Act, Edit } from './useDeal';
import type { VoiceLine } from './VoiceCall';

const VoiceCall = dynamic(() => import('./VoiceCall'), {
  ssr: false,
  loading: () => <p className="muted">Connecting the voice call…</p>,
});

interface VoiceSession {
  rehearsalId: string;
  signedUrl: string;
  callToken: string;
  firstMessage: string;
}

interface Props {
  deal: Deal;
  edit: Edit;
  act: Act;
  features: Integrations | null;
  onNext: () => void;
}

const KIND: Record<CommitmentClass, { label: string; tone: string }> = {
  in_scope: { label: 'In scope', tone: 'take' },
  out_of_scope: { label: 'Extra work', tone: 'walk' },
  ambiguous: { label: 'Vague promise', tone: 'walk' },
  time: { label: '⏰ Time promise', tone: 'change' },
  price: { label: 'Price talk', tone: 'change' },
};

const RAGE: Record<Difficulty, number> = { reasonable: 1, pushy: 3, hell: 5 };

function Rage({ level }: { level: Difficulty }) {
  return (
    <span className="rage" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= RAGE[level] ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Rehearsal({ deal, edit, act, features, onNext }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('hell');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceSession | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const live = deal.rehearsals.find((r) => r.status === 'live');
  const ended = deal.rehearsals.filter((r) => r.status === 'ended');
  const shown = ended.find((r) => r.id === viewing) ?? ended[ended.length - 1];
  const plan = buildPressurePlan(deal);
  const ready = deal.requirements.some((r) => r.status !== 'removed' && r.evidence.length > 0);

  async function run(key: string, task: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const start = () =>
    run('start', async () => {
      const r = await act<{ deal: Deal; rehearsalId: string; voice: Omit<VoiceSession, 'rehearsalId'> | null }>(`/api/deals/${deal.id}/rehearsals`, {
        mode,
        difficulty,
      });
      setViewing(null);
      if (r.voice) setVoice({ rehearsalId: r.rehearsalId, ...r.voice });
    });

  const end = (rehearsalId: string, transcript?: VoiceLine[]) =>
    run('end', async () => {
      await act(`/api/deals/${deal.id}/rehearsals/${rehearsalId}/end`, transcript?.length ? { transcript } : {});
      setVoice(null);
    });

  if (live?.mode === 'text') {
    return (
      <>
        <ErrorNote message={error} onDismiss={() => setError(null)} />
        <TextCall deal={deal} rehearsal={live} act={act} ending={busy === 'end'} onEnd={() => end(live.id)} />
      </>
    );
  }

  if (live?.mode === 'voice') {
    return (
      <div className="stack">
        <ErrorNote message={error} onDismiss={() => setError(null)} />
        {voice?.rehearsalId === live.id ? (
          <VoiceCall
            signedUrl={voice.signedUrl}
            callToken={voice.callToken}
            firstMessage={voice.firstMessage}
            difficultyLabel={DIFFICULTIES[live.difficulty].label}
            onEnd={(lines) => end(live.id, lines)}
          />
        ) : (
          <div className="callout warn">
            A voice call was interrupted (the page was reloaded).{' '}
            <button type="button" className="btn btn-sm" onClick={() => end(live.id)} disabled={busy !== null}>
              End it and see the replay
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 26 }}>
      <section className="stack" aria-labelledby="hell-head">
        <div className="panel-head">
          <h2 id="hell-head" className="h-section">
            Client from hell
          </h2>
          <span className="small muted">Practise the awkward call before it costs you.</span>
        </div>
        <p style={{ margin: 0, maxWidth: '65ch' }}>
          A pretend client who has read this exact brief calls you and pushes on every gap. Answer like you would on the real call. Afterwards, the
          replay shows anything you accidentally promised. Nothing the pretend client says is real.
        </p>
        <div className="difficulty" role="group" aria-label="How hard should the client push?">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button key={d} type="button" className="choice-card" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
              <Rage level={d} />
              <b>{DIFFICULTIES[d].label}</b>
              <span className="small muted">{DIFFICULTIES[d].blurb}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Rehearse by">
            <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
              Type
            </button>
            <button type="button" aria-pressed={mode === 'voice'} onClick={() => setMode('voice')} disabled={!features?.voice}>
              Talk
            </button>
          </div>
          <span className="small muted">
            {features?.voice ? 'Talking uses your microphone.' : 'Talking isn’t set up on this server yet, typing works.'}
          </span>
        </div>
        {plan.length > 0 && (
          <div className="card">
            <h3 className="h-card" style={{ marginBottom: 6 }}>
              What they’ll push on
            </h3>
            {plan.map((p, i) => (
              <div key={`${p.requirementId}-${i}`} className="plan-item">
                <span className="tick">{i + 1}</span>
                <span>
                  {p.title}
                  {p.quote && <span className="muted"> · “{p.quote}”</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        <ErrorNote message={error} onDismiss={() => setError(null)} />
        {!ready && <div className="callout warn small">The pretend client needs at least one thing the real client actually asked for.</div>}
        <div className="row">
          <button type="button" className="btn btn-primary btn-big" onClick={start} disabled={busy !== null || !ready}>
            {busy === 'start' ? 'Ringing…' : 'Bring on the client'}
          </button>
          <button type="button" className="btn-link" onClick={onNext}>
            Skip to the decision
          </button>
        </div>
      </section>

      {shown && <Replay deal={deal} rehearsal={shown} act={act} edit={edit} onNext={onNext} />}
      {ended.length > 1 && (
        <div className="row small">
          <span className="muted">Earlier calls:</span>
          {ended.map((r, i) => (
            <button key={r.id} type="button" className="btn-link" onClick={() => setViewing(r.id)} aria-current={shown?.id === r.id}>
              Call {i + 1} ({DIFFICULTIES[r.difficulty].label})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Bubble({ turn, requirement }: { turn: Turn; requirement?: Requirement }) {
  return (
    <div
      className={`bubble ${turn.role === 'client' ? 'client' : 'me'}`}
      title={requirement?.evidence[0] ? `Based on: “${requirement.evidence[0].quote}”` : undefined}
    >
      {turn.text}
      {turn.role === 'client' && (
        <span className="tag">Practice line{requirement?.evidence[0] ? `, based on “${requirement.evidence[0].quote}”` : ''}</span>
      )}
    </div>
  );
}

function TextCall({ deal, rehearsal, act, ending, onEnd }: { deal: Deal; rehearsal: RehearsalT; act: Act; ending: boolean; onEnd: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const requirements = new Map(deal.requirements.map((r) => [r.id, r]));
  const plan = buildPressurePlan(deal);
  const raised = new Set(rehearsal.turns.filter((t) => t.role === 'client' && t.requirementId).map((t) => t.requirementId));

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [rehearsal.turns.length, sending]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    try {
      await act(`/api/deals/${deal.id}/rehearsals/${rehearsal.id}/turns`, { text: t });
      setText('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="call-layout">
      <div className="call" aria-label="Rehearsal call">
        <div className="call-head">
          <span className="live">
            <span className="dot" /> On a call with your pretend client
          </span>
          <span className="badge">{DIFFICULTIES[rehearsal.difficulty].label}</span>
        </div>
        <div className="call-body" aria-live="polite">
          {rehearsal.turns.map((t) => (
            <Bubble key={t.id} turn={t} requirement={t.requirementId ? requirements.get(t.requirementId) : undefined} />
          ))}
          {sending && (
            <div className="bubble client" aria-label="The client is typing">
              <span className="dot" style={{ background: 'var(--call-muted)', display: 'inline-block' }} />
            </div>
          )}
          <div ref={bottom} />
        </div>
        <form
          className="call-input"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="call-reply">
            Your answer
          </label>
          <textarea
            id="call-reply"
            className="textarea"
            rows={2}
            value={text}
            maxLength={1000}
            placeholder="Type your answer… (Enter sends)"
            disabled={sending}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button type="submit" className="btn" style={{ background: 'var(--call-ink)', color: 'var(--call)' }} disabled={sending || !text.trim()}>
            Send
          </button>
        </form>
      </div>
      <aside className="stack">
        <ErrorNote message={error} onDismiss={() => setError(null)} />
        <div className="card">
          <h3 className="h-card" style={{ marginBottom: 6 }}>
            Their pressure points
          </h3>
          {plan.map((p, i) => {
            const done = p.requirementId
              ? raised.has(p.requirementId)
              : rehearsal.turns.some((t) => t.role === 'client' && findMoneyMentions(t.text).length > 0);
            return (
              <div key={`${p.requirementId}-${i}`} className={`plan-item ${done ? 'done' : ''}`}>
                <span className="tick">{done ? '✓' : '○'}</span>
                <span>{p.title}</span>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary" onClick={onEnd} disabled={ending || sending}>
          {ending ? 'Hanging up…' : 'End call & see what you promised'}
        </button>
        <p className="small muted">The pretend client only knows this brief. It can’t make up work the real client never mentioned.</p>
      </aside>
    </div>
  );
}

function ReplayLine({ turn, commitments, requirement }: { turn: Turn; commitments: Commitment[]; requirement?: Requirement }) {
  const marks = commitments
    .map((c) => {
      const m = locateQuote(turn.text, c.quote);
      return m ? { start: m.start, end: m.end, key: c.id } : null;
    })
    .filter((x): x is { start: number; end: number; key: string } => x !== null);
  const segments = segmentText(turn.text, marks);
  return (
    <div className={`replay-line ${turn.role === 'freelancer' ? 'me' : ''}`}>
      <div className="who">
        {turn.role === 'client' ? `Pretend client${requirement ? ` · about ${requirement.title.toLowerCase()}` : ''}` : 'You'}
      </div>
      <div>{segments.map((s, i) => (s.keys.length ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</div>
    </div>
  );
}

function Replay({ deal, rehearsal, act, edit, onNext }: { deal: Deal; rehearsal: RehearsalT; act: Act; edit: Edit; onNext: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const replay = rehearsal.replay;
  const commitments = replay?.commitments ?? [];
  const byTurn = new Map<string, Commitment[]>();
  for (const c of commitments) byTurn.set(c.turnId, [...(byTurn.get(c.turnId) ?? []), c]);
  const requirements = new Map(deal.requirements.map((r) => [r.id, r]));
  const open = commitments.filter((c) => !c.resolved).length;

  async function resolve(c: Commitment, resolved: boolean) {
    setError(null);
    try {
      await act(`/api/deals/${deal.id}/rehearsals/${rehearsal.id}/commitments/${c.id}`, { resolved }, 'PATCH');
    } catch (err) {
      setError(errorText(err));
    }
  }

  function leaveOutOfStarter(c: Commitment) {
    edit((d) => {
      const r = d.requirements.find((x) => x.id === c.requirementId);
      if (r) r.inStarter = false;
    });
    void resolve(c, true);
  }

  function addAsItem(c: Commitment) {
    edit((d) => {
      const next = Math.max(0, ...d.requirements.map((r) => Number(r.id.slice(1)) || 0)) + 1;
      d.requirements.push({
        id: `R${next}`,
        title: c.quote.slice(0, 60),
        detail: `You promised this in a rehearsal: “${c.quote}”`,
        category: 'other',
        hidden: false,
        evidence: [],
        status: 'confirmed',
        confirmedWithoutQuote: true,
        hours: 2,
        hoursSource: 'freelancer',
        suggestedHours: null,
        inStarter: false,
        starterHours: 2,
        research: null,
        addedBy: 'freelancer',
      });
    });
    void resolve(c, true);
  }

  return (
    <section className="stack" aria-labelledby="replay-head">
      <div className="panel-head">
        <h2 id="replay-head" className="h-section" style={{ fontSize: 26 }}>
          Replay
        </h2>
        <span className="small muted">
          {DIFFICULTIES[rehearsal.difficulty].label} · {rehearsal.mode === 'voice' ? 'talked' : 'typed'} · {rehearsal.turns.length} lines
        </span>
      </div>
      <ErrorNote message={error} onDismiss={() => setError(null)} />
      {replay?.status === 'pending' && (
        <div className="reading-line">
          <span className="dot" /> Checking what you promised…
        </div>
      )}
      {replay?.status === 'failed' && <ErrorNote message={`Couldn’t analyse this call: ${replay.error ?? 'unknown error'}`} />}
      {replay?.status === 'ready' && commitments.length === 0 && (
        <div className="callout take">Nice! You didn’t promise any extra work, time or money.</div>
      )}
      {replay?.status === 'ready' && commitments.length > 0 && (
        <div className={`callout ${open ? 'walk' : 'take'}`}>
          {open
            ? `You made ${open} ${open === 1 ? 'promise' : 'promises'} worth pinning down before you quote.`
            : 'Every promise from this call is sorted.'}
        </div>
      )}
      <div className="call-layout">
        <div>
          {rehearsal.turns.map((t) => (
            <ReplayLine
              key={t.id}
              turn={t}
              commitments={byTurn.get(t.id) ?? []}
              requirement={t.requirementId ? requirements.get(t.requirementId) : undefined}
            />
          ))}
        </div>
        <aside className="stack">
          {commitments.map((c) => {
            const r = c.requirementId ? requirements.get(c.requirementId) : undefined;
            return (
              <div key={c.id} className={`commitment ${c.resolved ? 'resolved' : ''}`}>
                <div className="row">
                  <span className={`pill ${KIND[c.kind].tone}`}>{KIND[c.kind].label}</span>
                  {r && <span className="small muted">about {r.title.toLowerCase()}</span>}
                </div>
                <div style={{ fontStyle: 'italic' }}>“{c.quote}”</div>
                {c.suggestion && <div className="small">{c.suggestion}</div>}
                <div className="row">
                  {!c.resolved && r?.inStarter && (
                    <button type="button" className="btn btn-sm" onClick={() => leaveOutOfStarter(c)}>
                      Leave it out of the starter
                    </button>
                  )}
                  {!c.resolved && !r && (c.kind === 'out_of_scope' || c.kind === 'ambiguous') && (
                    <button type="button" className="btn btn-sm" onClick={() => addAsItem(c)}>
                      Add as a work item
                    </button>
                  )}
                  <button type="button" className="btn-link" onClick={() => void resolve(c, !c.resolved)}>
                    {c.resolved ? 'Reopen' : 'Mark handled'}
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Make your call →
        </button>
      </div>
    </section>
  );
}
