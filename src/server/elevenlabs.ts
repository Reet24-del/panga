// ElevenLabs: a signed URL to start a voice rehearsal with Panga's agent, and
// speech-to-text for client voice notes.

import { env } from './env';
import { ConfigurationError, HttpError } from './errors';
import { report } from './report';

function endpoint(path: string): URL {
  return new URL(`${env.elevenlabsBaseUrl.replace(/\/$/, '')}${path}`);
}

function headers(): Record<string, string> {
  return { 'xi-api-key': env.elevenlabsKey };
}

export async function signedConversationUrl(): Promise<string> {
  if (!env.elevenlabsKey || !env.elevenlabsAgentId) {
    throw new ConfigurationError('Voice rehearsal needs ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID. Run npm run setup:voice.');
  }
  const url = endpoint('/v1/convai/conversation/get-signed-url');
  url.searchParams.set('agent_id', env.elevenlabsAgentId);
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15_000) }).catch((err) => {
    report(err, { step: 'elevenlabs.signedUrl' });
    throw new HttpError(502, "Couldn't reach ElevenLabs to start the voice call. Try text instead.", 'voice_unavailable');
  });
  if (!res.ok) {
    report(new Error(`ElevenLabs signed URL request failed with ${res.status}: ${(await res.text()).slice(0, 200)}`));
    throw new HttpError(502, 'ElevenLabs refused to start the voice call. Check the agent and API key, or rehearse by text.', 'voice_unavailable');
  }
  const body = (await res.json()) as { signed_url?: string };
  if (!body.signed_url) throw new HttpError(502, 'ElevenLabs did not return a call link.', 'voice_unavailable');
  return body.signed_url;
}

export async function transcribe(file: Blob, filename: string): Promise<{ text: string; language: string | null }> {
  if (!env.elevenlabsKey) throw new ConfigurationError('Voice notes need an ElevenLabs key (ELEVENLABS_API_KEY).');
  const form = new FormData();
  form.set('model_id', process.env.ELEVENLABS_STT_MODEL?.trim() || 'scribe_v2');
  form.set('file', file, filename);
  const res = await fetch(endpoint('/v1/speech-to-text'), {
    method: 'POST',
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(120_000),
  }).catch((err) => {
    report(err, { step: 'elevenlabs.transcribe' });
    throw new HttpError(502, "Couldn't reach ElevenLabs to transcribe the voice note.", 'transcription_unavailable');
  });
  if (!res.ok) {
    report(new Error(`ElevenLabs transcription failed with ${res.status}: ${(await res.text()).slice(0, 200)}`));
    throw new HttpError(502, 'ElevenLabs could not transcribe that recording.', 'transcription_failed');
  }
  const body = (await res.json()) as { text?: string; language_code?: string };
  return { text: (body.text ?? '').trim(), language: body.language_code ?? null };
}
