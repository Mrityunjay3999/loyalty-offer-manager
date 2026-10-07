import { describe, it, expect } from 'vitest';
import {
  computeResultsForecast,
  inResultsForecast,
  roundTripTotals,
  excelRound,
} from '@/lib/resultsForecast';
import { computedFieldValue, forecastNeeded } from '@/lib/calculations';
import type { OfferRecord } from '@/lib/types';

const base: OfferRecord = {
  startDate: '2026-03-01',
  endDate: '2026-03-10',
  offerDesign: 'Multiplier',
  multiplier: '3X',
  buildStatus: 'Live',
  activationByDayLow: 1000,
  activationByDayHigh: 1500,
  bonusRateLow: 0.08,
  bonusRateHigh: 0.12,
  avgSpendPerTxnLow: 40,
  avgSpendPerTxnHigh: 55,
};

describe('rf worked example — FORECAST block (B3)', () => {
  const rf = computeResultsForecast(base);
  it('activation / averages / W', () => {
    expect(rf.activationLow).toBe(10000); // AF
    expect(rf.activationHigh).toBe(15000); // AG
    expect(rf.activationAvg).toBe(12500); // AL
    expect(rf.bonusRateAvg).toBeCloseTo(0.1, 6); // AM
    expect(rf.bonusPointCalc).toBe(2); // W
  });
  it('bonused members / spend', () => {
    expect(rf.bonusedMembersLow).toBe(800); // AN
    expect(rf.bonusedMembersHigh).toBe(1800); // AO
    expect(rf.bonusedMembersAvg).toBe(1300); // AP
    expect(rf.spendPerTxnAvg).toBe(47.5); // AQ
    expect(rf.bonusedSalesLow).toBe(32000); // AR
    expect(rf.bonusedSalesHigh).toBe(99000); // AS
    expect(rf.bonusedSalesAvg).toBe(65500); // AT
  });
  it('base / bonus points', () => {
    expect(rf.basePointsLow).toBe(320000); // AU
    expect(rf.basePointsHigh).toBe(990000); // AV
    expect(rf.basePointsAvg).toBe(655000); // AW
    expect(rf.bonusPointsLow).toBe(640000); // AX
    expect(rf.bonusPointsHigh).toBe(1980000); // AY
    expect(rf.bonusPointsAvg).toBe(1310000); // AZ
  });
  it('redeemable / breakage / JBP', () => {
    expect(rf.basePointsRedeemableLow).toBe(640); // BA
    expect(rf.basePointsRedeemableHigh).toBe(1980); // BB
    expect(rf.bonusPointsRedeemableLow).toBe(1280); // BC
    expect(rf.bonusPointsRedeemableHigh).toBe(3960); // BD
    expect(rf.bonusPointsRedeemableAvg).toBe(2620); // BE
    expect(rf.redemptionRateForecast).toBe(0.88); // BF
    expect(rf.bonusRedeemableLow).toBeCloseTo(1126.4, 4); // BG
    expect(rf.bonusRedeemableHigh).toBeCloseTo(3484.8, 4); // BH
    expect(rf.bonusRedeemableAvg).toBeCloseTo(2305.6, 4); // BI
    expect(rf.jbpLow).toBe(1920); // BJ
    expect(rf.jbpHigh).toBe(5940); // BK
    expect(rf.jbpAvg).toBe(3930); // BL
  });
  it('forecast WBR strings', () => {
    expect(rf.wbrOfferPeriod).toBe('3/1-3/10'); // BM
    expect(rf.wbrFcstActivations).toBe('12.5K'); // BN
    expect(rf.wbrFcstBonused).toBe('1K (10%)'); // BO
    expect(rf.wbrFcstSpend).toBe('$48'); // BP
    expect(rf.wbrFcstBonusPts).toBe('1M ($2K)'); // BQ
  });
  it('Step 7 round trip (B4) and forecastNeeded', () => {
    expect(computedFieldValue('bonusedMembersLow', base)).toBe(800);
    expect(computedFieldValue('bonusedSalesHigh', base)).toBe(99000);
    expect(computedFieldValue('bonusRedeemableLow', base)).toBeCloseTo(1126.4, 4);
    expect(forecastNeeded(base)).toBe('No');
  });
});

