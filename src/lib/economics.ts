// The deal maths. Plain, deterministic code: the model never produces a number
// the freelancer sees. Every figure carries the formula that produced it.

import { formatHours, formatMoney, formatRate, roundHours } from './format';
import type { Assumptions, Choice, Currency, Requirement } from './types';

export interface Figure {
  value: number | null;
  formula: string;
}

export interface FixedFigure {
  value: number;
  formula: string;
}

const DEFAULT_RATE: Record<Currency, number> = { INR: 700, USD: 40, EUR: 40, GBP: 35 };
const DEFAULT_STEP: Record<Currency, number> = { INR: 1000, USD: 50, EUR: 50, GBP: 50 };

export function defaultAssumptions(currency: Currency, minimumRate?: number | null): Assumptions {
  return {
    minimumRate: minimumRate && minimumRate > 0 ? minimumRate : DEFAULT_RATE[currency],
    commsHours: 2,
    revisionRounds: 2,
    starterRevisionRounds: 1,
    hoursPerRound: 3,
    contingencyPct: 8,
    priceStep: DEFAULT_STEP[currency],
    updateHoursPerMonth: 4,
  };
}

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const count = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;
export const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

/** Only confirmed work is priced. Inferred items wait for the freelancer. */
export function isPriced(r: Requirement): boolean {
  return r.status === 'confirmed';
}

export interface PackageInput {
  price: number | null;
  itemHours: number[];
  revisionRounds: number;
  assumptions: Assumptions;
  currency: Currency;
}

export interface PackageEconomics {
  itemCount: number;
  itemHours: number;
  revisionHours: number;
  totalHours: FixedFigure;
  effectiveRate: Figure;
  floorPrice: FixedFigure;
  gapToFloor: Figure;
  /** null when there is no price or no hours to judge. */
  meetsFloor: boolean | null;
}

export function packageEconomics(input: PackageInput): PackageEconomics {
  const { assumptions: a, currency } = input;
  const itemHours = roundHours(input.itemHours.reduce((sum, h) => sum + positive(h), 0));
  const rounds = count(input.revisionRounds);
  const perRound = positive(a.hoursPerRound);
  const comms = positive(a.commsHours);
  const revisionHours = roundHours(rounds * perRound);
  const total = roundHours(itemHours + comms + revisionHours);

  const n = input.itemHours.length;
  const parts = [`${n} ${n === 1 ? 'item' : 'items'} (${formatHours(itemHours)})`];
  if (comms > 0) parts.push(`${formatHours(comms)} comms`);
  if (rounds > 0) parts.push(`${rounds} × ${formatHours(perRound)} revisions`);

  const min = positive(a.minimumRate);
  const price = input.price != null && input.price > 0 ? input.price : null;
  const rate = price != null && total > 0 ? price / total : null;
  const floor = Math.round(total * min);

  return {
    itemCount: n,
    itemHours,
    revisionHours,
    totalHours: { value: total, formula: parts.join(' + ') },
    effectiveRate:
      rate == null
        ? { value: null, formula: price == null ? 'No price yet' : 'No hours yet' }
        : { value: Math.round(rate), formula: `${formatMoney(price!, currency)} ÷ ${formatHours(total)}` },
    floorPrice: { value: floor, formula: `${formatHours(total)} × ${formatRate(min, currency)}` },
    gapToFloor:
      price == null
        ? { value: null, formula: 'No price yet' }
        : { value: floor - Math.round(price), formula: `${formatMoney(floor, currency)} − ${formatMoney(price, currency)}` },
    meetsFloor: rate == null ? null : rate + 1e-9 >= min,
  };
}

export interface GrowthInput {
  price: number | null;
  baseHours: number;
  extraRounds: number;
  extraMonths: number;
  assumptions: Assumptions;
  currency: Currency;
}

export interface GrowthScenario {
  hours: FixedFigure;
  rate: Figure;
  meetsFloor: boolean | null;
}

/** "What if revisions grow and the client keeps asking for updates?" */
export function growthScenario(input: GrowthInput): GrowthScenario {
  const { assumptions: a, currency } = input;
  const rounds = count(input.extraRounds);
  const months = count(input.extraMonths);
  const perRound = positive(a.hoursPerRound);
  const perMonth = positive(a.updateHoursPerMonth);
  const base = roundHours(positive(input.baseHours));
  const hours = roundHours(base + rounds * perRound + months * perMonth);

  const parts = [formatHours(base)];
  if (rounds > 0) parts.push(`${rounds} × ${formatHours(perRound)} revisions`);
  if (months > 0) parts.push(`${months} × ${formatHours(perMonth)} updates`);
  const formula = parts.length > 1 ? `${parts.join(' + ')} = ${formatHours(hours)}` : parts[0];

  const price = input.price != null && input.price > 0 ? input.price : null;
  const rate = price != null && hours > 0 ? price / hours : null;
  return {
    hours: { value: hours, formula },
    rate:
      rate == null
        ? { value: null, formula: price == null ? 'No price yet' : 'No hours yet' }
        : { value: Math.round(rate), formula: `${formatMoney(price!, currency)} ÷ ${formatHours(hours)}` },
    meetsFloor: rate == null ? null : rate + 1e-9 >= positive(a.minimumRate),
  };
}

