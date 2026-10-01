import { describe, it, expect } from 'vitest';
import {
  offerStatus,
  earlyActivationDays,
  redemptionRateActual,
  txnRefFixedPointBack,
  txnRefUploadPts,
  txnRefRemovePts,
  activationDuringPromo,
  spendPerUniqueBonusedMember,
  pointsIssuedPerDay,
  redemptionPts,
  redemptionPtsValue,
  currency,
  recordDateActivations,
  recordDateBonus,
  multipleDivisions,
  divisionCountLess1,
  sumPtsIfMultiple,
  sumRedeemableIfMultiple,
  divisionShareCheck,
  promoBonusPtsPerDollar,
  eligibleForReversal,
  promoDaysProrated,
  activationPerDayProrated,
  bonusPtsPerDayProrated,
  computeResults,
  resolveCalendarFieldValue,
  NOT_CAPTURED,
} from '@/lib/calculations';
import { metadataFields, reference } from '@/lib/dataLoaders';
import type { OfferRecord } from '@/lib/types';

const o = (p: Partial<OfferRecord>): OfferRecord => ({ ...p });

describe('§8.6 currency', () => {
  it('CAN -> CAD, USPR -> USD, US -> USD, mixed -> Blended', () => {
    expect(currency(o({ country: 'CAN' }))).toBe('CAD');
    expect(currency(o({ country: 'USPR' }))).toBe('USD');
    expect(currency(o({ country: 'US' }))).toBe('USD');
    expect(currency(o({ country: 'US, CAN' }))).toBe('Blended');
    expect(currency(o({ country: 'USPR, CAN' }))).toBe('Blended');
  });
});

describe('§8.6 record dates', () => {
  it('endDate 2026-03-31 -> +1 and +5', () => {
    const rec = o({ endDate: '2026-03-31' });
    expect(recordDateActivations(rec)).toBe('2026-04-01');
    expect(recordDateBonus(rec)).toBe('2026-04-05');
  });
  it('no end date -> null', () => {
    expect(recordDateActivations(o({}))).toBeNull();
  });
});

describe('§8.6 multiple divisions', () => {
  it('2 Yes -> Yes, count less 1 = 1, sums scale by that', () => {
    const rec = o({ hardgoodsOffer: 'Yes', consumablesOffer: 'Yes', bonusPtsIssued: 1000 });
    expect(multipleDivisions(rec)).toBe('Yes');
    expect(divisionCountLess1(rec)).toBe(1);
    expect(sumPtsIfMultiple(rec)).toBe(1000);
    expect(typeof sumRedeemableIfMultiple(rec)).toBe('number');
    expect(divisionShareCheck(rec)).toBe(NOT_CAPTURED);
  });
  it('1 Yes -> No, counts 0, Check N/A', () => {
    const rec = o({ hardgoodsOffer: 'Yes', bonusPtsIssued: 1000 });
    expect(multipleDivisions(rec)).toBe('No');
    expect(divisionCountLess1(rec)).toBe(0);
    expect(sumPtsIfMultiple(rec)).toBe(0);
    expect(sumRedeemableIfMultiple(rec)).toBe(0);
    expect(divisionShareCheck(rec)).toBe('N/A');
  });
});

describe('§8.6 actual redemption rate bands', () => {
  it('LTBO and REDEMPTION give 100%', () => {
    expect(redemptionRateActual(o({ offerDesign: 'Limited Time Bonus Offer', startDate: '2020-01-01' }))).toBe(1);
    expect(redemptionRateActual(o({ category: 'REDEMPTION', startDate: '2020-01-01' }))).toBe(1);
  });
  it('date bands: >=2025-10-01 -> .88, >=2024-11-01 -> .85, else .80', () => {
    expect(redemptionRateActual(o({ startDate: '2025-10-01' }))).toBe(0.88);
    expect(redemptionRateActual(o({ startDate: '2025-09-30' }))).toBe(0.85);
    expect(redemptionRateActual(o({ startDate: '2024-11-01' }))).toBe(0.85);
    expect(redemptionRateActual(o({ startDate: '2024-10-31' }))).toBe(0.8);
  });
  it('computeResults breakage uses the ACTUAL rate', () => {
    // Multiplier 3X (W=2), 1,000,000 bonus pts, start 2026-01-01 -> actual rate 0.88
    const rec = o({ offerDesign: 'Multiplier', multiplier: '3X', startDate: '2026-01-01', bonusPtsIssued: 1_000_000 });
    const r = computeResults(rec);
    expect(r.bonusPointsRedeemableActual).toBe(2000);
    expect(r.bonusRedeemableActualWithBreakage).toBeCloseTo(1760, 6); // 0.88 * 2000
  });
});

