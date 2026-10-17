'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { DealSummary } from '@/lib/types';
import { CHOICE_LABEL, ErrorNote, StagePill } from './ui';

export function DealList() {
  const [deals, setDeals] = useState<DealSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ deals: DealSummary[] }>('/api/deals')
      .then((r) => setDeals(r.deals))
      .catch((err) => setError(errorText(err)));
  }, []);

  return (
    <section className="stack" aria-labelledby="deal-files">
      <h2 id="deal-files" className="h-section">
        Your deals
      </h2>
      {deals === null && !error && <p className="muted small">Loading…</p>}
      <ErrorNote message={error} />
      {deals?.length === 0 && <p className="muted">Nothing here yet. Try the sample deal to see how it works, or paste a real brief.</p>}
      {deals && deals.length > 0 && (
        <div className="deal-list">
          {deals.map((d) => (
            <Link key={d.id} className="deal-row" href={`/deal/${d.id}`}>
              <span className="deal-title">{d.title}</span>
              <span>{d.decision ? <span className={`pill ${d.decision}`}>{CHOICE_LABEL[d.decision]}</span> : <StagePill stage={d.stage} />}</span>
              <span className="small muted num">{d.offeredPrice ? `${formatMoney(d.offeredPrice, d.currency)} offered` : 'No price yet'}</span>
              <span className="small muted">{formatDate(d.updatedAt)}</span>
            </Link>
          ))}
        </div>
      )}
      <p className="small muted">Your deals stay private to this browser. Use them on another device from Memory &amp; library.</p>
    </section>
  );
}
