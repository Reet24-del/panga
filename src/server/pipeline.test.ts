import { describe, expect, it } from 'vitest';
import sample from '@/lib/sample-deal.json';
import { req, PRD_ASSUMPTIONS } from '@/lib/test-helpers';
import type { Deal, Turn } from '@/lib/types';
import { correctionNotes, newDeal, rehearsalMessages, rehearsalPersona, replyFacts, tidyReply } from './pipeline';
import { CALL_OPENING, looksHinglish, replyPrompt } from './prompts';

function sampleDeal(): Deal {
  const deal = newDeal({
    workspaceId: 'ws_test_123456',
    title: sample.title,
    currency: 'INR',
    offeredPrice: 15000,
    minimumRate: null,
    sources: sample.sources.map((s) => ({ kind: s.kind as 'brief' | 'chat', label: s.label, text: s.text })),
  });
  deal.summary = 'An online clothing store.';
  deal.assumptions = PRD_ASSUMPTIONS;
  deal.requirements = [
    req('R1', 12, { title: 'Store setup', inStarter: true }),
    req('R2', 6, { title: 'Mobile layouts', hidden: true, inStarter: true }),
    req('R3', 4, { title: 'Payments', hidden: true }),
    req('R4', 13, { title: 'Product migration', hidden: true, category: 'content' }),
    req('R5', 4, { title: 'Post-launch updates', hidden: true, category: 'support' }),
  ];
  return deal;
}

describe('newDeal', () => {
  it('numbers sources and starts in analysis', () => {
    const d = sampleDeal();
    expect(d.sources.map((s) => s.id)).toEqual(['S1', 'S2']);
    expect(d.stage).toBe('analyzing');
    expect(d.id).toMatch(/^d_[a-f0-9]{32}$/);
  });
});

describe('rehearsalMessages', () => {
  it('starts with the call opening and alternates roles, merging repeats', () => {
    const turns: Turn[] = [
      { id: 'a', role: 'client', text: 'Hi! Upload is included?', requirementId: 'R4' },
      { id: 'b', role: 'freelancer', text: 'Not at this price.', requirementId: null },
      { id: 'c', role: 'freelancer', text: 'We can talk about it.', requirementId: null },
    ];
    const m = rehearsalMessages(turns);
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(m[0].content).toBe(CALL_OPENING);
    expect(m[1].content).toBe('[R4] Hi! Upload is included?');
    expect(m[2].content).toBe('Not at this price.\nWe can talk about it.');
  });
});

describe('rehearsalPersona', () => {
  it('detects Hinglish from the client messages and lists only evidenced work', () => {
    const d = sampleDeal();
    d.requirements.push(req('R6', 2, { title: 'Hosting', status: 'inferred', evidence: [] }));
    const persona = rehearsalPersona(d, 'hell');
    expect(persona).toContain('mixing Hindi and English');
    expect(persona).toContain('[R4] Product migration');
    expect(persona).not.toContain('Hosting');
    expect(persona).toContain('₹15,000');
  });
});

describe('looksHinglish', () => {
  it('needs at least two distinct Hindi words', () => {
    expect(looksHinglish('total 15k is fine na? acha theek hai')).toBe(true);
    expect(looksHinglish('Please send the invoice na')).toBe(false);
  });
});

describe('replyFacts', () => {
  it('offers the starter at the budget and the full scope at the computed price', () => {
    const { facts, allowed } = replyFacts(sampleDeal(), 'change', 'english_friendly');
    expect(facts.starter.items).toEqual(['Store setup', 'Mobile layouts']);
    expect(facts.full.price).toBe(34000);
    expect(facts.take.price).toBe(34000);
    expect(allowed.sort()).toEqual([15000, 34000, 34000].sort());
    const prompt = replyPrompt(facts);
    expect(prompt).toContain('₹15,000');
    expect(prompt).toContain('₹34,000');
    expect(prompt).toContain('Not included in Option 1: Payments, Product migration, Post-launch updates');
  });

  it('takes the deal at the offered price when it clears the floor', () => {
    const d = sampleDeal();
    d.offeredPrice = 40000;
    expect(replyFacts(d, 'take', 'english_formal').facts.take.price).toBe(40000);
  });

  it('never puts a price in a decline', () => {
    const prompt = replyPrompt(replyFacts(sampleDeal(), 'walk', 'hinglish_friendly').facts);
    expect(prompt).toContain('Do not mention any price');
    expect(prompt).not.toContain('₹34,000');
  });
});

describe('tidyReply', () => {
  it('drops a dangling sign-off, subject line and bold markers', () => {
    expect(tidyReply('Subject: Your store\n\nHi! The **full scope** is ₹38,000.\n\nBest regards,\n')).toBe('Hi! The full scope is ₹38,000.');
    expect(tidyReply('Hi!\nThanks,')).toBe('Hi!');
  });

  it('keeps sentences that only start like a sign-off', () => {
    expect(tidyReply('Hi!\nThanks for sharing the details, I will send options.')).toBe('Hi!\nThanks for sharing the details, I will send options.');
  });
});

describe('correctionNotes', () => {
  it('describes removals, renames, added work and big hour changes', () => {
    const d = sampleDeal();
    d.extracted = d.requirements.map((r) => ({ id: r.id, title: r.title, suggestedHours: r.hours }));
    d.requirements[0] = { ...d.requirements[0], title: 'Shopify setup' };
    d.requirements[3] = { ...d.requirements[3], hours: 20, hoursSource: 'freelancer' };
    d.requirements[4] = { ...d.requirements[4], status: 'removed' };
    d.requirements.push(req('R6', 3, { title: 'Size chart page', addedBy: 'freelancer' }));
    const notes = correctionNotes(d);
    expect(notes).toEqual([
      'The freelancer calls "Store setup" "Shopify setup".',
      'The freelancer estimates "Product migration" at 20 h when the client says "quote for R4", not 13 h.',
      'For "An online clothing store.", the freelancer removed "Post-launch updates" from the scope Panga extracted.',
      'For "An online clothing store.", the freelancer added work Panga missed: "Size chart page".',
    ]);
  });
});