describe('§8.6 transaction-type ref lookups', () => {
  it('found returns the external ref; not found returns blank', () => {
    const t0 = reference.transactionTypes[0];
    const t1 = reference.transactionTypes[1];
    const t2 = reference.transactionTypes[2];
    const rec = o({
      txnTypeFixedPointBack: String(t0['Transaction Type']),
      txnTypeUploadPts: String(t1['Transaction Type']),
      txnTypeRemovePts: String(t2['Transaction Type']),
    });
    expect(txnRefFixedPointBack(rec)).toBe(String(t0['Transaction Type External Ref']));
    expect(txnRefUploadPts(rec)).toBe(String(t1['Transaction Type External Ref']));
    expect(txnRefRemovePts(rec)).toBe(String(t2['Transaction Type External Ref']));
    // all three differ when the three types differ
    const refs = new Set([txnRefFixedPointBack(rec), txnRefUploadPts(rec), txnRefRemovePts(rec)]);
    expect(refs.size).toBe(3);
    // not found / N/A -> blank
    expect(txnRefFixedPointBack(o({ txnTypeFixedPointBack: 'NO SUCH TXN TYPE' }))).toBe('');
    expect(txnRefFixedPointBack(o({ txnTypeFixedPointBack: 'N/A' }))).toBe('');
  });
});

describe('§8.6 offer status & early-activation days', () => {
  const rec = o({ startDate: '2026-01-01', endDate: '2026-01-31' });
  it('status from today', () => {
    expect(offerStatus(rec, new Date('2026-01-15T00:00:00'))).toBe('Live');
    expect(offerStatus(rec, new Date('2026-02-01T00:00:00'))).toBe('Completed');
    expect(offerStatus(rec, new Date('2025-12-01T00:00:00'))).toBe('Not Started');
  });
  it('early activation days', () => {
    expect(earlyActivationDays(o({ startDate: '2026-01-10', earlyActivationDate: '2026-01-05' }))).toBe(5);
    expect(earlyActivationDays(o({ startDate: '2026-01-10', earlyActivationDate: 'N/A' }))).toBe(0);
  });
});

describe('§8.6 per-day and redemption point calcs', () => {
  it('points issued per day', () => {
    expect(pointsIssuedPerDay(o({ startDate: '2026-01-01', endDate: '2026-01-10', bonusPtsIssued: 1000 }))).toBe(100);
  });
  it('redemption pts for ENTRIES/POINTS DONATION only', () => {
    const rec = o({ subCategory: 'POINTS DONATION', bonusedMembers: 100, offerDesign: 'Fixed Point', fixedPoints: 50 });
    expect(redemptionPts(rec)).toBe(-5000); // 100 * 50 * -1
    expect(redemptionPtsValue(rec)).toBe(-10); // -5000/1000*2
    expect(redemptionPts(o({ subCategory: 'CONSUMABLES', bonusedMembers: 100, fixedPoints: 50 }))).toBeNull();
  });
  it('promo bonus pts per $ (multiplier only) and reversal eligibility', () => {
    expect(promoBonusPtsPerDollar(o({ offerDesign: 'Multiplier', multiplier: '3X' }))).toBe(20); // 10*2
    expect(promoBonusPtsPerDollar(o({ offerDesign: 'Fixed Point', fixedPoints: 100 }))).toBeNull();
    expect(eligibleForReversal(o({ kognitivOfferSetupType: 'Transaction Bonus Promotion' }))).toBe('Yes');
    expect(eligibleForReversal(o({ kognitivOfferSetupType: 'Internet Message Promotion' }))).toBeNull();
  });
});

