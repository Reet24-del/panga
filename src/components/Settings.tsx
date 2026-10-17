'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorText, setWorkspaceKey, workspaceKey } from '@/lib/client/api';
import { CURRENCY_SYMBOL, formatDate, formatHours, formatMoney } from '@/lib/format';
import { CURRENCIES, type Currency, type Integrations, type MemoryItem, type PastProject, type Preferences, type Tone } from '@/lib/types';
import { ErrorNote } from './ui';

interface MemoryView {
  backend: 'backboard' | 'local';
  preferences: Preferences;
  memories: MemoryItem[];
  error: string | null;
  integrations: Integrations;
}

const TONES: { key: Tone; label: string }[] = [
  { key: 'english_friendly', label: 'English, friendly' },
  { key: 'english_formal', label: 'English, formal' },
  { key: 'hinglish_friendly', label: 'Hinglish, friendly' },
];

export function Settings() {
  const [view, setView] = useState<MemoryView | null>(null);
  const [projects, setProjects] = useState<PastProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api<MemoryView>('/api/preferences'), api<{ projects: PastProject[] }>('/api/past-projects')]);
      setView(m);
      setProjects(p.projects);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: 28 }}>
      <header className="stack" style={{ gap: 6 }}>
        <h1 className="display" style={{ fontSize: 'clamp(36px, 6vw, 60px)' }}>
          Memory &amp; library
        </h1>
        <p className="muted" style={{ margin: 0, maxWidth: '65ch' }}>
          How you like to quote, what Panga has learned from your edits, and the real jobs it compares new briefs with. All private to this browser.
        </p>
      </header>
      <ErrorNote message={error} onDismiss={() => setError(null)} />
      <div className="settings-grid">
        <div className="stack" style={{ gap: 24 }}>
          {view && <PreferencesForm view={view} onSaved={setView} />}
          {view && <Memories view={view} onChange={load} />}
        </div>
        <div className="stack" style={{ gap: 24 }}>
          <Library projects={projects} tiger={view?.integrations.database === 'tiger'} onChange={load} />
          {view && <Services integrations={view.integrations} />}
          <WorkspaceKey />
        </div>
      </div>
    </div>
  );
}

