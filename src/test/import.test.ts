import { describe, it, expect } from 'vitest';
import { parseExcelCell, parseExcelDate, colIndex, colLetter, colRange, normHeader } from '@/lib/excelParse';
import report from '@/data/imported/importReport.json';
import base from '@/data/imported/offers.base.json';

describe('A1 parsing rules', () => {
  it('parses money, negatives, percentages, accounting zero, kept text and errors', () => {
    expect(parseExcelCell('$1,031,774')).toBe(1031774);
    expect(parseExcelCell('(1,234)')).toBe(-1234);
    expect(parseExcelCell('1,234')).toBe(1234);
    expect(parseExcelCell('15.2%')).toBe(0.152);
    expect(parseExcelCell('0%')).toBe(0);
    expect(parseExcelCell(' -   ')).toBe(0);
    expect(parseExcelCell('TBD')).toBe('TBD');
    expect(parseExcelCell('N/A')).toBe('N/A');
    expect(parseExcelCell('null')).toBe('null');
    expect(parseExcelCell('#N/A')).toEqual({ error: '#N/A' });
    expect(parseExcelCell('#DIV/0!')).toEqual({ error: '#DIV/0!' });
    expect(parseExcelCell('')).toBe('');
    expect(parseExcelCell(' 92,859,656.40 ')).toBe(92859656.4);
    expect(parseExcelCell('20260713_FLASHSALEGCPROMO_IMPO')).toBe('20260713_FLASHSALEGCPROMO_IMPO');
  });
  it('parses m/d/yyyy dates to ISO and leaves other text alone', () => {
    expect(parseExcelDate('3/30/2026')).toBe('2026-03-30');
    expect(parseExcelDate('11/1/2025')).toBe('2025-11-01');
    expect(parseExcelDate('N/A')).toBeNull();
  });
  it('converts column letters both ways and normalises headers', () => {
    expect(colIndex('A')).toBe(0);
    expect(colIndex('BZ')).toBe(77);
    expect(colLetter(77)).toBe('BZ');
    expect(colRange('BW', 'FC')).toHaveLength(85);
    expect(normHeader('  Fcst -\n Activation  Low ')).toBe('Fcst - Activation Low');
  });
});

describe('A8 import report counts', () => {
  const c = report.counts;
  it('matches every expected count', () => {
    expect(c.rfDataRows).toBe(768);
    expect(c.metadataRealOffers).toBe(2423);
    expect(c.metadataEmptyRows).toBe(477);
    expect(c.metadataFailedLookupRows).toBe(182);
    expect(c.rfMatchedToMetadata).toBe(766);
    expect(c.rfNotInMetadata).toBe(2);
    expect(c.metadataNotInRf).toBe(1657);
    expect(c.metadataNotInRfStartingFrom20251101).toBe(260);
    expect(c.offersImported).toBe(2425);
    expect(c.duplicateOfferIds).toBe(0);
    expect(c.impOnlyOffers).toBe(298);
    expect(c.includedInResultsForecast).toBe(2127);
    expect(c.filesDisagreeOffers).toBe(15);
    expect(c.redemptionConversion250).toBe(648);
  });

  it('lists the 15 offers where the 2 files disagree', () => {
    expect([...report.filesDisagreeOfferNames].sort()).toEqual(
      [
        '20251201_ADOPTDEC_VIPP', '20260101_ADOPTJAN_VIPP', '20260201_ADOPTFEB_VIPP',
        '20260201_TENTTRSG_1000000', '20260213_NEWCUSTOMER_LTBP_5000', '20261217_CAN_TIERA_49_5000',
        '20260202_CANJBPNULO_5X', '20260105_CANJBPBOXIE_5X', '20260105_CANJBPMERRICK_5X',
        '20260105_CANJBPBLUE_5X', '20260105_CANJBPNATURALBALANCE_5X', '20260928_LTBP_TGT_5000',
        '20260928_LTBP_TGT_2500', '20261024_GOPVS_PICORIVERA_10X_2280', '20260908_REPTILEFOODSUPPFEEDERS_20_2500',
      ].sort(),
    );
  });

  it('A5: 2 new statuses and 13 new category pairs with their counts', () => {
    expect(report.newStatuses).toEqual({
      'Initial QA': { total: 33, inRf: 26 },
      'Ready to Go': { total: 20, inRf: 18 },
    });
    expect(report.newCategoryPairs).toEqual({
      'IMPO|SALON CERT': 3, 'BENEFIT|ADOPTVIPP': 14, 'EVENT|EVENTRSVP': 23, 'POINTS BOOST|HARDGOODS': 30,
      'EVENT|BIRTHDAYRSVP': 12, 'LOYALTY|TIER EVENT': 9, 'MERCH|MERCH-SERVICE': 8, 'POINTS BOOST|SPECIALTY': 8,
      'LOYALTY|TEST': 2, 'CHARITIES|GOOD KARMA': 5, 'POINTS BOOST|CONSUMABLES': 1, 'SERVICES|SERVICES': 1,
      'DIGITAL|ALL MERCH': 3,
    });
  });

  it('A2: the 2 R&F-only offers get new IDs 2607 and 2608 with an issue', () => {
    const rfOnly = report.issues.filter((i) => i.type === 'rf_only');
    expect(rfOnly.map((i) => i.offerName).sort()).toEqual([
      '20261005_CANJBPNUTRIENCE_SELECT_5X', '20270402_PTSBOOST_DOGBEDS_25X',
    ]);
    expect(rfOnly.map((i) => i.offerId).sort()).toEqual([2607, 2608]);
  });

  it('records the text-in-number cell, failed lookups and the duplicate name', () => {
    const t = report.issues.filter((i) => i.type === 'text_in_number');
    expect(t).toHaveLength(1);
    expect(t[0].offerName).toBe('20260908_REPTILEFOODSUPPFEEDERS_20_2500');
    expect(t[0].excelValue).toBe('20260713_FLASHSALEGCPROMO_IMPO');
    expect(report.issues.filter((i) => i.type === 'failed_lookup')).toHaveLength(182);
    expect(c.duplicateNames).toBe(1);
  });
});

describe('A3/A4 imported values', () => {
  const byName = (n: string) => (base as Array<Record<string, unknown>>).find((o) => o.offerName === n)!;
  it('rebuilds exact forecast inputs for 20260330_CATLRGBGS_10X', () => {
    const o = byName('20260330_CATLRGBGS_10X');
    expect(o.bonusRateLow).toBeCloseTo(0.13, 12);
    expect(o.bonusRateHigh).toBeCloseTo(0.16, 12);
    expect(o.avgSpendPerTxnLow).toBe(45);
    expect(o.avgSpendPerTxnHigh).toBe(50);
    expect(o.activationByDayLow).toBe(30000);
    expect(o.activationByDayHigh).toBe(33000);
    expect(o.bonusPtsIssued).toBe(92859656.4);
  });
  it('keeps the Metadata audience size where the R&F cell holds text', () => {
    expect(byName('20260908_REPTILEFOODSUPPFEEDERS_20_2500').audienceSize).toBe(83855722);
  });
  it('sets points economics per offer', () => {
    const all = base as Array<Record<string, unknown>>;
    expect(all.filter((o) => o.redemptionConversion === 2.5 && o.basePtsPerDollar === 8)).toHaveLength(648);
    expect(all.every((o) => typeof o._uid === 'string' && String(o._uid).startsWith('imp-'))).toBe(true);
  });
});
