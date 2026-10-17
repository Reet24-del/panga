import { describe, expect, it } from 'vitest';
import {
  autoFitStarter,
  dealPackages,
  defaultAssumptions,
  fullScopePrice,
  growthScenario,
  packageEconomics,
} from './economics';
import { formatMoney } from './format';
import { PRD_ASSUMPTIONS, req } from './test-helpers';

// The worked example from the PRD: "a simple online store" for ₹15,000.
const PRD_ITEMS = [
  req('R1', 12, { title: 'Store setup and theme' }),
  req('R2', 6, { title: 'Mobile layouts', hidden: true }),
  req('R3', 4, { title: 'Payment gateway', hidden: true }),
  req('R4', 13, { title: 'Product migration', hidden: true }),
  req('R5', 4, { title: 'Post-launch updates', hidden: true, category: 'support' }),
];

describe('packageEconomics', () => {
  const econ = packageEconomics({
    price: 15000,
    itemHours: PRD_ITEMS.map((r) => r.hours),
    revisionRounds: 2,
    assumptions: PRD_ASSUMPTIONS,
    currency: 'INR',
  });

  it('matches the PRD worked example', () => {
    expect(econ.totalHours.value).toBe(45);
    expect(econ.effectiveRate.value).toBe(333);
    expect(econ.floorPrice.value).toBe(31500);
    expect(econ.gapToFloor.value).toBe(16500);
    expect(econ.meetsFloor).toBe(false);
  });

  it('shows the inputs behind each number', () => {
    expect(econ.totalHours.formula).toBe('5 items (39 h) + 2 × 3 h revisions');
    expect(econ.effectiveRate.formula).toBe('₹15,000 ÷ 45 h');
    expect(econ.floorPrice.formula).toBe('45 h × ₹700/h');
    expect(econ.gapToFloor.formula).toBe('₹31,500 − ₹15,000');
  });

  it('handles a missing price without inventing one', () => {
    const e = packageEconomics({ price: null, itemHours: [10], revisionRounds: 0, assumptions: PRD_ASSUMPTIONS, currency: 'INR' });
    expect(e.effectiveRate.value).toBeNull();
    expect(e.gapToFloor.value).toBeNull();
    expect(e.meetsFloor).toBeNull();
    expect(e.floorPrice.value).toBe(7000);
  });

  it('handles zero hours', () => {
    const e = packageEconomics({ price: 5000, itemHours: [], revisionRounds: 0, assumptions: PRD_ASSUMPTIONS, currency: 'INR' });
    expect(e.totalHours.value).toBe(0);
    expect(e.effectiveRate.value).toBeNull();
    expect(e.effectiveRate.formula).toBe('No hours yet');
  });

  it('ignores negative and non-numeric hours', () => {
    const e = packageEconomics({ price: 1000, itemHours: [5, -3, Number.NaN], revisionRounds: -1, assumptions: PRD_ASSUMPTIONS, currency: 'INR' });
    expect(e.totalHours.value).toBe(5);
  });

  it('includes comms hours in the total and the formula', () => {
    const e = packageEconomics({
      price: 15000,
      itemHours: [10],
      revisionRounds: 1,
      assumptions: { ...PRD_ASSUMPTIONS, commsHours: 2 },
      currency: 'INR',
    });
    expect(e.totalHours.value).toBe(15);
    expect(e.totalHours.formula).toBe('1 item (10 h) + 2 h comms + 1 × 3 h revisions');
    expect(e.effectiveRate.value).toBe(1000);
    expect(e.meetsFloor).toBe(true);
  });
});

describe('growthScenario', () => {
  it('matches the PRD "if revisions grow" row', () => {
    const s = growthScenario({ price: 15000, baseHours: 45, extraRounds: 2, extraMonths: 2, assumptions: PRD_ASSUMPTIONS, currency: 'INR' });
    expect(s.hours.value).toBe(59);
    expect(s.rate.value).toBe(254);
    expect(s.hours.formula).toBe('45 h + 2 × 3 h revisions + 2 × 4 h updates = 59 h');
  });

  it('with no growth, equals the base', () => {
    const s = growthScenario({ price: 15000, baseHours: 45, extraRounds: 0, extraMonths: 0, assumptions: PRD_ASSUMPTIONS, currency: 'INR' });
    expect(s.hours.value).toBe(45);
    expect(s.hours.formula).toBe('45 h');
  });
});

describe('fullScopePrice', () => {
  it('adds the buffer and rounds to the step, as in the PRD (₹34,000)', () => {
    const p = fullScopePrice(31500, PRD_ASSUMPTIONS, 'INR');
    expect(p.value).toBe(34000);
    expect(p.formula).toBe('₹31,500 floor + 8% buffer, rounded to ₹1,000');
  });

  it('never rounds below the floor', () => {
    expect(fullScopePrice(31500, { ...PRD_ASSUMPTIONS, contingencyPct: 0 }, 'INR').value).toBe(32000);
  });
});

