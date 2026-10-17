/** Random, unguessable identifier. Works in Node 22 and in browsers. */
export function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
}

/** Workspace keys and deal ids must look like ids, nothing else. */
export function isSafeId(value: unknown, maxLength = 80): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(value);
}
