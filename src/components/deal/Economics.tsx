'use client';

import { useState } from 'react';
import { dealPackages, growthScenario, isPriced } from '@/lib/economics';
import { CURRENCY_SYMBOL, formatHours, formatMoney, formatRate } from '@/lib/format';
import { CURRENCIES, type Assumptions, type Currency, type Deal } from '@/lib/types';
import { Figure } from '../ui';
import type { Edit } from './useDeal';

interface Props {
  deal: Deal;
  edit: Edit;
  onNext: () => void;
}

const FIELDS: { key: keyof Assumptions; label: string; unit: string; step: number; max: number; hint: string }[] = [
  { key: 'minimumRate', label: 'Your minimum rate', unit: '/h', step: 50, max: 1e6, hint: 'The least an hour of your time is worth.' },
  { key: 'revisionRounds', label: 'Revision rounds', unit: '×', step: 1, max: 20, hint: 'Included in the full scope.' },
  { key: 'hoursPerRound', label: 'Hours per round', unit: 'h', step: 0.5, max: 200, hint: 'One round of client changes.' },
  { key: 'commsHours', label: 'Calls and messages', unit: 'h', step: 0.5, max: 200, hint: 'Time spent talking, not building.' },
  { key: 'contingencyPct', label: 'Buffer', unit: '%', step: 1, max: 200, hint: 'Added to the floor for the full-scope price.' },
  { key: 'updateHoursPerMonth', label: 'Updates per month', unit: 'h', step: 0.5, max: 200, hint: 'Used by the scope-growth scenario.' },
];

