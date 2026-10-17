'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { dealPackages } from '@/lib/economics';
import { formatDate, formatMoney, formatRate } from '@/lib/format';
import type { Deal, Integrations, Preferences, Tone } from '@/lib/types';
import { CHOICE_LABEL, ErrorNote } from '../ui';
import { Decision } from './Decision';
import { Dossier } from './Dossier';
import { Economics } from './Economics';
import { Rehearsal } from './Rehearsal';
import { useDeal, type Act, type SaveState } from './useDeal';

type Step = 'dossier' | 'economics' | 'rehearse' | 'decide';

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Saving soon',
  error: 'Not saved',
};

export function DealRoom({ id }: { id: string }) {
  const { deal, loadError, saveState, saveError, edit, act } = useDeal(id);
  const [step, setStep] = useState<Step>('dossier');
  const [features, setFeatures] = useState<Integrations | null>(null);
  const [tone, setTone] = useState<Tone>('english_friendly');
  const chosenStep = useRef(false);

  useEffect(() => {
    api<{ integrations: Integrations }>('/api/health')
      .then((r) => setFeatures(r.integrations))
      .catch(() => undefined);
    api<{ preferences: Preferences }>('/api/preferences')
      .then((r) => setTone(r.preferences.tone))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (deal && !chosenStep.current && deal.stage !== 'analyzing') {
      chosenStep.current = true;
      if (deal.decision?.approvedAt) setStep('decide');
    }
  }, [deal]);

  if (loadError) {
    return (
      <div className="stack">
        <ErrorNote message={loadError} />
        <Link href="/">Back to your deal files</Link>
      </div>
    );
  }
  if (!deal) return <p className="muted">Opening the deal file…</p>;

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <DealHeader deal={deal} saveState={saveState} edit={edit} />
      <ErrorNote message={saveState === 'error' ? `Your last change wasn’t saved: ${saveError}` : null} />
      {deal.stage === 'analyzing' && <Reading />}
      {deal.stage === 'analysis_failed' && <Failed deal={deal} act={act} />}
      {deal.stage !== 'analyzing' && deal.stage !== 'analysis_failed' && (
        <>
          <Steps deal={deal} step={step} onSelect={go} />
          <section className="panel" role="tabpanel" aria-label="Current step">
            {step === 'dossier' && <Dossier deal={deal} edit={edit} act={act} features={features} onNext={() => go('economics')} />}
            {step === 'economics' && <Economics deal={deal} edit={edit} onNext={() => go('rehearse')} />}
            {step === 'rehearse' && <Rehearsal deal={deal} edit={edit} act={act} features={features} onNext={() => go('decide')} />}
            {step === 'decide' && <Decision deal={deal} edit={edit} act={act} defaultTone={tone} features={features} />}
          </section>
        </>
      )}
    </div>
  );
}

function DealHeader({ deal, saveState, edit }: { deal: Deal; saveState: SaveState; edit: (m: (d: Deal) => void) => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    try {
      await api(`/api/deals/${deal.id}`, { method: 'DELETE' });
      router.push('/');
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <header className="deal-head">
      <span className="label">Started {formatDate(deal.createdAt)}</span>
      <input
        className="title-input"
        aria-label="Deal name"
        value={deal.title}
        maxLength={120}
        onChange={(e) =>
          edit((d) => {
            d.title = e.target.value;
          })
        }
      />
      <div className="meta">
        <span className="chip" title={deal.priceEvidence ? `They said: “${deal.priceEvidence.quote}”` : undefined}>
          They’re offering <b className="num">{deal.offeredPrice ? formatMoney(deal.offeredPrice, deal.currency) : 'nothing yet'}</b>
        </span>
        {deal.workflowId && <span className="chip">Follow-up booked</span>}
        <span className="chip" aria-live="polite">
          {SAVE_LABEL[saveState]}
        </span>
        {confirming ? (
          <span className="row">
            <span>Delete this deal and everything saved with it?</span>
            <button type="button" className="btn btn-sm" style={{ background: 'var(--walk)', color: '#1b1530' }} onClick={remove}>
              Yes, delete
            </button>
            <button type="button" className="btn-link" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" className="btn-link" onClick={() => setConfirming(true)}>
            Delete deal
          </button>
        )}
      </div>
      <ErrorNote message={error} />
    </header>
  );
}

function Steps({ deal, step, onSelect }: { deal: Deal; step: Step; onSelect: (s: Step) => void }) {
  const p = dealPackages(deal);
  const live = deal.requirements.filter((r) => r.status !== 'removed');
  const hidden = live.filter((r) => r.hidden).length;
  const steps: { key: Step; num: string; name: string; sub: string }[] = [
    { key: 'dossier', num: '01', name: 'The work', sub: `${live.length} things · ${hidden} sneaky` },
    {
      key: 'economics',
      num: '02',
      name: 'The money',
      sub: p.full.effectiveRate.value != null ? `Pays ${formatRate(p.full.effectiveRate.value, deal.currency)}` : 'Add a price',
    },
    {
      key: 'rehearse',
      num: '03',
      name: 'Client from hell',
      sub: deal.rehearsals.length ? `${deal.rehearsals.length} practice ${deal.rehearsals.length === 1 ? 'call' : 'calls'}` : 'Practise the call',
    },
    {
      key: 'decide',
      num: '04',
      name: 'Your call',
      sub: deal.decision?.approvedAt ? CHOICE_LABEL[deal.decision.choice] : p.recommendation.headline,
    },
  ];
  return (
    <div className="steps" role="tablist" aria-label="Deal steps">
      {steps.map((s) => (
        <button key={s.key} type="button" role="tab" aria-selected={step === s.key} onClick={() => onSelect(s.key)}>
          <span className="step-num">{s.num}</span>
          <span className="step-name">{s.name}</span>
          <span className="step-sub">{s.sub}</span>
        </button>
      ))}
    </div>
  );
}

const READING_LINES = [
  'Reading the brief and the chat',
  'Hunting for sneaky extra work',
  'Checking every quote against their actual words',
  'Looking for similar jobs you’ve done',
];

function Reading() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const shown = Math.min(READING_LINES.length, 1 + Math.floor(seconds / 4));
  return (
    <div className="reading" aria-live="polite">
      <h2 className="h-section">Reading your deal… {seconds}s</h2>
      {READING_LINES.slice(0, shown).map((line, i) => (
        <div key={line} className="reading-line">
          {i === shown - 1 ? <span className="dot" /> : <span className="done-mark" aria-hidden="true" />}
          {line}
        </div>
      ))}
      <span className="small muted">Usually under a minute. You can leave this page, it keeps going.</span>
    </div>
  );
}

function Failed({ deal, act }: { deal: Deal; act: Act }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      <div className="error">Panga couldn’t read this deal: {deal.error ?? 'unknown error'}</div>
      <ErrorNote message={error} />
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await act(`/api/deals/${deal.id}/reanalyze`);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Starting…' : 'Try again'}
        </button>
        <Link href="/">Back to your deal files</Link>
      </div>
    </div>
  );
}
