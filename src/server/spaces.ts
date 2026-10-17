// Original uploads (brief PDFs, client voice notes) kept in DigitalOcean
// Spaces through its S3-compatible API. Objects are private; the freelancer
// gets a short-lived signed link. Optional: without keys, only text is kept.

import { AwsClient } from 'aws4fetch';
import { newId } from '@/lib/ids';
import type { StoredFile } from '@/lib/types';
import { env } from './env';
import { report } from './report';

export function spacesEnabled(): boolean {
  return Boolean(env.spacesKey && env.spacesSecret && env.spacesBucket);
}

function client(): AwsClient {
  // Spaces signs requests with the us-east-1 region name, whatever the datacenter.
  return new AwsClient({ accessKeyId: env.spacesKey, secretAccessKey: env.spacesSecret, service: 's3', region: 'us-east-1' });
}

function objectUrl(key: string): string {
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${env.spacesEndpoint.replace(/\/$/, '')}/${encodeURIComponent(env.spacesBucket)}/${path}`;
}

export function fileKeyBelongsTo(key: string, workspaceId: string): boolean {
  return key.startsWith(`workspaces/${workspaceId}/`) && !key.includes('..') && key.length < 300;
}

/** Stores the upload; returns null when Spaces isn't configured or the upload failed. */
export async function storeFile(workspaceId: string, file: Blob, name: string): Promise<StoredFile | null> {
  if (!spacesEnabled()) return null;
  const safeName = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '').slice(-80) || 'upload';
  const key = `workspaces/${workspaceId}/${newId('f')}-${safeName}`;
  const contentType = file.type || 'application/octet-stream';
  try {
    const res = await client().fetch(objectUrl(key), {
      method: 'PUT',
      body: await file.arrayBuffer(),
      headers: { 'Content-Type': contentType, 'x-amz-acl': 'private' },
    });
    if (!res.ok) throw new Error(`Spaces upload failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { key, name: name.slice(0, 120), size: file.size, contentType };
  } catch (err) {
    report(err, { step: 'spaces.put' });
    return null;
  }
}

export async function signedFileUrl(key: string, seconds = 300): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(seconds));
  const signed = await client().sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
  return signed.url;
}

export async function deleteFiles(keys: string[]): Promise<void> {
  if (!spacesEnabled()) return;
  await Promise.all(
    keys.map(async (key) => {
      try {
        await client().fetch(objectUrl(key), { method: 'DELETE' });
      } catch (err) {
        report(err, { step: 'spaces.delete' });
      }
    }),
  );
}
