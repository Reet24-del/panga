import { HttpError } from '@/server/errors';
import { json, requireWorkspace, route } from '@/server/http';
import { storeFile } from '@/server/spaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/** Extracts the text of a brief PDF (and keeps the original in Spaces when configured). */
export const POST = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Choose a PDF file.', 'no_file');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'That PDF is larger than 10 MB.', 'too_large');
  if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith('.pdf')) throw new HttpError(415, 'That file is not a PDF.', 'not_pdf');

  const { extractText, getDocumentProxy } = await import('unpdf');
  let pages = 0;
  let raw = '';
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const result = await extractText(pdf, { mergePages: true });
    pages = result.totalPages;
    raw = Array.isArray(result.text) ? result.text.join('\n') : result.text;
  } catch {
    throw new HttpError(422, "Panga couldn't read that PDF. Paste the brief text instead.", 'bad_pdf');
  }
  const text = raw.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new HttpError(422, 'This PDF has no text layer (it may be a scan). Paste the brief text instead.', 'no_text');
  const stored = await storeFile(ws, file, file.name);
  return json({ text: text.slice(0, 20_000), truncated: text.length > 20_000, pages, file: stored, name: file.name });
});
