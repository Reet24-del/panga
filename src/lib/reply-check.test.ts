import { describe, expect, it } from 'vitest';
import { findMoneyMentions, unknownAmounts } from './reply-check';

describe('findMoneyMentions', () => {
  it('reads common ways of writing amounts', () => {
    const text = 'Option A is ₹15,000, Option B is Rs. 34000, retainer 3k rupees, or 1.5 lakh for everything. Abroad: $1,500.';
    expect(findMoneyMentions(text).map((m) => m.amount)).toEqual([15000, 34000, 3000, 150000, 1500]);
  });

  it('reads Indian digit grouping', () => {
    expect(findMoneyMentions('₹1,00,000 total').map((m) => m.amount)).toEqual([100000]);
  });

  it('reads both ends of a price range', () => {
    expect(findMoneyMentions('hamara budget around 25-30k hai').map((m) => m.amount)).toEqual([25000, 30000]);
    expect(findMoneyMentions('somewhere between ₹20 to 25 thousand').map((m) => m.amount)).toEqual([20000, 25000]);
  });

  it('does not mistake hours or counts for money', () => {
    expect(findMoneyMentions('2 hours 15 minutes for 200 products over 3 rounds')).toEqual([]);
  });
});

describe('unknownAmounts', () => {
  it('flags amounts Panga did not calculate', () => {
    const text = 'The full scope is ₹34,000. Ongoing updates are ₹3,000 per month.';
    expect(unknownAmounts(text, [15000, 34000]).map((m) => m.raw)).toEqual(['₹3,000']);
  });
});
