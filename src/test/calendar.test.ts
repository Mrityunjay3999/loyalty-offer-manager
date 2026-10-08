import { describe, it, expect } from 'vitest';
import { eachDayOfInterval, startOfMonth } from 'date-fns';
import {
  toCalendarOffers, offersMissingDates, countForDay, runsOnDay, applyFilters,
  offersInRange, EMPTY_FILTERS, type CalendarFilters,
} from '@/lib/calendar';
import type { OfferRecord } from '@/lib/types';

const base = (over: Partial<OfferRecord>): OfferRecord => ({
  _uid: 'u1', offerId: 1, offerName: 'A', buildStatus: 'Live',
  startDate: '2026-03-01', endDate: '2026-03-10', broadVsTargeted: 'Broad',
  ...over,
});
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const filters = (over: Partial<CalendarFilters> = {}): CalendarFilters => ({ ...EMPTY_FILTERS, ...over });

describe('Calendar: run window', () => {
  it('an offer 3/1–3/10 counts on exactly 10 days, both ends included', () => {
    const cos = toCalendarOffers([base({})]);
    const days = eachDayOfInterval({ start: d(2026, 2, 25), end: d(2026, 3, 15) });
    const counted = days.filter((day) => countForDay(cos, day, false).total > 0);
    expect(counted.length).toBe(10);
    expect(countForDay(cos, d(2026, 3, 1), false).total).toBe(1);
    expect(countForDay(cos, d(2026, 3, 10), false).total).toBe(1);
    expect(countForDay(cos, d(2026, 2, 28), false).total).toBe(0);
    expect(countForDay(cos, d(2026, 3, 11), false).total).toBe(0);
  });

  it('day count = Broad + Targeted + N/A', () => {
    const cos = toCalendarOffers([
      base({ _uid: 'a', broadVsTargeted: 'Broad' }),
      base({ _uid: 'b', broadVsTargeted: 'Targeted' }),
      base({ _uid: 'c', broadVsTargeted: 'N/A' }),
    ]);
    const c = countForDay(cos, d(2026, 3, 5), false);
    expect(c.total).toBe(c.Broad + c.Targeted + c.Other);
    expect([c.Broad, c.Targeted, c.Other]).toEqual([1, 1, 1]);
  });
});

describe('Calendar: inclusion', () => {
  it('Draft and Cancelled offers are never counted or drawn', () => {
    const cos = toCalendarOffers([
      base({ _uid: 'a', buildStatus: 'Draft' }),
      base({ _uid: 'b', buildStatus: 'Cancelled' }),
      base({ _uid: 'c', buildStatus: 'Live' }),
    ]);
    expect(cos.map((c) => c.o._uid)).toEqual(['c']);
    expect(countForDay(cos, d(2026, 3, 5), false).total).toBe(1);
  });

  it('an offer with no start or end date is not drawn and is listed as missing', () => {
    const offers = [base({ _uid: 'ok' }), base({ _uid: 'no', endDate: '' })];
    expect(toCalendarOffers(offers).map((c) => c.o._uid)).toEqual(['ok']);
    expect(offersMissingDates(offers).map((o) => o._uid)).toEqual(['no']);
  });

  it('a grouped offer is drawn once (children are not separate offers)', () => {
    const cos = toCalendarOffers([base({ _uid: 'g', groupedOffer: 'Yes' })]);
    expect(cos.length).toBe(1);
  });
});

describe('Calendar: early activation', () => {
  it('with the toggle on, early 2/26 + start 3/1 also counts on 2/26, 2/27, 2/28', () => {
    const cos = toCalendarOffers([base({ earlyActivationDate: '2026-02-26' })]);
    for (const day of [d(2026, 2, 26), d(2026, 2, 27), d(2026, 2, 28)]) {
      expect(runsOnDay(cos[0], day, true).runs).toBe(true);
      expect(runsOnDay(cos[0], day, true).early).toBe(true);
      expect(runsOnDay(cos[0], day, false).runs).toBe(false); // off by default
    }
    // the start day itself is a normal (non-early) run day
    expect(runsOnDay(cos[0], d(2026, 3, 1), true)).toEqual({ runs: true, early: false });
  });
});

describe('Calendar: live edits are reflected', () => {
  it('submitting a draft adds it; cancelling removes it', () => {
    const draft = base({ _uid: 'x', buildStatus: 'Draft' });
    expect(toCalendarOffers([draft]).length).toBe(0);
    const proposed = { ...draft, buildStatus: 'Proposed' };
    expect(toCalendarOffers([proposed]).length).toBe(1);
    const cancelled = { ...proposed, buildStatus: 'Cancelled' };
    expect(toCalendarOffers([cancelled]).length).toBe(0);
  });

  it('extending End 3/10 -> 3/12 adds the offer to 3/11 and 3/12', () => {
    const before = toCalendarOffers([base({})]);
    expect(countForDay(before, d(2026, 3, 11), false).total).toBe(0);
    const after = toCalendarOffers([base({ endDate: '2026-03-12' })]);
    expect(countForDay(after, d(2026, 3, 11), false).total).toBe(1);
    expect(countForDay(after, d(2026, 3, 12), false).total).toBe(1);
  });

  it('changing Broad -> Targeted moves the offer between counts', () => {
    const broad = countForDay(toCalendarOffers([base({ broadVsTargeted: 'Broad' })]), d(2026, 3, 5), false);
    expect([broad.Broad, broad.Targeted]).toEqual([1, 0]);
    const targeted = countForDay(toCalendarOffers([base({ broadVsTargeted: 'Targeted' })]), d(2026, 3, 5), false);
    expect([targeted.Broad, targeted.Targeted]).toEqual([0, 1]);
  });
});

describe('Calendar: filters + navigation', () => {
  it('filters reduce the counts', () => {
    const cos = toCalendarOffers([
      base({ _uid: 'us', country: 'US' }),
      base({ _uid: 'ca', country: 'CA' }),
    ]);
    expect(countForDay(cos, d(2026, 3, 5), false).total).toBe(2);
    const filtered = applyFilters(cos, filters({ country: 'US' }));
    expect(filtered.length).toBe(1);
    expect(countForDay(filtered, d(2026, 3, 5), false).total).toBe(1);
  });

  it('"View on calendar" resolves the offer and its start month for highlight', () => {
    const cos = toCalendarOffers([base({ _uid: 'target', startDate: '2026-03-04', endDate: '2026-03-20' })]);
    const target = cos.find((c) => c.o._uid === 'target')!;
    expect(startOfMonth(target.start).getTime()).toBe(startOfMonth(d(2026, 3, 1)).getTime());
    expect(offersInRange(cos, target.start, target.end).some((c) => c.o._uid === 'target')).toBe(true);
  });
});
