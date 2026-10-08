// Calendar view logic (Part 1). Pure functions over the live offer records so
// the /calendar page stays a read-only projection of the store — it owns no
// data of its own. Draft and Cancelled offers are excluded, exactly as on the
// Offer View. Grouped offers are drawn once from the parent's own dates; child
// promotions live in a separate store slice and are never drawn here.
import { format } from 'date-fns';
import { reference } from './dataLoaders';
import { statusOf } from './lifecycle';
import { parseISO } from './format';
import type { OfferRecord } from './types';

export type ColourGroup = 'Broad' | 'Targeted' | 'Other';

/** Broad = teal, Targeted = indigo, N/A/empty = grey (business-chosen palette). */
export const GROUP_COLOURS: Record<ColourGroup, string> = {
  Broad: '#2C6E76',
  Targeted: '#4F46E5',
  Other: '#B9C0C4',
};
export const GROUP_LABELS: Record<ColourGroup, string> = {
  Broad: 'Broad',
  Targeted: 'Targeted',
  Other: 'N/A',
};

type FiscalRow = { fw: string; fm: string; fy: number };
const FISCAL = reference.fiscalCalendar as unknown as Record<string, FiscalRow>;

export function isoOf(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Fiscal week label (e.g. "FW39") for a date, or '' when outside the calendar. */
export function fiscalWeekOf(d: Date): string {
  return FISCAL[isoOf(d)]?.fw ?? '';
}
/** Fiscal year for a date, or null when outside the calendar. */
export function fiscalYearOfDate(d: Date): number | null {
  return FISCAL[isoOf(d)]?.fy ?? null;
}

export function colourGroup(o: OfferRecord): ColourGroup {
  if (o.broadVsTargeted === 'Broad') return 'Broad';
  if (o.broadVsTargeted === 'Targeted') return 'Targeted';
  return 'Other';
}

/** An offer with its parsed, midnight-normalised run window. */
export interface CalendarOffer {
  o: OfferRecord;
  start: Date;
  end: Date;
  early: Date | null; // early-activation date, if before start
  group: ColourGroup;
  status: string;
}

function midnight(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

/** Is an offer part of the calendar at all? (not Draft, not Cancelled) */
export function inCalendar(o: OfferRecord): boolean {
  const s = statusOf(o);
  return s !== 'Draft' && s !== 'Cancelled';
}

/**
 * Build the drawable calendar offers: included offers that have both a start
 * and an end date. Early-activation date is kept only when it is before start.
 */
export function toCalendarOffers(offers: OfferRecord[]): CalendarOffer[] {
  const out: CalendarOffer[] = [];
  for (const o of offers) {
    if (!inCalendar(o)) continue;
    const s = parseISO(o.startDate);
    const e = parseISO(o.endDate);
    if (!s || !e) continue;
    const ea = parseISO(o.earlyActivationDate);
    const start = midnight(s);
    const end = midnight(e);
    const early = ea && midnight(ea) < start ? midnight(ea) : null;
    out.push({ o, start, end, early, group: colourGroup(o), status: statusOf(o) });
  }
  return out;
}

/** Included offers that cannot be drawn because a start or end date is missing. */
export function offersMissingDates(offers: OfferRecord[]): OfferRecord[] {
  return offers.filter((o) => inCalendar(o) && (!parseISO(o.startDate) || !parseISO(o.endDate)));
}

/** Does this offer run on `day`? `early` is true when the day is an early-activation day. */
export function runsOnDay(
  co: CalendarOffer,
  day: Date,
  includeEarly: boolean,
): { runs: boolean; early: boolean } {
  const d = midnight(day);
  if (d >= co.start && d <= co.end) return { runs: true, early: false };
  if (includeEarly && co.early && d >= co.early && d < co.start) return { runs: true, early: true };
  return { runs: false, early: false };
}

export interface DayCount {
  total: number;
  Broad: number;
  Targeted: number;
  Other: number;
  early: number; // how many of `total` are early-activation days (drawn hatched)
}

/** Count offers (and the Broad/Targeted/Other split) running on a given day. */
export function countForDay(
  cos: CalendarOffer[],
  day: Date,
  includeEarly: boolean,
): DayCount {
  const c: DayCount = { total: 0, Broad: 0, Targeted: 0, Other: 0, early: 0 };
  for (const co of cos) {
    const r = runsOnDay(co, day, includeEarly);
    if (!r.runs) continue;
    c.total += 1;
    c[co.group] += 1;
    if (r.early) c.early += 1;
  }
  return c;
}

/** Offers running on a given day, sorted by start date then name. */
export function offersOnDay(
  cos: CalendarOffer[],
  day: Date,
  includeEarly: boolean,
): CalendarOffer[] {
  return cos
    .filter((co) => runsOnDay(co, day, includeEarly).runs)
    .sort((a, b) => +a.start - +b.start || String(a.o.offerName ?? '').localeCompare(String(b.o.offerName ?? '')));
}

/** Inclusive day count of an offer's run window (ignores early activation). */
export function runLengthDays(co: CalendarOffer): number {
  return Math.round((+co.end - +co.start) / 86400000) + 1;
}

export interface PeriodSummary {
  offersInPeriod: number;
  busiestDay: { date: Date; count: number } | null;
  avgPerDay: number;
  Broad: number;
  Targeted: number;
  Other: number;
}

/** Summary stats for the visible days (above the grid). */
export function periodSummary(
  cos: CalendarOffer[],
  days: Date[],
  includeEarly: boolean,
): PeriodSummary {
  const inPeriod = new Set<string>();
  let busiest: { date: Date; count: number } | null = null;
  let runningTotal = 0;
  let b = 0;
  let t = 0;
  let o = 0;
  for (const day of days) {
    const c = countForDay(cos, day, includeEarly);
    runningTotal += c.total;
    if (!busiest || c.total > busiest.count) busiest = { date: day, count: c.total };
  }
  for (const co of cos) {
    // "offers in period" = offers that run on at least one visible day
    if (days.some((d) => runsOnDay(co, d, includeEarly).runs)) {
      inPeriod.add(co.o._uid ?? String(co.o.offerId));
      if (co.group === 'Broad') b += 1;
      else if (co.group === 'Targeted') t += 1;
      else o += 1;
    }
  }
  return {
    offersInPeriod: inPeriod.size,
    busiestDay: busiest && busiest.count > 0 ? busiest : null,
    avgPerDay: days.length ? runningTotal / days.length : 0,
    Broad: b,
    Targeted: t,
    Other: o,
  };
}

export interface CalendarFilters {
  country: string;
  offerTiering: string;
  offerDesign: string;
  category: string;
  subCategory: string;
  broadVsTargeted: string;
  channel: string;
  status: string[]; // multi
  fiscalYear: string;
}

export const EMPTY_FILTERS: CalendarFilters = {
  country: '',
  offerTiering: '',
  offerDesign: '',
  category: '',
  subCategory: '',
  broadVsTargeted: '',
  channel: '',
  status: [],
  fiscalYear: '',
};

/** Apply the personal filters to calendar offers. */
export function applyFilters(cos: CalendarOffer[], f: CalendarFilters): CalendarOffer[] {
  return cos.filter((co) => {
    const o = co.o;
    if (f.country && o.country !== f.country) return false;
    if (f.offerTiering && o.offerTiering !== f.offerTiering) return false;
    if (f.offerDesign && o.offerDesign !== f.offerDesign) return false;
    if (f.category && o.category !== f.category) return false;
    if (f.subCategory && o.subCategory !== f.subCategory) return false;
    if (f.broadVsTargeted && o.broadVsTargeted !== f.broadVsTargeted) return false;
    if (f.channel && o.channel !== f.channel) return false;
    if (f.status.length && !f.status.includes(co.status)) return false;
    if (f.fiscalYear && String(fiscalYearOfDate(co.start) ?? '') !== f.fiscalYear) return false;
    return true;
  });
}
