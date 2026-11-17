import { describe, it, expect } from 'vitest';
import { parseExcelCell, parseExcelDate, colIndex, colLetter, colRange, normHeader } from '@/lib/excelParse';
import report from '@/data/imported/importReport.json';
import base from '@/data/imported/offers.base.json';

describe('A1 parsing rules', () => {
  it('parses money, negatives, percentages, accounting zero, kept text and errors', () => {
    expect(parseExcelCell('$1,234,567')).toBe(1234567);
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
    expect(parseExcelCell(' 12,345,678.90 ')).toBe(12345678.9);
    expect(parseExcelCell('20260706_CHECKINFEST_IMPO')).toBe('20260706_CHECKINFEST_IMPO');
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
        '20251201_MEMBERWEEKDUO_VIPP', '20260101_BIRTHDAYTREATWEEK_VIPP', '20260201_VIPPERKPERKS_VIPP',
        '20260201_SUMMERPAWPOINTS_500000', '20260216_BLOOMPETPASS_LTBP_3000', '20261212_CAN_TIERBOOSTWEEKPLUS_60_7500',
        '20260206_CANPETDENTALCHEWSPLUS_5X', '20260106_CANKITTENWETFOODDEALTRIO_5X', '20260110_CANREPTILEFOODPLUS_5X',
        '20260110_CANBUNNYTREATSPERKS_5X', '20260106_CANAQUAWETFOODDEAL_5X', '20260930_LTBP_TGT_3000',
        '20260929_LTBP_TGT_3000', '20261029_MEMBERBONUSXTRA_PERKPACKPERKS_10X_9740', '20260906_REPTILEFOODSAVER_10_3000',
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

  it('A2: the 2 R&F-only offers get new IDs 5098 and 5361 with an issue', () => {
    const rfOnly = report.issues.filter((i) => i.type === 'rf_only');
    expect(rfOnly.map((i) => i.offerName).sort()).toEqual([
      '20261008_CANREPTILEFOODFEST_SELECT_5X', '20270404_PTSBOOST_REPTILESUPPLIES_25X',
    ]);
    expect(rfOnly.map((i) => i.offerId).sort()).toEqual([5098, 5361]);
  });

  it('records the text-in-number cell, failed lookups and the duplicate name', () => {
    const t = report.issues.filter((i) => i.type === 'text_in_number');
    expect(t).toHaveLength(1);
    expect(t[0].offerName).toBe('20260906_REPTILEFOODSAVER_10_3000');
    expect(t[0].excelValue).toBe('20260706_CHECKINFEST_IMPO');
    expect(report.issues.filter((i) => i.type === 'failed_lookup')).toHaveLength(182);
    expect(c.duplicateNames).toBe(1);
  });
});

describe('A3/A4 imported values', () => {
  const byName = (n: string) => (base as Array<Record<string, unknown>>).find((o) => o.offerName === n)!;
  it('rebuilds exact forecast inputs for 20260331_CATSNACKSDAYS_10X', () => {
    const o = byName('20260331_CATSNACKSDAYS_10X');
    expect(o.bonusRateLow).toBeCloseTo(0.135, 12);
    expect(o.bonusRateHigh).toBeCloseTo(0.165, 12);
    expect(o.avgSpendPerTxnLow).toBe(45);
    expect(o.avgSpendPerTxnHigh).toBe(50);
    expect(o.activationByDayLow).toBeCloseTo(40142.857142857145, 6);
    expect(o.activationByDayHigh).toBeCloseTo(44714.28571428572, 6);
    expect(o.bonusPtsIssued).toBe(138244639.97);
  });
  it('keeps the Metadata audience size where the R&F cell holds text', () => {
    expect(byName('20260906_REPTILEFOODSAVER_10_3000').audienceSize).toBe(114514656);
  });
  it('sets points economics per offer', () => {
    const all = base as Array<Record<string, unknown>>;
    expect(all.filter((o) => o.redemptionConversion === 2.5 && o.basePtsPerDollar === 8)).toHaveLength(648);
    expect(all.every((o) => typeof o._uid === 'string' && String(o._uid).startsWith('imp-'))).toBe(true);
  });
});
