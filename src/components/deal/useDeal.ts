'use client';

// One deal in the browser: load, edit with debounced autosave, run actions,
// and poll while the server is working (reading a brief, analysing a replay).
// Server responses never overwrite edits the freelancer hasn't saved yet.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText, workspaceKey } from '@/lib/client/api';
import type { Deal } from '@/lib/types';

export type Edit = (mutate: (deal: Deal) => void) => void;
export type Act = <T extends { deal: Deal }>(path: string, body?: unknown, method?: string) => Promise<T>;
export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

function patchOf(d: Deal) {
  return {
    title: d.title.trim() || 'Untitled deal',
    offeredPrice: d.offeredPrice,
    currency: d.currency,
    requirements: d.requirements.map((r) => ({ ...r, title: r.title.trim() || 'Untitled item' })),
    questions: d.questions,
    assumptions: d.assumptions,
  };
}

function keepEdits(local: Deal, server: Deal): Deal {
  const research = new Map(server.requirements.map((r) => [r.id, r.research]));
  return {
    ...server,
    title: local.title,
    offeredPrice: local.offeredPrice,
    currency: local.currency,
    assumptions: local.assumptions,
    questions: local.questions,
    requirements: local.requirements.map((r) => ({ ...r, research: research.get(r.id) ?? r.research })),
    priceEvidence: local.offeredPrice === server.offeredPrice ? server.priceEvidence : null,
  };
}

export function useDeal(id: string) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef<Deal | null>(null);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const show = useCallback((next: Deal) => {
    latest.current = next;
    setDeal(next);
  }, []);

  const accept = useCallback(
    (server: Deal) => {
      const local = latest.current;
      show(local && version.current !== savedVersion.current ? keepEdits(local, server) : server);
    },
    [show],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    while (inflight.current) await inflight.current;
    const current = latest.current;
    if (!current || version.current === savedVersion.current) return;
    const sending = version.current;
    const run = (async () => {
      setSaveState('saving');
      try {
        const r = await api<{ deal: Deal }>(`/api/deals/${id}`, { method: 'PATCH', body: patchOf(current) });
        savedVersion.current = sending;
        accept(r.deal);
        setSaveError(null);
        setSaveState(version.current === savedVersion.current ? 'saved' : 'unsaved');
      } catch (err) {
        setSaveState('error');
        setSaveError(errorText(err));
        throw err;
      }
    })();
    inflight.current = run.catch(() => undefined);
    try {
      await run;
    } finally {
      inflight.current = null;
    }
  }, [id, accept]);

  const edit: Edit = useCallback(
    (mutate) => {
      const current = latest.current;
      if (!current) return;
      const next = structuredClone(current);
      mutate(next);
      show(next);
      version.current++;
      setSaveState('unsaved');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush().catch(() => undefined), 700);
    },
    [flush, show],
  );

  const act: Act = useCallback(
    async <T extends { deal: Deal }>(path: string, body?: unknown, method = 'POST') => {
      await flush();
      const r = await api<T>(path, { method, body });
      accept(r.deal);
      return r;
    },
    [flush, accept],
  );

  const reload = useCallback(async () => {
    const r = await api<{ deal: Deal }>(`/api/deals/${id}`);
    accept(r.deal);
  }, [id, accept]);

  useEffect(() => {
    reload().catch((err) => setLoadError(errorText(err)));
  }, [reload]);

  const waiting = deal ? deal.stage === 'analyzing' || deal.rehearsals.some((r) => r.replay?.status === 'pending') : false;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void reload().catch(() => undefined), 1500);
    return () => clearInterval(t);
  }, [waiting, reload]);

  // Don't lose an edit made just before closing the tab.
  useEffect(() => {
    const onHide = () => {
      const current = latest.current;
      if (!current || version.current === savedVersion.current) return;
      void fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'x-panga-workspace': workspaceKey() },
        body: JSON.stringify(patchOf(current)),
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush().catch(() => undefined);
    };
  }, [id, flush]);

  return { deal, loadError, saveState, saveError, edit, act, reload };
}
