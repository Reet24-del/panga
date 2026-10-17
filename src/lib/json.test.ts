import { describe, expect, it } from 'vitest';
import { extractJson, stripThinking } from './json';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('finds JSON inside a code fence and prose', () => {
    const r = extractJson('Here you go:\n```json\n{"items":[{"t":"x"}]}\n```\nAnything else?');
    expect(r).toEqual({ ok: true, value: { items: [{ t: 'x' }] } });
  });

  it('skips thinking blocks, even ones containing braces', () => {
    const r = extractJson('<think>maybe {"wrong": true}</think>{"right":true}');
    expect(r).toEqual({ ok: true, value: { right: true } });
  });

  it('repairs a trailing comma', () => {
    expect(extractJson('{"a":[1,2,],}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });

  it('handles braces inside strings', () => {
    expect(extractJson('{"q":"use { and } freely"}')).toEqual({ ok: true, value: { q: 'use { and } freely' } });
  });

  it('reports truncated output', () => {
    const r = extractJson('{"a": [1, 2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cut off/);
  });

  it('reports missing JSON', () => {
    expect(extractJson('no json here').ok).toBe(false);
  });
});

describe('stripThinking', () => {
  it('drops everything up to a dangling closing tag', () => {
    expect(stripThinking('reasoning...</think>answer')).toBe('answer');
  });
});
