// Number, currency, percent and date formatters.
// Rule (spec section 8): treat "N/A", empty string and null as "no value".
// Never render NaN, Infinity or #N/A — show "Not entered" / "Not available".
import { parse, format as fmtDate, isValid } from 'date-fns';

export const NO_VALUE = 'N/A';

/** True when a value should be treated as "no value" in maths/display. */
export function isNoValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' || t.toUpperCase() === 'N/A' || t === '#N/A';
  }
  if (typeof v === 'number') return !Number.isFinite(v);
  return false;
}

/** Parse a value to a finite number, or null if it is not a usable number. */
export function toNumber(v: unknown): number | null {
  if (isNoValue(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[$,%\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Thousands-separated integer/decimal; returns "Not entered" for no value. */
export function formatNumber(v: unknown, maxFractionDigits = 0): string {
  const n = toNumber(v);
  if (n === null) return 'Not entered';
  return n.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
}

/** $ with 2 decimals. */
export function formatCurrency(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return 'Not entered';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Decimal (0.85) shown as percent (85%). `decimals` controls precision. */
export function formatPercent(v: unknown, decimals = 0): string {
  const n = toNumber(v);
  if (n === null) return 'Not entered';
  return `${(n * 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })}%`;
}

/** ISO (YYYY-MM-DD) -> display MM/DD/YYYY. Passes through "N/A". */
export function formatDate(v: unknown): string {
  if (isNoValue(v)) return typeof v === 'string' && v.trim() ? 'N/A' : 'Not entered';
  const iso = String(v);
  const d = parse(iso.slice(0, 10), 'yyyy-MM-dd', new Date());
  if (!isValid(d)) return String(v);
  return fmtDate(d, 'MM/dd/yyyy');
}

/** Parse an ISO date string to a Date, or null. */
export function parseISO(v: unknown): Date | null {
  if (isNoValue(v)) return null;
  const d = parse(String(v).slice(0, 10), 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
}

/** Today's date as ISO (YYYY-MM-DD). */
export function todayISO(): string {
  return fmtDate(new Date(), 'yyyy-MM-dd');
}
