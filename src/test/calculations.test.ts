import { describe, it, expect } from 'vitest';
import {
  fiscalWeek,
  softLockDate,
  numberOfDays,
  totalOfferDays,
  activationLow,
  bonusPointFactor,
  redemptionRate,
  computeForecast,
  includeForMetadata,
  includeForResultsForecast,
  forecastNeeded,
} from '@/lib/calculations';
import type { OfferRecord } from '@/lib/types';

const base = (o: Partial<OfferRecord>): OfferRecord => ({ ...o });

describe('section 14 worked checks — calendar computed', () => {
  it('Start 2025-11-01 gives Fiscal Week FW39 and Soft Lock 2025-09-04', () => {
    const o = base({ startDate: '2025-11-01' });
    expect(fiscalWeek(o)).toBe('FW39');
    expect(softLockDate(o)).toBe('2025-09-04');
  });

  it('Start 2025-11-01, End 2026-10-31 gives # of Days 365', () => {
    expect(numberOfDays(base({ startDate: '2025-11-01', endDate: '2026-10-31' }))).toBe(365);
  });

  it('Early Activation N/A, 2025-12-01→2026-01-31 gives 62 total days; act/day 25 → 1,550', () => {
    const o = base({
      startDate: '2025-12-01',
      endDate: '2026-01-31',
      earlyActivationDate: 'N/A',
      activationByDayLow: 25,
    });
    expect(totalOfferDays(o)).toBe(62);
    expect(activationLow(o)).toBe(1550);
  });

  it('totalOfferDays uses early activation date when present', () => {
    const o = base({
      startDate: '2025-12-10',
      endDate: '2025-12-31',
      earlyActivationDate: '2025-12-01',
    });
    // 2025-12-01 .. 2025-12-31 inclusive = 31
    expect(totalOfferDays(o)).toBe(31);
  });
});

describe('section 14 worked checks — factors & redemption', () => {
  it('Multiplier "3X" gives factor 2', () => {
    expect(bonusPointFactor(base({ offerDesign: 'Multiplier', multiplier: '3X' }))).toBe(2);
  });
  it('Fixed Point 2500 gives factor 2500', () => {
    expect(bonusPointFactor(base({ offerDesign: 'Fixed Point', fixedPoints: 2500 }))).toBe(2500);
  });
  it('Points donations gives redemption 100%', () => {
    expect(redemptionRate(base({ offerDesign: 'Points donations', startDate: '2026-01-01' }))).toBe(1);
  });
  it('Multiplier on/after 2025-10-01 gives 88%, earlier gives 85%', () => {
    expect(redemptionRate(base({ offerDesign: 'Multiplier', startDate: '2025-10-01' }))).toBe(0.88);
    expect(redemptionRate(base({ offerDesign: 'Multiplier', startDate: '2025-09-30' }))).toBe(0.85);
  });
});

describe('section 14 worked checks — redeemable dollars', () => {
  it('1,000,000 bonus points gives $2,000 redeemable at 100%', () => {
    // Points donations => rate 100%; W = fixedPoints; 1 day; 100 activations; 100% bonus rate
    const o = base({
      offerDesign: 'Points donations',
      startDate: '2025-12-01',
      endDate: '2025-12-01',
      earlyActivationDate: 'N/A',
      activationByDayLow: 100,
      bonusRateLow: 1,
      fixedPoints: 10000,
      avgSpendPerTxnLow: 10,
    });
    const f = computeForecast(o);
    expect(f.bonusPointsLow).toBe(1_000_000);
    expect(f.redemptionRate).toBe(1);
    expect(f.bonusPointsRedeemableLow).toBe(2000);
    expect(f.bonusRedeemableLow).toBe(2000);
  });
});

describe('section 14 worked checks — cancelled offer', () => {
  it('Cancelled: bonus points forecast 0 and excluded from metadata/WBR', () => {
    const o = base({
      buildStatus: 'Cancelled',
      offerDesign: 'Multiplier',
      multiplier: '3X',
      startDate: '2026-01-01',
      endDate: '2026-01-10',
      activationByDayLow: 100,
      activationByDayHigh: 200,
      bonusRateLow: 0.5,
      bonusRateHigh: 0.6,
      avgSpendPerTxnLow: 30,
      avgSpendPerTxnHigh: 35,
    });
    const f = computeForecast(o);
    expect(f.bonusPointsLow).toBe(0);
    expect(f.bonusPointsHigh).toBe(0);
    expect(includeForMetadata(o)).toBe('No');
    expect(includeForResultsForecast(o)).toBe('No');
    expect(forecastNeeded(o)).toBe('No');
  });

  it('IMP only is excluded from results & forecast but included in metadata', () => {
    const o = base({ buildStatus: 'Live', offerDesign: 'IMP only' });
    expect(includeForResultsForecast(o)).toBe('No');
    expect(includeForMetadata(o)).toBe('Yes');
  });
});

describe('no NaN / Infinity leaks', () => {
  it('empty offer yields nulls, never NaN', () => {
    const f = computeForecast(base({}));
    for (const v of Object.values(f)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
    expect(f.activationLow).toBeNull();
    expect(numberOfDays(base({}))).toBeNull();
  });
});

describe('forecastNeeded (case-insensitive, per spec 8.2/15.4)', () => {
  it('MERCH with no forecast $ needs a forecast', () => {
    expect(forecastNeeded(base({ category: 'MERCH', offerDesign: 'Fixed Point' }))).toBe('Yes');
  });
  it('Activation Only - Internal Reward never needs a forecast', () => {
    expect(
      forecastNeeded(base({ category: 'MERCH', offerDesign: 'Activation Only - Internal Reward' })),
    ).toBe('No');
  });
  it('BENEFIT + BIRTHDAY needs a forecast', () => {
    expect(forecastNeeded(base({ category: 'BENEFIT', subCategory: 'BIRTHDAY' }))).toBe('Yes');
  });
});
