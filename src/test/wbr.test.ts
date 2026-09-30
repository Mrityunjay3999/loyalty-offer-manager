import { describe, it, expect } from 'vitest';
import {
  actualActivations,
  forecastActivationsK,
  forecastBonusedMemberRate,
  forecastBonusPts,
  pointsMD,
  dollarsMD,
  offerPeriod,
  colourCode,
  proratedPoints,
  percentComplete,
} from '@/lib/wbr';

describe('WBR strings (section 8.5)', () => {
  it('7,763 activations shows "8K" (actual)', () => {
    expect(actualActivations(7763)).toBe('8K');
  });
  it('actual activations >= 1M uses 2 decimals + M', () => {
    expect(actualActivations(1_234_000)).toBe('1.23M');
  });
  it('actual activations < 1000 is an integer', () => {
    expect(actualActivations(842)).toBe('842');
  });
  it('forecast activations (thousands) floors to 1 dp + K', () => {
    expect(forecastActivationsK(7763)).toBe('7.7K');
    expect(forecastActivationsK(null)).toBe('');
  });
  it('forecast bonused member & rate formats N (R%)', () => {
    // 500 members, 65% rate -> "500 (65%)"
    expect(forecastBonusedMemberRate(500, 0.65)).toBe('500 (65%)');
    // rate < 10% gets one decimal
    expect(forecastBonusedMemberRate(1500, 0.045)).toBe('2K (4.5%)');
    // zero rate
    expect(forecastBonusedMemberRate(100, 0)).toBe('100 (0%)');
  });
  it('points and dollars MD formatting', () => {
    expect(pointsMD(1_200_000_000)).toBe('1.2B');
    expect(pointsMD(12_000_000)).toBe('12M');
    expect(pointsMD(120_000)).toBe('120K');
    expect(dollarsMD(1_200_000)).toBe('$1.2M');
    expect(dollarsMD(120_000)).toBe('$120K');
  });
  it('forecast bonus pts is N/A when zero', () => {
    expect(forecastBonusPts(0, 0)).toBe('N/A');
    expect(forecastBonusPts(12_000_000, 120_000)).toBe('12M ($120K)');
  });
  it('offer period M/d-M/d', () => {
    expect(offerPeriod('2026-03-23', '2026-03-29')).toBe('3/23-3/29');
  });
});

describe('WBR colour code (section 8.5)', () => {
  it('blank when no prorated or no forecast', () => {
    expect(colourCode(null, 100, 200)).toBe('');
    expect(colourCode(150, null, null)).toBe('');
  });
  it('Pink when prorated below low', () => {
    expect(colourCode(90, 100, 200)).toBe('Pink');
  });
  it('Dark Green when prorated above high', () => {
    expect(colourCode(250, 100, 200)).toBe('Dark Green');
  });
  it('Light Green when within range', () => {
    expect(colourCode(150, 100, 200)).toBe('Light Green');
  });
});

describe('WBR proration', () => {
  it('prorated points project the full period', () => {
    const pct = percentComplete(5, 10); // 50%
    expect(pct).toBe(0.5);
    expect(proratedPoints(1000, pct)).toBe(2000);
  });
});
