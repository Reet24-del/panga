'use client';

import { useEffect, useRef, useState } from 'react';
import { errorText } from '@/lib/client/api';
import { autoFitStarter, dealPackages, isPriced } from '@/lib/economics';
import { formatDate, formatHours, formatMoney, formatRate } from '@/lib/format';
import { unknownAmounts } from '@/lib/reply-check';
import type { Choice, Deal, Integrations, Tone } from '@/lib/types';
import { CHOICE_LABEL, ErrorNote, Stamp } from '../ui';
import type { Act, Edit } from './useDeal';

const TONES: { key: Tone; label: string }[] = [
  { key: 'english_friendly', label: 'English, friendly' },
  { key: 'english_formal', label: 'English, formal' },
  { key: 'hinglish_friendly', label: 'Hinglish, friendly' },
];

interface Props {
  deal: Deal;
  edit: Edit;
  act: Act;
  defaultTone: Tone;
  features: Integrations | null;
}

export function Decision({ deal, edit, act, defaultTone, features }: Props) {
  const p = dealPackages(deal);
  const c = deal.currency;
  const a = deal.assumptions;
  const rec = p.recommendation;
  const approved = Boolean(deal.decision?.approvedAt);
  const [choice, setChoice] = useState<Choice>(deal.decision?.choice ?? rec.choice ?? 'change');
  const [tone, setTone] = useState<Tone>(deal.decision?.tone ?? defaultTone);
  const [reply, setReply] = useState(deal.decision?.reply ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const replyBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!deal.decision) setTone(defaultTone);
  }, [defaultTone, deal.decision]);

  useEffect(() => {
    if (deal.decision?.reply) setReply(deal.decision.reply);
  }, [deal.decision?.draftedAt, deal.decision?.reply]);

  const takePrice = deal.offeredPrice && p.full.meetsFloor ? deal.offeredPrice : p.fullPrice.value;
  const takeRate = takePrice === deal.offeredPrice ? p.full.effectiveRate : p.fullAtPrice.effectiveRate;
  const allowed = [deal.offeredPrice ?? 0, takePrice, p.fullPrice.value].filter((n) => n > 0);
  const unknown = reply ? unknownAmounts(reply, allowed) : [];
  const priced = deal.requirements.filter(isPriced);
  const draftedFor = deal.decision?.choice;

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

  const draft = () =>
    run('draft', async () => {
      const r = await act<{ deal: Deal }>(`/api/deals/${deal.id}/reply`, { choice, tone });
      setReply(r.deal.decision?.reply ?? '');
    });

  const approve = () => run('approve', () => act(`/api/deals/${deal.id}/approve`, { reply }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      replyBox.current?.select();
    }
  }

  function setStarter(id: string, on: boolean) {
    edit((d) => {
      const r = d.requirements.find((x) => x.id === id);
      if (r) r.inStarter = on;
    });
  }

  function fitToBudget() {
    const ids = autoFitStarter(deal.requirements, deal.offeredPrice, a);
    edit((d) => {
      for (const r of d.requirements) r.inStarter = ids.has(r.id);
    });
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      {rec.choice ? (
        <div className={`callout ${rec.choice}`}>
          <span className="label">Panga’s take, from the numbers alone</span>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{rec.headline}</div>
          <div>{rec.reason}</div>
        </div>
      ) : (
        <div className="callout warn">{rec.reason}</div>
      )}

      <div className="options">
        <div className={`option change ${choice === 'change' ? 'selected' : ''}`}>
          <div className="option-top">Change the deal</div>
          <h3 className="h-card">A smaller package that fits their budget</h3>
          <div className="price">{deal.offeredPrice ? formatMoney(deal.offeredPrice, c) : 'No budget'}</div>
          <div className="row small num">
            <span>
              {formatHours(p.starter.totalHours.value)}
              {p.starter.effectiveRate.value != null ? ` · ${formatRate(p.starter.effectiveRate.value, c)}` : ''}
            </span>
            {p.starter.meetsFloor != null && (
              <span className={`pill ${p.starter.meetsFloor ? 'take' : 'walk'}`}>
                {p.starter.meetsFloor ? 'Above your minimum' : 'Below your minimum'}
              </span>
            )}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {priced.map((r) => (
              <div className="check-item" key={r.id}>
                <input
                  type="checkbox"
                  id={`starter-${r.id}`}
                  checked={r.inStarter}
                  onChange={(e) => setStarter(r.id, e.target.checked)}
                  disabled={approved}
                />
                <label htmlFor={`starter-${r.id}`}>{r.title}</label>
                <span className="suffix" data-suffix="h">
                  <input
                    className="input input-num"
                    type="number"
                    min={0}
                    step={0.5}
                    aria-label={`Starter hours for ${r.title}`}
                    value={r.starterHours}
                    disabled={!r.inStarter || approved}
                    onChange={(e) =>
                      edit((d) => {
                        const x = d.requirements.find((y) => y.id === r.id);
                        if (x) x.starterHours = Math.min(2000, Math.max(0, Number(e.target.value) || 0));
                      })
                    }
                  />
                </span>
              </div>
            ))}
          </div>
          <label className="field">
            <span className="small">Revision rounds in this package</span>
            <input
              className="input input-num"
              type="number"
              min={0}
              max={20}
              value={a.starterRevisionRounds}
              disabled={approved}
              onChange={(e) =>
                edit((d) => {
                  d.assumptions.starterRevisionRounds = Math.min(20, Math.max(0, Math.round(Number(e.target.value) || 0)));
                })
              }
              style={{ width: 90 }}
            />
          </label>
          <details className="how">
            <summary>How?</summary>
            <p>{p.starter.totalHours.formula}</p>
          </details>
          {!approved && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={fitToBudget}
              disabled={!deal.offeredPrice}
              style={{ justifySelf: 'start' }}
            >
              Fit it to their budget
            </button>
          )}
        </div>

        <div className={`option take ${choice === 'take' ? 'selected' : ''}`}>
          <div className="option-top">Take it{takePrice !== deal.offeredPrice ? ', at your price' : ''}</div>
          <h3 className="h-card">Everything they asked for</h3>
          <div className="price">{formatMoney(takePrice, c)}</div>
          <div className="small num">
            {formatHours(p.full.totalHours.value)}
            {takeRate.value != null ? ` · ${formatRate(takeRate.value, c)}` : ''}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {priced.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
          <span className="small muted">
            {takePrice === deal.offeredPrice ? 'Their offer already covers your minimum.' : `Your minimum plus a ${a.contingencyPct}% safety buffer.`}{' '}
            Includes {a.revisionRounds} rounds of changes.
          </span>
        </div>

        <div className={`option walk ${choice === 'walk' ? 'selected' : ''}`}>
          <div className="option-top">Walk away</div>
          <h3 className="h-card">A polite no, thanks</h3>
          <p className="small" style={{ margin: 0 }}>
            Thank the client, say the budget doesn’t cover what they described, and leave the door open for something smaller later. No price in the
            message.
          </p>
        </div>
      </div>

      {!approved && (
        <div className="actions-row" role="group" aria-label="Your decision">
          {(['take', 'change', 'walk'] as Choice[]).map((x) => (
            <button key={x} type="button" className={`action-stamp ${x}`} aria-pressed={choice === x} onClick={() => setChoice(x)}>
              {CHOICE_LABEL[x]}
            </button>
          ))}
        </div>
      )}

      <section className="card stack" aria-labelledby="reply-head">
        <h2 id="reply-head" className="h-section" style={{ fontSize: 24 }}>
          Your reply
        </h2>
        {!approved && (
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ minWidth: 220 }}>
              <span>Tone</span>
              <select className="select" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                {TONES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={draft} disabled={busy !== null}>
              {busy === 'draft' ? 'Writing…' : deal.decision ? `Rewrite it (${CHOICE_LABEL[choice]})` : `Write my reply (${CHOICE_LABEL[choice]})`}
            </button>
          </div>
        )}
        <ErrorNote message={error} onDismiss={() => setError(null)} />
        {draftedFor && draftedFor !== choice && !approved && (
          <div className="callout warn small">
            This reply was written for “{CHOICE_LABEL[draftedFor]}”. Rewrite it for “{CHOICE_LABEL[choice]}”.
          </div>
        )}
        {deal.decision && (
          <>
            <label className="field">
              <span>Your reply · {CHOICE_LABEL[deal.decision.choice]}</span>
              <textarea
                ref={replyBox}
                className="textarea reply-box"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                readOnly={approved}
                maxLength={4000}
              />
            </label>
            {unknown.length > 0 ? (
              <div className="callout warn small">
                This mentions {unknown.map((u) => u.raw).join(', ')}, which Panga didn’t work out. Double-check {unknown.length === 1 ? 'it' : 'them'}{' '}
                before you send.
              </div>
            ) : (
              reply.trim() && (
                <p className="small muted" style={{ margin: 0 }}>
                  Every price in this reply matches Panga’s numbers.
                </p>
              )
            )}
            <div className="row">
              <button type="button" className="btn" onClick={copy} disabled={!reply.trim()}>
                {copied ? 'Copied' : 'Copy reply'}
              </button>
              {!approved && (
                <button type="button" className="btn btn-primary" onClick={approve} disabled={busy !== null || !reply.trim()}>
                  {busy === 'approve' ? 'Saving…' : 'Approve this reply'}
                </button>
              )}
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Panga never sends anything. Paste it into WhatsApp or email yourself.
            </p>
          </>
        )}
      </section>

      {approved && deal.decision && (
        <section className="card card-ink stack">
          <div className="approved">
            <Stamp choice={deal.decision.choice} className="tilt" />
            <span>
              Approved {formatDate(deal.decision.approvedAt!)}.{' '}
              {deal.decision.choice === 'walk'
                ? 'Good call: a clear no now is cheaper than a bad yes later.'
                : deal.workflowId
                  ? 'Panga’s workflow will ask how the project went in two weeks.'
                  : 'Come back after the project to record how it went.'}
            </span>
          </div>
          {deal.decision.choice !== 'walk' && <Outcome deal={deal} act={act} features={features} />}
        </section>
      )}
    </div>
  );
}

