// Tolerant JSON extraction from model output. Models wrap JSON in prose,
// code fences or thinking blocks; this finds the first complete object.

export type JsonResult = { ok: true; value: unknown } | { ok: false; error: string };

/** Removes <think>...</think> reasoning that some open models emit inline. */
export function stripThinking(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const close = out.toLowerCase().lastIndexOf('</think>');
  if (close >= 0) out = out.slice(close + '</think>'.length);
  return out;
}

function matchingBrace(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parse(candidate: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (first) {
    try {
      // The most common slip: a trailing comma before } or ].
      return { ok: true, value: JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')) };
    } catch {
      return { ok: false, error: first instanceof Error ? first.message : 'Invalid JSON' };
    }
  }
}

export function extractJson(text: string): JsonResult {
  const cleaned = stripThinking(text);
  let error = 'No JSON object found in the response.';
  let from = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = cleaned.indexOf('{', from);
    if (start < 0) break;
    const end = matchingBrace(cleaned, start);
    if (end < 0) {
      error = 'The JSON object is not closed. The response may have been cut off.';
      break;
    }
    const result = parse(cleaned.slice(start, end + 1));
    if (result.ok) return result;
    error = result.error;
    from = start + 1;
  }
  return { ok: false, error };
}
