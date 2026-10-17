import type { Assumptions, Category, Requirement } from './types';

export function req(id: string, hours: number, overrides: Partial<Requirement> = {}): Requirement {
  return {
    id,
    title: `Item ${id}`,
    detail: '',
    category: 'build' as Category,
    hidden: false,
    evidence: [{ sourceId: 'S1', quote: `quote for ${id}`, start: 0, end: 5 }],
    status: 'confirmed',
    confirmedWithoutQuote: false,
    hours,
    hoursSource: 'freelancer',
    suggestedHours: hours,
    inStarter: false,
    starterHours: hours,
    research: null,
    addedBy: 'panga',
    ...overrides,
  };
}

/** Assumptions from the PRD's worked example: ₹700/h, 2 rounds × 3 h, no separate comms. */
export const PRD_ASSUMPTIONS: Assumptions = {
  minimumRate: 700,
  commsHours: 0,
  revisionRounds: 2,
  starterRevisionRounds: 1,
  hoursPerRound: 3,
  contingencyPct: 8,
  priceStep: 1000,
  updateHoursPerMonth: 4,
};
