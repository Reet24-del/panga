import { HttpError } from '@/server/errors';
import { json, requireWorkspace, route } from '@/server/http';
import { fileKeyBelongsTo, signedFileUrl, spacesEnabled } from '@/server/spaces';

export const dynamic = 'force-dynamic';

/** A five-minute link to an original upload in DigitalOcean Spaces. */
export const GET = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (!spacesEnabled()) throw new HttpError(501, 'File storage is switched off on this server.', 'no_files');
  if (!fileKeyBelongsTo(key, ws)) throw new HttpError(404, 'File not found.', 'not_found');
  return json({ url: await signedFileUrl(key) });
});