describe('§8.6 proration', () => {
  it('no early activation: min(today-start, numberOfDays)', () => {
    const rec = o({ startDate: '2026-01-01', endDate: '2026-01-10', activations: 100, bonusPtsIssued: 1000 });
    expect(promoDaysProrated(rec, new Date('2026-01-06T00:00:00'))).toBe(5);
    expect(activationPerDayProrated(rec, new Date('2026-01-06T00:00:00'))).toBe(20); // 100 / (5 + 0)
    expect(bonusPtsPerDayProrated(rec, new Date('2026-01-06T00:00:00'))).toBe(2000); // (1000/5)*10
    expect(promoDaysProrated(rec, new Date('2025-12-31T00:00:00'))).toBeNull(); // before start
  });
  it('early activation branch caps at early activation days', () => {
    const rec = o({ startDate: '2026-01-01', endDate: '2026-01-10', earlyActivationDate: '2025-12-30', activations: 100 });
    // earlyActivationDays = 2; min(today-early=7, 2) = 2
    expect(earlyActivationDays(rec)).toBe(2);
    expect(promoDaysProrated(rec, new Date('2026-01-06T00:00:00'))).toBe(2);
    expect(activationPerDayProrated(rec, new Date('2026-01-06T00:00:00'))).toBe(25); // 100 / (2 + 2)
  });
});

describe('§8.6 not-captured sentinels', () => {
  it('activation during promo & unique spend are not captured', () => {
    expect(activationDuringPromo(o({ activations: 100 }))).toBe(NOT_CAPTURED);
    expect(spendPerUniqueBonusedMember(o({}))).toBe(NOT_CAPTURED);
    const r = resolveCalendarFieldValue('calc.activationDuringPromo', o({ activations: 100 }));
    expect(r.captured).toBe(false);
    expect(r.text).toBe('Not captured in the calendar form');
  });
});

describe('metadata mapping integrity', () => {
  it('144 columns map, 25 are not captured (null)', () => {
    const nonNull = metadataFields.filter((m) => m.calendarFieldId !== null).length;
    expect(metadataFields.length).toBe(169);
    expect(nonNull).toBe(144);
    expect(metadataFields.length - nonNull).toBe(25);
  });
  it('key mappings are corrected', () => {
    const by = (c: string) => metadataFields.find((m) => m.sourceColumn === c)?.calendarFieldId;
    expect(by('Activation Descriptor (Auto-activation from which previous offer)')).toBe('postActivationDescriptor');
    expect(by('Offer Status')).toBe('calc.offerStatus');
    expect(by('Bonus Rate')).toBe('calc.bonusRate');
    expect(by('Assumed redemption rate')).toBe('calc.redemptionRateActual');
    expect(by('Fcst - Assumed Redemption Rate')).toBe('calc.redemptionRate'); // forecast rate unchanged
    expect(by('Redemption Deactivation Ref_ID')).toBe('deactivationCode');
    expect(by('Transaction Type Fixed Back Promotion Ref_ID')).toBe('calc.txnRefFixedPointBack');
    expect(by('Transaction Type Upload Pts Ref_ID')).toBe('calc.txnRefUploadPts');
    expect(by('Transaction Type Remove Pts Ref_ID')).toBe('calc.txnRefRemovePts');
    expect(by('Bonused members (unique)')).toBeNull();
    expect(by('Early Activation count')).toBeNull();
  });
  it('no resolved value shows NaN / Infinity / #N/A for a seeded offer', () => {
    const sample = metadataFields;
    // a completed offer with results
    const offer = o({
      offerName: 'TEST', offerId: 1, buildStatus: 'Completed - Data Final',
      startDate: '2026-01-01', endDate: '2026-01-31', country: 'USPR, CAN',
      offerDesign: 'Multiplier', multiplier: '3X', category: 'MERCH', subCategory: 'CONSUMABLES',
      activations: 7763, bonusedMembers: 5000, bonusPtsIssued: 1_000_000, audienceSize: 20000,
      hardgoodsOffer: 'Yes', consumablesOffer: 'Yes',
    });
    for (const m of sample) {
      const { text } = resolveCalendarFieldValue(m.calendarFieldId, offer);
      expect(text).not.toMatch(/NaN|Infinity|#N\/A/i);
    }
  });
});
