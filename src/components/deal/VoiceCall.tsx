'use client';

// Voice rehearsal. ElevenLabs carries the audio both ways; what the simulated
// client says comes from Panga's own endpoint (Gemma on DigitalOcean), which
// knows this call by its token.

import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { useEffect, useRef, useState } from 'react';
import { ErrorNote } from '../ui';

export interface VoiceLine {
  role: 'client' | 'freelancer';
  text: string;
}

interface Props {
  signedUrl: string;
  callToken: string;
  firstMessage: string;
  difficultyLabel: string;
  onEnd: (lines: VoiceLine[]) => void;
}

export default function VoiceCall(props: Props) {
  return (
    <ConversationProvider>
      <Call {...props} />
    </ConversationProvider>
  );
}

function Call({ signedUrl, callToken, firstMessage, difficultyLabel, onEnd }: Props) {
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const linesRef = useRef<VoiceLine[]>([]);
  const finished = useRef(false);
  const started = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onEnd(linesRef.current);
  };

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      const text = message?.trim();
      if (!text) return;
      linesRef.current = [...linesRef.current, { role: role === 'agent' ? 'client' : 'freelancer', text }];
      setLines(linesRef.current);
    },
    onError: (message) => setError(message || 'The voice connection failed.'),
    onDisconnect: () => finish(),
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setError('Panga needs your microphone for a voice rehearsal. Allow it in the browser, or end this call and rehearse by text.');
        return;
      }
      conversation.startSession({
        signedUrl,
        dynamicVariables: { panga_call: callToken },
        customLlmExtraBody: { panga_call: callToken },
        overrides: { agent: { firstMessage } },
      });
    })();
    // The session starts once per call; the conversation object changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = conversation.status;
  const label =
    status === 'connected'
      ? conversation.isSpeaking
        ? 'The client is talking'
        : 'Listening to you'
      : status === 'connecting'
        ? 'Ringing…'
        : 'Call ended';

  return (
    <div className="call-layout">
      <div className="call" aria-label="Voice rehearsal">
        <div className="call-head">
          <span className="live">
            <span className="dot" /> {label}
          </span>
          <span className="badge">{difficultyLabel}</span>
        </div>
        <div className="call-body" aria-live="polite">
          {lines.length === 0 && <p style={{ color: 'var(--call-muted)', margin: 0 }}>The client speaks first. Answer out loud.</p>}
          {lines.map((l, i) => (
            <div key={i} className={`bubble ${l.role === 'client' ? 'client' : 'me'}`}>
              {l.text}
              {l.role === 'client' && <span className="tag">Practice line</span>}
            </div>
          ))}
        </div>
        <div className="call-input">
          <button
            type="button"
            className="btn"
            style={{ background: 'var(--call-ink)', color: 'var(--call)' }}
            onClick={() => {
              if (status === 'connected' || status === 'connecting') conversation.endSession();
              finish();
            }}
          >
            End call & see what you promised
          </button>
        </div>
      </div>
      <aside className="stack">
        <ErrorNote message={error} />
        <p className="small muted">Use headphones so the pretend client doesn’t hear itself. It only knows what’s in this brief.</p>
      </aside>
    </div>
  );
}
