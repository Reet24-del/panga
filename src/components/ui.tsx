// Small shared pieces of the deal room.

import type { Choice, DealStage } from '@/lib/types';

export const CHOICE_LABEL: Record<Choice, string> = { take: 'Take it', change: 'Change the deal', walk: 'Walk away' };

export function Stamp({ choice, className = '' }: { choice: Choice; className?: string }) {
  return <span className={`stamp ${choice} ${className}`}>{CHOICE_LABEL[choice]}</span>;
}

const STAGE: Record<DealStage, { label: string; tone: string }> = {
  analyzing: { label: 'Reading…', tone: 'accent' },
  analysis_failed: { label: 'Needs a look', tone: 'walk' },
  review: { label: 'In progress', tone: '' },
  decided: { label: 'Decided', tone: 'take' },
  closed: { label: 'Done', tone: '' },
};

export function StagePill({ stage }: { stage: DealStage }) {
  const s = STAGE[stage];
  return <span className={`pill ${s.tone}`}>{s.label}</span>;
}

export function ErrorNote({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div className="error" role="alert">
      {message}{' '}
      {onDismiss && (
        <button type="button" className="btn-link" onClick={onDismiss}>
          OK
        </button>
      )}
    </div>
  );
}

/** A big number, with the maths behind it one click away. */
export function Figure({ label, value, formula, tone }: { label: string; value: string; formula: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`figure ${tone ?? ''}`}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <details className="how">
        <summary>How?</summary>
        <p>{formula}</p>
      </details>
    </div>
  );
}
