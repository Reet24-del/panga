import type { Currency } from './types';

const LOCALE: Record<Currency, string> = { INR: 'en-IN', USD: 'en-US', EUR: 'en-IE', GBP: 'en-GB' };
export const CURRENCY_SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const formatters = new Map<Currency, Intl.NumberFormat>();

function formatter(currency: Currency): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE[currency], {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatters.set(currency, f);
  }
  return f;
}

/** Whole currency units, grouped the local way (₹1,00,000 for INR). */
export function formatMoney(amount: number, currency: Currency): string {
  return formatter(currency).format(Math.round(amount) || 0);
}

export function formatRate(amount: number, currency: Currency): string {
  return `${formatMoney(amount, currency)}/h`;
}

export function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export function formatHours(hours: number): string {
  const h = roundHours(hours);
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
