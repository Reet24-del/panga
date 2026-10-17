'use client';

import { useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { findEvidence, segmentText, type Highlight } from '@/lib/evidence';
import { formatDate, formatHours } from '@/lib/format';
import type { Category, Deal, Integrations, QuestionState, Requirement, Research, Source } from '@/lib/types';
import { ErrorNote } from '../ui';
import type { Act, Edit } from './useDeal';

const CATEGORY: Record<Category, string> = {
  design: 'Design',
  build: 'Build',
  content: 'Content',
  integration: 'Integration',
  support: 'Support',
  other: 'Other',
};

const QUESTION_STATES: { key: QuestionState; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'ask_client', label: 'Ask client' },
  { key: 'assumed', label: 'Assume' },
  { key: 'answered', label: 'Answered' },
];

interface Props {
  deal: Deal;
  edit: Edit;
  act: Act;
  features: Integrations | null;
  onNext: () => void;
}

export function Dossier({ deal, edit, act, features, onNext }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const live = deal.requirements.filter((r) => r.status !== 'removed');
  const hidden = live.filter((r) => r.hidden).length;
  const inferred = live.filter((r) => r.status === 'inferred').length;
  const openQuestions = deal.questions.filter((q) => q.state === 'open' || q.state === 'ask_client').length;

  function focus(key: string) {
    setActive(key);
    requestAnimationFrame(() => document.querySelector(`[data-keys~="${key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  function update(id: string, mutate: (r: Requirement) => void) {
    edit((d) => {
      const r = d.requirements.find((x) => x.id === id);
      if (r) mutate(r);
    });
  }

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

  return (
    <div className="dossier">
      <div className="stack">
        <div>
          {deal.summary && <p style={{ fontSize: 17, margin: 0 }}>{deal.summary}</p>}
          <div className="stats">
            <span className="pill accent">{live.length} things to do</span>
            {hidden > 0 && <span className="pill change">{hidden} hidden in the chat</span>}
            {inferred > 0 && <span className="pill">{inferred} nobody asked for</span>}
            <span className="pill">{openQuestions} questions to ask</span>
          </div>
          {deal.analysis && (
            <p className="small muted" style={{ margin: 0 }}>
              Panga checked {deal.analysis.quotesChecked} quotes against their actual words.
              {deal.analysis.quotesRejected > 0
                ? ` ${deal.analysis.quotesRejected} didn’t match, so ${deal.analysis.quotesRejected === 1 ? 'it was' : 'they were'} thrown out.`
                : ' All of them matched.'}
              {deal.analysis.memoriesUsed > 0
                ? ` It also used ${deal.analysis.memoriesUsed} ${deal.analysis.memoriesUsed === 1 ? 'thing' : 'things'} it remembers about how you work.`
                : ''}
            </p>
          )}
        </div>

        <ErrorNote message={error} onDismiss={() => setError(null)} />

        {deal.requirements.map((r) => (
          <RequirementCard
            key={r.id}
            r={r}
            sources={deal.sources}
            active={active}
            onFocus={focus}
            update={update}
            canResearch={Boolean(features?.research)}
            researching={busy === `research:${r.id}`}
            onResearch={() => run(`research:${r.id}`, () => act(`/api/deals/${deal.id}/research`, { requirementId: r.id }))}
          />
        ))}

        <AddRequirement deal={deal} edit={edit} />
        <Questions deal={deal} edit={edit} />
        {deal.similar.length > 0 && <Similar deal={deal} tiger={features?.database === 'tiger'} />}

        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() =>
              run('confirm', async () => {
                await act(`/api/deals/${deal.id}/confirm-scope`);
                onNext();
              })
            }
          >
            {busy === 'confirm' ? 'Saving…' : 'Looks right, show me the money →'}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy !== null || Boolean(deal.decision?.approvedAt)}
            onClick={() => run('reread', () => act(`/api/deals/${deal.id}/reanalyze`))}
          >
            Read it again
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Panga remembers what you changed here (removed items, renames, your hours) and uses it next time.
        </p>
      </div>

      <aside className="sources-panel" aria-label="The client’s material">
        <h3 className="h-card">What they actually said</h3>
        {deal.sources.map((s) => (
          <SourceText key={s.id} source={s} deal={deal} active={active} />
        ))}
      </aside>
    </div>
  );
}

interface CardProps {
  r: Requirement;
  sources: Source[];
  active: string | null;
  onFocus: (key: string) => void;
  update: (id: string, mutate: (r: Requirement) => void) => void;
  canResearch: boolean;
  researching: boolean;
  onResearch: () => void;
}

function RequirementCard({ r, sources, active, onFocus, update, canResearch, researching, onResearch }: CardProps) {
  const label = new Map(sources.map((s) => [s.id, s.label]));
  const removed = r.status === 'removed';
  return (
    <article className={`req ${r.status}`} aria-label={r.title}>
      <div className="req-top">
        <span className="badge-num">{r.id.slice(1)}</span>
        <input
          className="req-title-input"
          aria-label={`Name of ${r.id}`}
          value={r.title}
          maxLength={80}
          disabled={removed}
          onChange={(e) => update(r.id, (x) => void (x.title = e.target.value))}
        />
        <span className="pill">{CATEGORY[r.category]}</span>
        {r.hidden && <span className="pill change">Hidden in the chat</span>}
        {r.status === 'inferred' && <span className="pill">Nobody asked · not priced</span>}
        {r.status === 'confirmed' && r.confirmedWithoutQuote && <span className="pill accent">Added by you</span>}
        {removed && <span className="pill walk">Removed</span>}
      </div>
      {r.detail && <p className="req-detail">{r.detail}</p>}
      {r.evidence.map((e, i) => {
        const key = `${r.id}:${i}`;
        return (
          <button key={key} type="button" className={`quote ${active === key ? 'active' : ''}`} onClick={() => onFocus(key)}>
            “{e.quote}”<cite>{label.get(e.sourceId) ?? e.sourceId}</cite>
          </button>
        );
      })}
      <div className="req-foot">
        <div className="hours">
          <label className="suffix" data-suffix="h">
            <span className="sr-only">Hours for {r.title}</span>
            <input
              className="input input-num"
              type="number"
              min={0}
              max={2000}
              step={0.5}
              value={Number.isFinite(r.hours) ? r.hours : 0}
              disabled={removed}
              onChange={(e) =>
                update(r.id, (x) => {
                  const v = Math.min(2000, Math.max(0, Number(e.target.value) || 0));
                  const synced = x.starterHours === x.hours;
                  x.hours = v;
                  x.hoursSource = 'freelancer';
                  if (synced) x.starterHours = v;
                })
              }
            />
          </label>
          <span className="small muted">
            {r.hoursSource === 'suggested'
              ? 'Panga’s guess. Tweak it!'
              : r.suggestedHours != null && r.suggestedHours !== r.hours
                ? `Your estimate (Panga guessed ${formatHours(r.suggestedHours)})`
                : 'Your estimate'}
          </span>
        </div>
        <div className="row">
          {canResearch && !removed && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={onResearch} disabled={researching}>
              {researching ? 'Searching…' : r.research ? 'Search again' : 'What’s involved?'}
            </button>
          )}
          {r.status === 'inferred' && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                update(r.id, (x) => {
                  x.confirmedWithoutQuote = true;
                  x.status = 'confirmed';
                })
              }
            >
              Yes, it’s part of the job
            </button>
          )}
          {removed ? (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => update(r.id, (x) => void (x.status = x.evidence.length || x.confirmedWithoutQuote ? 'confirmed' : 'inferred'))}
            >
              Bring it back
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() =>
                update(r.id, (x) => {
                  x.status = 'removed';
                  x.inStarter = false;
                })
              }
            >
              Not doing this
            </button>
          )}
        </div>
      </div>
      {r.research && <ResearchNote research={r.research} />}
    </article>
  );
}

function ResearchNote({ research }: { research: Research }) {
  return (
    <div className="research">
      <span className="label">From the web · {formatDate(research.at)}</span>
      <p style={{ margin: '4px 0' }}>{research.summary}</p>
      {research.sources.length > 0 && (
        <ol>
          {research.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SourceText({ source, deal, active }: { source: Source; deal: Deal; active: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const highlights: Highlight[] = [];
  for (const r of deal.requirements) {
    if (r.status === 'removed') continue;
    r.evidence.forEach((e, i) => {
      if (e.sourceId === source.id) highlights.push({ start: e.start, end: e.end, key: `${r.id}:${i}` });
    });
  }
  if (deal.priceEvidence?.sourceId === source.id) highlights.push({ start: deal.priceEvidence.start, end: deal.priceEvidence.end, key: 'price' });
  const segments = segmentText(source.text, highlights);

  async function openOriginal(key: string) {
    const win = window.open('about:blank', '_blank');
    try {
      const r = await api<{ url: string }>(`/api/files?key=${encodeURIComponent(key)}`);
      if (win) win.location.href = r.url;
      else window.location.href = r.url;
    } catch (err) {
      win?.close();
      setError(errorText(err));
    }
  }

  return (
    <div className="source">
      <div className="source-head">
        <span className="label">{source.label}</span>
        {source.file && (
          <button type="button" className="btn-link" onClick={() => openOriginal(source.file!.key)}>
            Open original
          </button>
        )}
      </div>
      <ErrorNote message={error} />
      <p className="source-text">
        {segments.map((seg, i) =>
          seg.keys.length ? (
            <mark key={i} data-keys={seg.keys.join(' ')} className={active && seg.keys.includes(active) ? 'active' : ''}>
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
    </div>
  );
}

function AddRequirement({ deal, edit }: { deal: Deal; edit: Edit }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('2');
  const [quote, setQuote] = useState('');
  const evidence = quote.trim() ? findEvidence(deal.sources, { text: quote }) : null;

  if (!open) {
    return (
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)} style={{ justifySelf: 'start' }}>
        ＋ Add something Panga missed
      </button>
    );
  }

  function add() {
    const name = title.trim();
    if (!name) return;
    const next = Math.max(0, ...deal.requirements.map((r) => Number(r.id.slice(1)) || 0)) + 1;
    const h = Math.min(2000, Math.max(0, Number(hours) || 0));
    edit((d) => {
      d.requirements.push({
        id: `R${next}`,
        title: name.slice(0, 80),
        detail: '',
        category: 'other',
        hidden: false,
        evidence: evidence ? [evidence] : [],
        status: 'confirmed',
        confirmedWithoutQuote: !evidence,
        hours: h,
        hoursSource: 'freelancer',
        suggestedHours: null,
        inStarter: false,
        starterHours: h,
        research: null,
        addedBy: 'freelancer',
      });
    });
    setTitle('');
    setHours('2');
    setQuote('');
    setOpen(false);
  }

  return (
    <div className="card stack">
      <span className="h-card">＋ Add something Panga missed</span>
      <div className="grid-2">
        <label className="field">
          <span>What is the work?</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Size chart page" />
        </label>
        <label className="field">
          <span>Hours</span>
          <input className="input input-num" type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>The client’s exact words (optional)</span>
        <input className="input" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Copy a phrase from the brief or messages" />
        <small>
          {quote.trim()
            ? evidence
              ? `Found in ${evidence.sourceId}. It will be linked as evidence.`
              : 'Not found in the client’s words. The item will be saved as confirmed by you.'
            : 'Without a quote, the item is marked as confirmed by you.'}
        </small>
      </label>
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!title.trim()}>
          Add item
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Questions({ deal, edit }: { deal: Deal; edit: Edit }) {
  if (!deal.questions.length) return null;
  return (
    <section className="stack" aria-labelledby="questions-head" style={{ gap: 0 }}>
      <h3 id="questions-head" className="h-card" style={{ marginBottom: 4 }}>
        Ask these before you quote
      </h3>
      {deal.questions.map((q) => {
        const about = deal.requirements.find((r) => r.id === q.requirementId);
        return (
          <div className="question" key={q.id}>
            <div>
              {q.text}
              {about && <span className="small muted"> · about {about.title.toLowerCase()}</span>}
            </div>
            <div className="seg" role="group" aria-label={`Status of question ${q.id}`}>
              {QUESTION_STATES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={q.state === s.key}
                  onClick={() =>
                    edit((d) => {
                      const x = d.questions.find((y) => y.id === q.id);
                      if (x) x.state = s.key;
                    })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="small muted">Up to three open or “Ask client” questions go into your drafted reply.</p>
    </section>
  );
}

function Similar({ deal, tiger }: { deal: Deal; tiger: boolean }) {
  return (
    <section className="stack" aria-labelledby="similar-head">
      <h3 id="similar-head" className="h-card">
        You’ve done something like this before
      </h3>
      {deal.similar.map((p) => {
        const over = p.estimatedHours && p.actualHours != null ? Math.round((p.actualHours / p.estimatedHours - 1) * 100) : null;
        return (
          <div className="similar" key={p.id}>
            <b>{p.title}</b>
            {p.estimatedHours != null && p.actualHours != null && (
              <div className="num small">
                Estimated {formatHours(p.estimatedHours)}, actually took {formatHours(p.actualHours)}
                {over !== null ? ` (${over > 0 ? '+' : ''}${over}%)` : ''}
              </div>
            )}
            {p.lesson && <div className="small">Lesson: {p.lesson}</div>}
          </div>
        );
      })}
      <p className="small muted">From your past projects{tiger ? ' (Tiger Data)' : ''}.</p>
    </section>
  );
}