/** Floor plus a contingency buffer, rounded to a clean step, never below the floor. */
export function fullScopePrice(floor: number, a: Assumptions, currency: Currency): FixedFigure {
  const step = a.priceStep > 0 ? a.priceStep : 1;
  const pct = Math.max(0, a.contingencyPct);
  const value = Math.max(roundTo(floor * (1 + pct / 100), step), ceilTo(floor, step));
  return {
    value,
    formula: `${formatMoney(floor, currency)} floor + ${pct}% buffer, rounded to ${formatMoney(step, currency)}`,
  };
}

/**
 * Picks work items for a smaller package that fits the offered price at the
 * freelancer's minimum rate. The headline work (what the client actually asked
 * for, like the store itself) is always in: a package without it is not an
 * offer. Hidden work fills the remaining budget, and is the first to go.
 */
export function autoFitStarter(requirements: Requirement[], price: number | null, a: Assumptions): Set<string> {
  const ids = new Set<string>();
  if (price == null || price <= 0 || positive(a.minimumRate) === 0) return ids;
  let budget = price / a.minimumRate - positive(a.commsHours) - count(a.starterRevisionRounds) * positive(a.hoursPerRound);
  const priced = requirements.filter(isPriced);
  for (const r of priced.filter((x) => !x.hidden)) {
    ids.add(r.id);
    budget -= positive(r.starterHours);
  }
  for (const r of priced.filter((x) => x.hidden)) {
    const h = positive(r.starterHours);
    if (h <= budget + 1e-9) {
      ids.add(r.id);
      budget -= h;
    }
  }
  return ids;
}

export interface Recommendation {
  choice: Choice | null;
  headline: string;
  reason: string;
}

export interface DealPackages {
  full: PackageEconomics;
  fullPrice: FixedFigure;
  fullAtPrice: PackageEconomics;
  starter: PackageEconomics;
  starterItems: Requirement[];
  excludedFromStarter: Requirement[];
  inferredCount: number;
  recommendation: Recommendation;
}

export interface DealLike {
  offeredPrice: number | null;
  currency: Currency;
  requirements: Requirement[];
  assumptions: Assumptions;
}

/** Everything the economics and decision screens show, from one place. */
export function dealPackages(deal: DealLike): DealPackages {
  const { assumptions: a, currency, offeredPrice } = deal;
  const priced = deal.requirements.filter(isPriced);
  const full = packageEconomics({
    price: offeredPrice,
    itemHours: priced.map((r) => r.hours),
    revisionRounds: a.revisionRounds,
    assumptions: a,
    currency,
  });
  const fullPrice = fullScopePrice(full.floorPrice.value, a, currency);
  const fullAtPrice = packageEconomics({
    price: fullPrice.value,
    itemHours: priced.map((r) => r.hours),
    revisionRounds: a.revisionRounds,
    assumptions: a,
    currency,
  });
  const starterItems = priced.filter((r) => r.inStarter);
  const starter = packageEconomics({
    price: offeredPrice,
    itemHours: starterItems.map((r) => r.starterHours),
    revisionRounds: a.starterRevisionRounds,
    assumptions: a,
    currency,
  });
  return {
    full,
    fullPrice,
    fullAtPrice,
    starter,
    starterItems,
    excludedFromStarter: priced.filter((r) => !r.inStarter),
    inferredCount: deal.requirements.filter((r) => r.status === 'inferred').length,
    recommendation: recommend({ offeredPrice, full, fullPrice: fullPrice.value, starter, starterCount: starterItems.length, assumptions: a, currency }),
  };
}

interface RecommendInput {
  offeredPrice: number | null;
  full: PackageEconomics;
  fullPrice: number;
  starter: PackageEconomics;
  starterCount: number;
  assumptions: Assumptions;
  currency: Currency;
}

/** Judges the economics only. It never scores the client. */
export function recommend(input: RecommendInput): Recommendation {
  const { full, starter, currency, offeredPrice } = input;
  const min = formatRate(input.assumptions.minimumRate, currency);
  const hours = formatHours(full.totalHours.value);
  if (full.totalHours.value <= 0) {
    return { choice: null, headline: 'Add hours first', reason: 'Give each work item an estimate to see what this deal pays.' };
  }
  if (offeredPrice == null || offeredPrice <= 0) {
    return {
      choice: 'take',
      headline: 'Quote the full scope',
      reason: `No budget was stated. The full scope is ${hours}, which comes to ${formatMoney(input.fullPrice, currency)} at your ${min} minimum with a buffer.`,
    };
  }
  const offered = formatMoney(offeredPrice, currency);
  const rate = full.effectiveRate.value != null ? formatRate(full.effectiveRate.value, currency) : '';
  if (full.meetsFloor) {
    return {
      choice: 'take',
      headline: 'The offer covers the work',
      reason: `${offered} for ${hours} pays ${rate}, at or above your ${min} minimum.`,
    };
  }
  if (input.starterCount > 0 && starter.meetsFloor && starter.effectiveRate.value != null) {
    return {
      choice: 'change',
      headline: 'Change the deal',
      reason: `The full scope pays ${rate} against your ${min} minimum. A smaller package of ${input.starterCount} ${input.starterCount === 1 ? 'item' : 'items'} fits ${offered} at ${formatRate(starter.effectiveRate.value, currency)}, or the full scope costs ${formatMoney(input.fullPrice, currency)}.`,
    };
  }
  return {
    choice: 'walk',
    headline: 'Consider walking away',
    reason: `The full scope pays ${rate}, and no smaller package fits ${offered} at your ${min} minimum. You can still offer the full scope at ${formatMoney(input.fullPrice, currency)}.`,
  };
}
