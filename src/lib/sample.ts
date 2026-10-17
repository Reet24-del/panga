import sample from './sample-deal.json';
import type { Currency, SourceKind } from './types';

/** An example deal for trying Panga. Fictional client, clearly labelled in the UI. */
export const SAMPLE_DEAL: {
  title: string;
  currency: Currency;
  sources: { kind: SourceKind; label: string; text: string }[];
} = {
  title: sample.title,
  currency: sample.currency as Currency,
  sources: sample.sources.map((s) => ({ kind: s.kind as SourceKind, label: s.label, text: s.text })),
};
