'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { CURRENCY_SYMBOL } from '@/lib/format';
import { SAMPLE_DEAL } from '@/lib/sample';
import { CURRENCIES, type Currency, type Deal, type Integrations, type SourceKind, type StoredFile } from '@/lib/types';
import { ErrorNote } from './ui';

interface Upload {
  name: string;
  file: StoredFile | null;
  detail: string;
}

interface UploadResult {
  text: string;
  name: string;
  file: StoredFile | null;
  pages?: number;
  truncated?: boolean;
  language?: string | null;
}

export function Intake() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [price, setPrice] = useState('');
  const [brief, setBrief] = useState('');
  const [briefLabel, setBriefLabel] = useState('Brief');
  const [briefUpload, setBriefUpload] = useState<Upload | null>(null);
  const [chat, setChat] = useState('');
  const [chatLabel, setChatLabel] = useState('Client messages');
  const [voice, setVoice] = useState('');
  const [voiceUpload, setVoiceUpload] = useState<Upload | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'voice' | 'submit'>(null);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<Integrations | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ preferences: { currency: Currency }; integrations: Integrations }>('/api/preferences')
      .then((r) => {
        setCurrency(r.preferences.currency);
        setFeatures(r.integrations);
      })
      .catch(() =>
        api<{ integrations: Integrations }>('/api/health')
          .then((r) => setFeatures(r.integrations))
          .catch(() => undefined),
      );
  }, []);

  function loadSample() {
    const brief = SAMPLE_DEAL.sources.find((s) => s.kind === 'brief');
    const chat = SAMPLE_DEAL.sources.find((s) => s.kind === 'chat');
    setTitle(SAMPLE_DEAL.title);
    setCurrency(SAMPLE_DEAL.currency);
    setPrice('');
    setBrief(brief?.text ?? '');
    setBriefLabel(brief?.label ?? 'Brief');
    setChat(chat?.text ?? '');
    setChatLabel(chat?.label ?? 'Client messages');
    setVoice('');
    setBriefUpload(null);
    setVoiceUpload(null);
    setIsSample(true);
    setError(null);
  }

  async function upload(kind: 'pdf' | 'voice', file: File) {
    setBusy(kind);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      const r = await api<UploadResult>(kind === 'pdf' ? '/api/pdf' : '/api/transcribe', { form });
      if (kind === 'pdf') {
        setBrief(r.text);
        setBriefLabel(`Brief (${r.name})`);
        setBriefUpload({
          name: r.name,
          file: r.file,
          detail: `${r.pages ?? 0} page${r.pages === 1 ? '' : 's'}${r.truncated ? ', first 20,000 characters' : ''}`,
        });
        if (!title) setTitle(r.name.replace(/\.pdf$/i, ''));
      } else {
        setVoice(r.text);
        setVoiceUpload({ name: r.name, file: r.file, detail: r.language ? `language: ${r.language}` : 'transcribed' });
      }
      setIsSample(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sources: { kind: SourceKind; label: string; text: string; file?: StoredFile | null }[] = [];
    if (brief.trim()) sources.push({ kind: 'brief', label: briefLabel, text: brief, file: briefUpload?.file ?? null });
    if (chat.trim()) sources.push({ kind: 'chat', label: chatLabel, text: chat });
    if (voice.trim())
      sources.push({
        kind: 'voice',
        label: voiceUpload ? `Voice note (${voiceUpload.name})` : 'Voice note',
        text: voice,
        file: voiceUpload?.file ?? null,
      });
    if (!sources.length) {
      setError('Paste a brief or the client’s messages first.');
      return;
    }
    const amount = Number(price.replace(/[,\s]/g, ''));
    setBusy('submit');
    setError(null);
    try {
      const r = await api<{ deal: Deal }>('/api/deals', {
        body: { title, currency, offeredPrice: price.trim() && amount > 0 ? amount : null, sources },
      });
      router.push(`/deal/${r.deal.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  }

  return (
    <form className="card card-ink intake stack" onSubmit={submit}>
      <div className="head">
        <h2 className="h-section">Start a new deal</h2>
        <button type="button" className="btn btn-quiet btn-sm" onClick={loadSample} disabled={busy !== null}>
          Try the sample deal
        </button>
      </div>

      {features && !features.model && (
        <div className="callout warn small">
          This server has no DigitalOcean model key yet, so Panga can’t read briefs. Set <code>DO_MODEL_ACCESS_KEY</code> and restart.
        </div>
      )}
      {isSample && <div className="notice">Sample loaded: Saanjh Studio is a made-up clothing label. Change anything you like.</div>}

      <div className="grid-2">
        <label className="field">
          <span>What’s the project?</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bakery website for Meera"
            maxLength={120}
          />
        </label>
        <div className="field">
          <span id="offer-label">What they’re offering</span>
          <div className="input-group" role="group" aria-labelledby="offer-label">
            <select className="select" aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_SYMBOL[c]} {c}
                </option>
              ))}
            </select>
            <input
              className="input input-num"
              aria-label="Offered amount"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Skip if they didn’t say"
            />
          </div>
          <small>Panga also looks for a price in their messages.</small>
        </div>
      </div>

      <label className="field">
        <span>Their brief</span>
        <textarea
          className="textarea"
          rows={6}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Paste the brief or the email they sent you…"
          maxLength={20000}
        />
      </label>
      <div className="row">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => pdfInput.current?.click()} disabled={busy !== null}>
          {busy === 'pdf' ? 'Reading the PDF…' : 'Upload a PDF instead'}
        </button>
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload('pdf', f);
          }}
        />
        {briefUpload && (
          <span className="file-chip">
            {briefUpload.name} · {briefUpload.detail} · {briefUpload.file ? 'original saved safely' : 'text only'}
          </span>
        )}
      </div>

      <label className="field">
        <span>Their messages</span>
        <textarea
          className="textarea"
          rows={6}
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="Paste the WhatsApp or email chat. Timestamps are fine."
          maxLength={20000}
        />
      </label>

      {features?.transcription && (
        <div className="stack">
          <div className="row">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => audioInput.current?.click()} disabled={busy !== null}>
              {busy === 'voice' ? 'Listening…' : 'Add their voice note'}
            </button>
            <input
              ref={audioInput}
              type="file"
              accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.webm"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void upload('voice', f);
              }}
            />
            <span className="small muted">We’ll type it out for you.</span>
          </div>
          {(voice || voiceUpload) && (
            <label className="field">
              <span>
                Voice note transcript{voiceUpload ? ` · ${voiceUpload.name}` : ''}
                {voiceUpload?.file ? ' · original saved' : ''}
              </span>
              <textarea className="textarea" rows={4} value={voice} onChange={(e) => setVoice(e.target.value)} maxLength={20000} />
            </label>
          )}
        </div>
      )}

      <ErrorNote message={error} onDismiss={() => setError(null)} />
      <div className="row">
        <button type="submit" className="btn btn-primary btn-big" disabled={busy !== null}>
          {busy === 'submit' ? 'Reading…' : 'Find the catch →'}
        </button>
        <span className="small muted">Panga only lists work it can quote from their own words.</span>
      </div>
    </form>
  );
}