function Outcome({ deal, act, features }: { deal: Deal; act: Act; features: Integrations | null }) {
  const p = dealPackages(deal);
  const [pkg, setPkg] = useState<'starter' | 'full'>(deal.outcome?.package ?? (deal.decision?.choice === 'change' ? 'starter' : 'full'));
  const [hours, setHours] = useState(deal.outcome ? String(deal.outcome.actualHours) : '');
  const [lesson, setLesson] = useState(deal.outcome?.lesson ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimate = (pkg === 'starter' ? p.starter : p.full).totalHours.value;

  async function save() {
    const actual = Number(hours);
    if (!(actual >= 0) || hours.trim() === '') {
      setError('Enter the hours the project actually took.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await act(`/api/deals/${deal.id}/outcome`, { package: pkg, actualHours: actual, lesson });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {deal.outcomeRequestedAt && !deal.outcome && <div className="callout change">It’s been two weeks. How did this project go?</div>}
      <h3 className="h-card">How did it go?</h3>
      <div className="grid-2">
        <label className="field">
          <span>The client chose</span>
          <select className="select" value={pkg} onChange={(e) => setPkg(e.target.value as 'starter' | 'full')}>
            <option value="starter">The smaller package (A)</option>
            <option value="full">The full scope (B)</option>
          </select>
        </label>
        <label className="field">
          <span>Hours it actually took</span>
          <input
            className="input input-num"
            type="number"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder={`You estimated ${formatHours(estimate)}`}
          />
        </label>
      </div>
      <label className="field">
        <span>One lesson for next time</span>
        <textarea
          className="textarea"
          rows={3}
          value={lesson}
          maxLength={600}
          onChange={(e) => setLesson(e.target.value)}
          placeholder="e.g. Product photos needed cropping; migration took twice as long."
        />
      </label>
      <ErrorNote message={error} onDismiss={() => setError(null)} />
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : deal.outcome ? 'Update it' : 'Save to my past projects'}
        </button>
        {deal.outcome && (
          <span className="small muted">
            Saved {formatDate(deal.outcome.recordedAt)}: estimated {formatHours(estimate)}, actual {formatHours(deal.outcome.actualHours)}. Similar
            briefs will show this{features?.database === 'tiger' ? ' (stored in Tiger Data)' : ''}.
          </span>
        )}
      </div>
    </div>
  );
}