export function Economics({ deal, edit, onNext }: Props) {
  const [extraRounds, setExtraRounds] = useState(2);
  const [extraMonths, setExtraMonths] = useState(2);
  const a = deal.assumptions;
  const c = deal.currency;
  const p = dealPackages(deal);
  const full = p.full;
  const growth = growthScenario({
    price: deal.offeredPrice,
    baseHours: full.totalHours.value,
    extraRounds,
    extraMonths,
    assumptions: a,
    currency: c,
  });
  const priced = deal.requirements.filter(isPriced);
  const inferred = deal.requirements.filter((r) => r.status === 'inferred');

  const setAssumption = (key: keyof Assumptions, raw: string) =>
    edit((d) => {
      const field = FIELDS.find((f) => f.key === key);
      const v = Math.min(field?.max ?? 1e6, Math.max(0, Number(raw) || 0));
      d.assumptions[key] = key === 'revisionRounds' ? Math.round(v) : v;
    });

  const rateTone = full.meetsFloor == null ? undefined : full.meetsFloor ? 'good' : 'bad';
  const max = Math.max(full.effectiveRate.value ?? 0, growth.rate.value ?? 0, a.minimumRate) * 1.15 || 1;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="figures">
        <Figure label="Hours it’ll really take" value={formatHours(full.totalHours.value)} formula={full.totalHours.formula} />
        <Figure
          label="What you’d earn per hour"
          value={full.effectiveRate.value != null ? formatRate(full.effectiveRate.value, c) : '—'}
          formula={full.effectiveRate.formula}
          tone={rateTone}
        />
        <Figure label="Your minimum price" value={formatMoney(full.floorPrice.value, c)} formula={full.floorPrice.formula} />
        <Figure
          label={full.gapToFloor.value != null && full.gapToFloor.value <= 0 ? 'Above your minimum by' : 'Short of your minimum by'}
          value={full.gapToFloor.value != null ? formatMoney(Math.abs(full.gapToFloor.value), c) : '—'}
          formula={full.gapToFloor.formula}
          tone={full.gapToFloor.value == null ? undefined : full.gapToFloor.value <= 0 ? 'good' : 'bad'}
        />
      </div>

      {p.inferredCount > 0 && (
        <div className="callout warn small">
          Not counted yet: {inferred.map((r) => r.title).join(', ')}. Nobody asked for {p.inferredCount === 1 ? 'it' : 'them'}, so confirm in “The
          work” if {p.inferredCount === 1 ? 'it’s' : 'they’re'} part of the job.
        </div>
      )}

      <section className="card stack" aria-labelledby="inputs-head">
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <h2 id="inputs-head" className="h-section" style={{ fontSize: 24 }}>
            Your numbers
          </h2>
          <span className="small muted">Change anything and the numbers above update instantly. Plain maths, no guessing.</span>
        </div>
        <div className="assumptions">
          <div className="field">
            <span id="offer-econ">Client’s offer</span>
            <div className="input-group" role="group" aria-labelledby="offer-econ">
              <select
                className="select"
                aria-label="Currency"
                value={c}
                onChange={(e) =>
                  edit((d) => {
                    d.currency = e.target.value as Currency;
                  })
                }
              >
                {CURRENCIES.map((x) => (
                  <option key={x} value={x}>
                    {CURRENCY_SYMBOL[x]}
                  </option>
                ))}
              </select>
              <input
                className="input input-num"
                aria-label="Offered amount"
                type="number"
                min={0}
                step={500}
                value={deal.offeredPrice ?? ''}
                placeholder="Not stated"
                onChange={(e) =>
                  edit((d) => {
                    const v = Number(e.target.value);
                    d.offeredPrice = e.target.value === '' || !(v > 0) ? null : Math.round(v);
                  })
                }
              />
            </div>
            <small>{deal.priceEvidence ? `Client said “${deal.priceEvidence.quote}”` : 'Typed by you'}</small>
          </div>
          {FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <span className="suffix" data-suffix={f.key === 'minimumRate' ? `${CURRENCY_SYMBOL[c]}/h` : f.unit}>
                <input
                  className="input input-num"
                  type="number"
                  min={0}
                  max={f.max}
                  step={f.step}
                  value={a[f.key]}
                  onChange={(e) => setAssumption(f.key, e.target.value)}
                  style={{ paddingRight: f.key === 'minimumRate' ? 44 : 28 }}
                />
              </span>
              <small>{f.hint}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="stack" aria-labelledby="hours-head">
        <h2 id="hours-head" className="h-card">
          Hours for each thing
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>What</th>
                <th>They said</th>
                <th className="r">Hours</th>
              </tr>
            </thead>
            <tbody>
              {priced.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.title}
                    {r.hoursSource === 'suggested' && (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        Panga’s guess
                      </span>
                    )}
                  </td>
                  <td className="small muted">{r.evidence[0] ? `“${r.evidence[0].quote}”` : 'Added by you'}</td>
                  <td className="r">
                    <input
                      className="input input-num"
                      aria-label={`Hours for ${r.title}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={r.hours}
                      style={{ width: 90, textAlign: 'right' }}
                      onChange={(e) =>
                        edit((d) => {
                          const x = d.requirements.find((y) => y.id === r.id);
                          if (!x) return;
                          const v = Math.min(2000, Math.max(0, Number(e.target.value) || 0));
                          if (x.starterHours === x.hours) x.starterHours = v;
                          x.hours = v;
                          x.hoursSource = 'freelancer';
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="small muted">
                  {a.revisionRounds} revision {a.revisionRounds === 1 ? 'round' : 'rounds'} × {formatHours(a.hoursPerRound)}
                  {a.commsHours > 0 ? ` + ${formatHours(a.commsHours)} of calls and messages` : ''}
                </td>
                <td className="r num">{formatHours(full.revisionHours + a.commsHours)}</td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <b>Total</b>
                </td>
                <td className="r num">
                  <b>{formatHours(full.totalHours.value)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack" aria-labelledby="growth-head">
        <h2 id="growth-head" className="h-section" style={{ fontSize: 24 }}>
          What if “small changes” never stop?
        </h2>
        <div className="grid-2">
          <label className="field">
            <span>
              Extra revision rounds: <b className="num">{extraRounds}</b>
            </span>
            <input className="range" type="range" min={0} max={6} value={extraRounds} onChange={(e) => setExtraRounds(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>
              Months of “small changes later”: <b className="num">{extraMonths}</b>
            </span>
            <input className="range" type="range" min={0} max={12} value={extraMonths} onChange={(e) => setExtraMonths(Number(e.target.value))} />
          </label>
        </div>
        <p className="small muted num" style={{ margin: 0 }}>
          {growth.hours.formula}
        </p>
        <div
          className="bars"
          role="img"
          aria-label={`Rate now ${full.effectiveRate.value ?? 'unknown'}, if scope grows ${growth.rate.value ?? 'unknown'}, minimum ${a.minimumRate}`}
        >
          <BarRow label="As quoted" value={full.effectiveRate.value} floor={a.minimumRate} currency={c} pct={pct} />
          <BarRow label="If scope grows" value={growth.rate.value} floor={a.minimumRate} currency={c} pct={pct} />
          <BarRow label="Your minimum" value={a.minimumRate} floor={a.minimumRate} currency={c} pct={pct} neutral />
        </div>
        {growth.rate.value != null && (
          <p style={{ margin: 0 }}>
            Then this deal pays just <b className="num">{formatRate(growth.rate.value, c)}</b>. That’s why limits go in writing.
          </p>
        )}
      </section>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Now practise the call →
        </button>
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  floor,
  currency,
  pct,
  neutral,
}: {
  label: string;
  value: number | null;
  floor: number;
  currency: Currency;
  pct: (v: number) => string;
  neutral?: boolean;
}) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <span className="bar-track">
        {value != null && (
          <span
            className={`bar-fill ${neutral || value >= floor ? 'good' : ''}`}
            style={{ width: pct(value), background: neutral ? 'var(--ink)' : undefined }}
          />
        )}
        <span className="bar-floor" style={{ left: pct(floor) }} aria-hidden="true" />
      </span>
      <span className="num">{value != null ? formatRate(value, currency) : '—'}</span>
    </div>
  );
}