describe('rf worked example — RESULTS block (B3)', () => {
  const withResults: OfferRecord = {
    ...base,
    audienceSize: 200000,
    activations: 12000,
    bonusedMembers: 1500,
    bonusPtsIssued: 1200000,
  };
  const rf = computeResultsForecast(withResults, new Date('2026-03-06T00:00:00'));
  it('actual metrics', () => {
    expect(rf.bonusRate).toBeCloseTo(0.125, 6); // U
    expect(rf.bonusedSales).toBe(60000); // Y
    expect(rf.basePoints).toBe(600000); // Z
    expect(rf.basePointsRedeemable).toBe(1200); // AA
    expect(rf.bonusPointsRedeemable).toBe(2400); // AB
    expect(rf.redemptionRateResults).toBe(0.88); // AC
    expect(rf.bonusRedeemableWithBreakage).toBeCloseTo(2112, 4); // AD
    expect(rf.spendPerBonusedMember).toBe(40); // AE
  });
  it('actual WBR strings', () => {
    expect(rf.wbrActActivations).toBe('12K'); // BR
    expect(rf.wbrActBonused).toBe('2K (13%)'); // BS
    expect(rf.wbrActSpend).toBe('$40'); // BT
    expect(rf.wbrActBonusPts).toBe('1M ($2K)'); // BU
    expect(rf.wbrActBonusedSales).toBe('$60K'); // BV
  });
  it('prorated + colour code (today 3/6)', () => {
    expect(rf.daysElapsed).toBe(5); // BW
    expect(rf.pctComplete).toBeCloseTo(0.5, 6); // BX
    expect(rf.proratedPts).toBe(2400000); // BY
    expect(rf.colourCode).toBe('Dark Green'); // BZ
  });
});

describe('rf edge cases', () => {
  it('Cancelled: bonus points 0 and excluded from the module', () => {
    const c = { ...base, buildStatus: 'Cancelled' };
    const rf = computeResultsForecast(c);
    expect(rf.bonusPointsLow).toBe(0);
    expect(rf.bonusPointsHigh).toBe(0);
    expect(inResultsForecast(c)).toBe(false);
    expect(roundTripTotals(c).bonusedMembersLow).toBe(0);
  });
  it('Fixed Point: W = fixedPoints, Y = TBD, BT = TBD', () => {
    const fp = { ...base, offerDesign: 'Fixed Point', fixedPoints: 500, multiplier: 'N/A' };
    const rf = computeResultsForecast(fp);
    expect(rf.bonusPointCalc).toBe(500);
    expect(rf.bonusPointsLow).toBe(400000); // AN x 500 = 800 x 500
    expect(rf.bonusedSales).toBe('TBD');
    expect(rf.wbrActSpend).toBe('TBD');
  });
  it('IMP only is excluded', () => {
    expect(inResultsForecast({ ...base, offerDesign: 'IMP only' })).toBe(false);
  });
});

describe('rf redemption rate (forecast rule) and excelRound', () => {
  it('100% for donations / extra entries / LTBO; date bands otherwise', () => {
    expect(computeResultsForecast({ ...base, offerDesign: 'Points donations' }).redemptionRateForecast).toBe(1);
    expect(computeResultsForecast({ ...base, offerDesign: 'Extra entries' }).redemptionRateForecast).toBe(1);
    expect(computeResultsForecast({ ...base, offerDesign: 'Limited Time Bonus Offer' }).redemptionRateForecast).toBe(1);
    expect(computeResultsForecast({ ...base, startDate: '2025-09-30' }).redemptionRateForecast).toBe(0.85);
    expect(computeResultsForecast({ ...base, startDate: '2025-10-01' }).redemptionRateForecast).toBe(0.88);
  });
  it('excelRound is half away from zero', () => {
    expect(excelRound(2.5, 0)).toBe(3);
    expect(excelRound(-2.5, 0)).toBe(-3);
    expect(excelRound(12.5, 0)).toBe(13);
  });
});