function PreferencesForm({ view, onSaved }: { view: MemoryView; onSaved: (v: MemoryView) => void }) {
  const [rate, setRate] = useState(view.preferences.minimumRate ? String(view.preferences.minimumRate) : '');
  const [currency, setCurrency] = useState<Currency>(view.preferences.currency);
  const [tone, setTone] = useState<Tone>(view.preferences.tone);
  const [never, setNever] = useState(view.preferences.neverInclude.join(', '));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = Number(rate);
      const next = await api<MemoryView>('/api/preferences', {
        method: 'PUT',
        body: {
          minimumRate: rate.trim() && r > 0 ? r : null,
          currency,
          tone,
          neverInclude: never
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 20),
        },
      });
      onSaved(next);
      setNote(`Saved to ${next.backend === 'backboard' ? 'Backboard' : 'local'} memory. New deals start from these.`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-ink stack" onSubmit={save}>
      <h2 className="h-section" style={{ fontSize: 24 }}>
        How you quote
      </h2>
      <div className="grid-2">
        <div className="field">
          <span id="rate-label">Minimum hourly rate</span>
          <div className="input-group" role="group" aria-labelledby="rate-label">
            <select className="select" aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_SYMBOL[c]} {c}
                </option>
              ))}
            </select>
            <input
              className="input input-num"
              aria-label="Rate per hour"
              type="number"
              min={0}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 700"
            />
          </div>
        </div>
        <label className="field">
          <span>Reply tone</span>
          <select className="select" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            {TONES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Work you never include</span>
        <input
          className="input"
          value={never}
          onChange={(e) => setNever(e.target.value)}
          placeholder="logo design, copywriting, product photography"
        />
        <small>Separate with commas. Panga still lists this work when a client asks, so you can exclude it in writing.</small>
      </label>
      <ErrorNote message={error} />
      {note && (
        <p className="small muted" style={{ margin: 0 }}>
          {note}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <span className="small muted">Stored in {view.backend === 'backboard' ? 'Backboard' : 'this server’s database'}.</span>
      </div>
    </form>
  );
}

function Memories({ view, onChange }: { view: MemoryView; onChange: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const items = view.memories.filter((m) => m.kind !== 'preference');

  async function forget(id: string) {
    setError(null);
    try {
      await api(`/api/memories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await onChange();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section className="card stack" aria-labelledby="memories-head">
      <h2 id="memories-head" className="h-section" style={{ fontSize: 24 }}>
        What Panga remembers
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        When you confirm a deal’s work list, Panga remembers what you changed (things you removed, renamed or re-estimated) and uses it on the next
        brief.
      </p>
      {view.error && <ErrorNote message={view.error} />}
      <ErrorNote message={error} />
      {items.length === 0 && <p className="muted small">Nothing yet. Edit a work list and click “Looks right” to teach Panga.</p>}
      {items.map((m) => (
        <div className="memory" key={m.id}>
          <span>{m.content}</span>
          <button type="button" className="btn-link" onClick={() => forget(m.id)}>
            Forget
          </button>
        </div>
      ))}
    </section>
  );
}

const EMPTY = { title: '', summary: '', requirements: '', estimatedHours: '', actualHours: '', quotedPrice: '', lesson: '' };

function Library({ projects, tiger, onChange }: { projects: PastProject[] | null; tiger: boolean; onChange: () => Promise<void> }) {
  const [form, setForm] = useState(EMPTY);
  const [currency, setCurrency] = useState<Currency>('INR');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (s: string) => (s.trim() && Number(s) >= 0 ? Number(s) : null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/past-projects', {
        body: {
          title: form.title,
          summary: form.summary,
          requirements: form.requirements,
          estimatedHours: num(form.estimatedHours),
          actualHours: num(form.actualHours),
          quotedPrice: num(form.quotedPrice),
          currency,
          lesson: form.lesson,
        },
      });
      setForm(EMPTY);
      setOpen(false);
      await onChange();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/past-projects/${id}`, { method: 'DELETE' });
      await onChange();
    } catch (err) {
      setError(errorText(err));
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="card stack" aria-labelledby="library-head">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="library-head" className="h-section" style={{ fontSize: 24 }}>
          Past projects
        </h2>
        {!open && (
          <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
            ＋ Add a project
          </button>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Real jobs with the hours you guessed and the hours they really took. New briefs are matched against them
        {tiger ? ' (stored in Tiger Data)' : ''}. Finished deals land here automatically.
      </p>
      <ErrorNote message={error} onDismiss={() => setError(null)} />
      {open && (
        <form className="stack" onSubmit={add} style={{ borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
          <label className="field">
            <span>Project</span>
            <input className="input" required value={form.title} onChange={set('title')} placeholder="e.g. Saree boutique Shopify store" />
          </label>
          <label className="field">
            <span>What it was</span>
            <textarea
              className="textarea"
              rows={2}
              value={form.summary}
              onChange={set('summary')}
              placeholder="Online store with 150 products moved from Instagram"
            />
          </label>
          <label className="field">
            <span>Work items</span>
            <input
              className="input"
              value={form.requirements}
              onChange={set('requirements')}
              placeholder="Store setup; product migration; payments"
            />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Estimated hours</span>
              <input className="input input-num" type="number" min={0} value={form.estimatedHours} onChange={set('estimatedHours')} />
            </label>
            <label className="field">
              <span>Actual hours</span>
              <input className="input input-num" type="number" min={0} value={form.actualHours} onChange={set('actualHours')} />
            </label>
          </div>
          <div className="field">
            <span id="quoted-label">Quoted price</span>
            <div className="input-group" role="group" aria-labelledby="quoted-label">
              <select className="select" aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_SYMBOL[c]}
                  </option>
                ))}
              </select>
              <input
                className="input input-num"
                aria-label="Quoted amount"
                type="number"
                min={0}
                value={form.quotedPrice}
                onChange={set('quotedPrice')}
              />
            </div>
          </div>
          <label className="field">
            <span>Lesson</span>
            <textarea className="textarea" rows={2} value={form.lesson} onChange={set('lesson')} placeholder="What took longer than expected?" />
          </label>
          <div className="row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !form.title.trim()}>
              {busy ? 'Saving…' : 'Save project'}
            </button>
            <button type="button" className="btn-link" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {projects === null && <p className="muted small">Loading…</p>}
      {projects?.length === 0 && (
        <p className="muted small">No projects yet. Add two or three real ones so Panga can warn you when a brief looks like a past overrun.</p>
      )}
      {projects?.map((p) => (
        <div className="memory" key={p.id}>
          <div>
            <b>{p.title}</b>
            <div className="small muted num">
              {p.estimatedHours != null ? `Estimated ${formatHours(p.estimatedHours)}` : 'No estimate'}
              {p.actualHours != null ? ` · actual ${formatHours(p.actualHours)}` : ''}
              {p.quotedPrice != null && p.currency ? ` · ${formatMoney(p.quotedPrice, p.currency)}` : ''} · {formatDate(p.createdAt)}
              {p.dealId ? ' · from a Panga deal' : ''}
            </div>
            {p.lesson && <div className="small">{p.lesson}</div>}
          </div>
          <button type="button" className="btn-link" onClick={() => remove(p.id)}>
            Delete
          </button>
        </div>
      ))}
    </section>
  );
}

const SERVICES: { key: keyof Integrations; label: (i: Integrations) => string; on: (i: Integrations) => boolean }[] = [
  { key: 'model', label: (i) => `Gemma (${i.modelId}) on DigitalOcean Serverless Inference`, on: (i) => i.model },
  { key: 'files', label: () => 'Original uploads in DigitalOcean Spaces', on: (i) => i.files === 'spaces' },
  { key: 'database', label: (i) => (i.database === 'tiger' ? 'Tiger Data (Postgres + pgvector)' : 'Local database (PGlite)'), on: () => true },
  { key: 'embeddings', label: () => 'Meaning-based project search (embeddings)', on: (i) => i.embeddings },
  { key: 'temporal', label: () => 'Temporal durable deal workflows', on: (i) => i.temporal },
  { key: 'memory', label: (i) => (i.memory === 'backboard' ? 'Backboard memory' : 'Local memory'), on: () => true },
  { key: 'research', label: () => 'SerpApi web research', on: (i) => i.research },
  { key: 'voice', label: () => 'ElevenLabs voice rehearsal', on: (i) => i.voice },
  { key: 'transcription', label: () => 'ElevenLabs voice-note transcription', on: (i) => i.transcription },
  { key: 'tracing', label: () => 'Sentry agent tracing', on: (i) => i.tracing },
];

function Services({ integrations }: { integrations: Integrations }) {
  return (
    <section className="card" aria-labelledby="services-head">
      <h2 id="services-head" className="h-section" style={{ fontSize: 24, marginBottom: 6 }}>
        What’s switched on
      </h2>
      {SERVICES.map((s) => (
        <div className="integration" key={s.key}>
          <span>{s.label(integrations)}</span>
          <span className={`pill ${s.on(integrations) ? 'take' : ''}`}>{s.on(integrations) ? 'On' : 'Off'}</span>
        </div>
      ))}
    </section>
  );
}

function WorkspaceKey() {
  const [key, setKey] = useState('');
  const [other, setOther] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setKey(workspaceKey()), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(key);
      setNote('Copied. Paste it into Panga on your other device.');
    } catch {
      setNote('Select the key and copy it.');
    }
  }

  function switchTo() {
    if (setWorkspaceKey(other.trim())) window.location.reload();
    else setNote('That doesn’t look like a Panga workspace key.');
  }

  return (
    <section className="card stack" aria-labelledby="key-head">
      <h2 id="key-head" className="h-section" style={{ fontSize: 24 }}>
        Your private key
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        Your deals are tied to this key, kept only in this browser. Copy it to open your deals on another device. Keep it secret!
      </p>
      <div className="row">
        <code className="num small" style={{ overflowWrap: 'anywhere' }}>
          {key ? `${key.slice(0, 7)}…${key.slice(-4)}` : '…'}
        </code>
        <button type="button" className="btn btn-sm" onClick={copy} disabled={!key}>
          Copy key
        </button>
      </div>
      <div className="row">
        <input
          className="input"
          style={{ flex: '1 1 220px' }}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Paste a key from another browser"
          aria-label="Workspace key"
        />
        <button type="button" className="btn btn-sm" onClick={switchTo} disabled={!other.trim()}>
          Use this key
        </button>
      </div>
      {note && (
        <p className="small muted" style={{ margin: 0 }}>
          {note}
        </p>
      )}
    </section>
  );
}
