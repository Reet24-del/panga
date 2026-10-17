import { transcribe } from '@/server/elevenlabs';
import { env } from '@/server/env';
import { HttpError } from '@/server/errors';
import { json, requireWorkspace, route } from '@/server/http';
import { takeModelCall } from '@/server/ratelimit';
import { storeFile } from '@/server/spaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

/** Transcribes a client's voice note with ElevenLabs speech-to-text. */
export const POST = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  if (!env.elevenlabsKey) throw new HttpError(501, 'Voice notes are switched off on this server (no ElevenLabs key).', 'no_transcription');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Choose an audio file.', 'no_file');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'That recording is larger than 25 MB.', 'too_large');
  if (!/^audio\/|^video\//.test(file.type) && !/\.(m4a|mp3|wav|ogg|opus|webm|aac|mp4)$/i.test(file.name)) {
    throw new HttpError(415, 'That file is not an audio recording.', 'not_audio');
  }
  takeModelCall(ws);
  const [result, stored] = await Promise.all([transcribe(file, file.name), storeFile(ws, file, file.name)]);
  if (!result.text) throw new HttpError(422, 'No speech was found in that recording.', 'no_speech');
  return json({ text: result.text.slice(0, 20_000), language: result.language, file: stored, name: file.name });
});