describe('starter package', () => {
  it('matches the PRD Option A (18 h at ₹833/h)', () => {
    const items = [
      req('A1', 8, { inStarter: true, starterHours: 8 }),
      req('A2', 2, { inStarter: true, starterHours: 2 }),
      req('A3', 4, { inStarter: true, starterHours: 4 }),
      req('A4', 1, { inStarter: true, starterHours: 1 }),
      req('A5', 13, { inStarter: false }),
    ];
    const p = dealPackages({ offeredPrice: 15000, currency: 'INR', requirements: items, assumptions: PRD_ASSUMPTIONS });
    expect(p.starter.totalHours.value).toBe(18);
    expect(p.starter.effectiveRate.value).toBe(833);
    expect(p.starter.meetsFloor).toBe(true);
    expect(p.excludedFromStarter.map((r) => r.id)).toEqual(['A5']);
  });

  it('auto-fit keeps headline work and drops hidden work first', () => {
    const ids = autoFitStarter(PRD_ITEMS, 15000, PRD_ASSUMPTIONS);
    // Budget: 15000 / 700 = 21.4 h, minus one 3 h revision round = 18.4 h.
    expect([...ids]).toEqual(['R1', 'R2']);
  });

  it('auto-fit always keeps the headline work, even when it alone exceeds the budget', () => {
    const items = [req('S1', 20, { title: 'Online store build' }), req('S2', 4, { hidden: true }), req('S3', 6, { hidden: true })];
    const ids = autoFitStarter(items, 15000, PRD_ASSUMPTIONS);
    expect([...ids]).toEqual(['S1']);
    const p = dealPackages({ offeredPrice: 15000, currency: 'INR', requirements: items.map((r) => ({ ...r, inStarter: ids.has(r.id) })), assumptions: PRD_ASSUMPTIONS });
    expect(p.starter.meetsFloor).toBe(false);
  });

  it('auto-fit returns nothing without a price', () => {
    expect(autoFitStarter(PRD_ITEMS, null, PRD_ASSUMPTIONS).size).toBe(0);
  });
});

describe('dealPackages', () => {
  it('prices only confirmed work', () => {
    const items = [...PRD_ITEMS, req('R6', 10, { status: 'inferred', evidence: [] }), req('R7', 10, { status: 'removed' })];
    const p = dealPackages({ offeredPrice: 15000, currency: 'INR', requirements: items, assumptions: PRD_ASSUMPTIONS });
    expect(p.full.totalHours.value).toBe(45);
    expect(p.inferredCount).toBe(1);
    expect(p.fullPrice.value).toBe(34000);
    expect(p.fullAtPrice.effectiveRate.value).toBe(756);
  });

  it('recommends changing the deal when a smaller package fits', () => {
    const items = PRD_ITEMS.map((r) => ({ ...r, inStarter: r.id === 'R1' || r.id === 'R2' }));
    const p = dealPackages({ offeredPrice: 15000, currency: 'INR', requirements: items, assumptions: PRD_ASSUMPTIONS });
    expect(p.recommendation.choice).toBe('change');
    expect(p.recommendation.reason).toContain('₹333/h');
    expect(p.recommendation.reason).toContain('₹714/h');
    expect(p.recommendation.reason).toContain('₹34,000');
  });

  it('recommends taking the deal when the offer clears the floor', () => {
    const p = dealPackages({ offeredPrice: 40000, currency: 'INR', requirements: PRD_ITEMS, assumptions: PRD_ASSUMPTIONS });
    expect(p.recommendation.choice).toBe('take');
  });

  it('recommends walking away when nothing fits the budget', () => {
    const p = dealPackages({ offeredPrice: 2000, currency: 'INR', requirements: PRD_ITEMS, assumptions: PRD_ASSUMPTIONS });
    expect(p.recommendation.choice).toBe('walk');
  });

  it('asks for hours when there are none', () => {
    const p = dealPackages({ offeredPrice: 2000, currency: 'INR', requirements: [], assumptions: { ...PRD_ASSUMPTIONS, revisionRounds: 0 } });
    expect(p.recommendation.choice).toBeNull();
  });

  it('quotes the full scope when no budget was stated', () => {
    const p = dealPackages({ offeredPrice: null, currency: 'INR', requirements: PRD_ITEMS, assumptions: PRD_ASSUMPTIONS });
    expect(p.recommendation.choice).toBe('take');
    expect(p.recommendation.reason).toContain('₹34,000');
  });
});

describe('defaults and formatting', () => {
  it('uses currency-appropriate defaults', () => {
    expect(defaultAssumptions('INR').minimumRate).toBe(700);
    expect(defaultAssumptions('USD').priceStep).toBe(50);
    expect(defaultAssumptions('INR', 900).minimumRate).toBe(900);
  });

  it('groups rupees the Indian way', () => {
    expect(formatMoney(100000, 'INR')).toBe('₹1,00,000');
    expect(formatMoney(1500, 'USD')).toBe('$1,500');
    expect(formatMoney(-0.2, 'INR')).toBe('₹0');
  });
});
