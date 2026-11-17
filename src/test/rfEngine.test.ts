import { describe, it, expect } from 'vitest';
import {
  round, rounddown, num2text, textPct, eq, gt, lt, average, div, iferror, isErr, mul,
} from '@/lib/excel';
import { computeRfCells, RF_COLUMNS, type RfCol } from '@/lib/rfEngine';
import { formatXVal } from '@/lib/excelFormat';
import { RF_BY_LETTER } from '@/lib/forecastColumnRegistry';
import { runCheck, type Snapshot, type ImportIssue } from '@/lib/excelCheck';
import base from '@/data/imported/offers.base.json';
import rfSnap from '@/data/imported/excelSnapshot.rf.json';
import report from '@/data/imported/importReport.json';
import type { OfferRecord } from '@/lib/types';

const offers = base as unknown as OfferRecord[];
const AS_OF = new Date(2026, 10, 11);
const byName = (n: string) => offers.find((o) => o.offerName === n)!;
const shown = (o: OfferRecord, c: RfCol) => formatXVal(computeRfCells(o, AS_OF)[c], RF_BY_LETTER[c].format);

describe('B1 Excel helpers', () => {
  it('ROUND is half away from zero; ROUNDDOWN goes toward zero', () => {
    expect(round(2.5, 0)).toBe(3);
    expect(round(-2.5, 0)).toBe(-3);
    expect(rounddown(220.59, 1)).toBe(220.5);
  });
  it('number to text and TEXT() percentages', () => {
    expect(num2text(3)).toBe('3');
    expect(num2text(220.5)).toBe('220.5');
    expect(num2text(0.2)).toBe('0.2');
    expect(textPct(0.145, '0%')).toBe('15%');
    expect(textPct(0.0004, '0.0%')).toBe('0.0%');
  });
  it('text is greater than any number, and = ignores case', () => {
    expect(gt('TBD', 1e12)).toBe(true);
    expect(lt('TBD', 1000)).toBe(false);
    expect(eq('Extra entries', 'Extra Entries')).toBe(true);
    expect(eq('Cancelled', 'CANCELLED')).toBe(true);
    expect(eq('N/A', 0)).toBe(false);
  });
  it('AVERAGE ignores text; arithmetic on text is an error; IFERROR catches it', () => {
    expect(average(2, 'TBD', 4)).toBe(3);
    expect(isErr(average('TBD'))).toBe(true);
    expect(isErr(mul('N/A', 3))).toBe(true);
    expect(iferror(div(1, 0), 'null')).toBe('null');
  });
});

describe('B3 full-row fixtures (as of 11/11/2026, values from the Excel snapshot)', () => {
  const expectRow = (name: string, exp: Partial<Record<RfCol, string>>) => {
    const o = byName(name);
    for (const [c, v] of Object.entries(exp)) expect(`${c}=${shown(o, c as RfCol)}`).toBe(`${c}=${v}`);
  };

  it('20260331_CATSNACKSDAYS_10X', () => {
    expectRow('20260331_CATSNACKSDAYS_10X', {
      U: '16.1%', W: '9', Y: '$1,536,052', Z: '15,360,515.55', AA: '$30,721', AB: '$276,489', AC: '88%',
      AD: '$243,311', AE: '$46.74', AL: '297,000', AM: '15.0%', AN: '37,935', AO: '51,645', AP: '44,790', AQ: '$48',
      AR: '$1,707,075', AS: '$2,582,250', AT: '$2,144,663', AU: '17,070,750', AV: '25,822,500', AW: '21,446,625',
      AX: '153,636,750', AY: '232,402,500', AZ: '193,019,625', BA: '$34,142', BB: '$51,645', BC: '$307,274',
      BD: '$464,805', BE: '$386,039', BF: '88%', BG: '$270,401', BH: '$409,028', BI: '$339,715', BJ: '$341,415',
      BK: '$516,450', BL: '$428,933', BM: '3/31-4/6', BN: '297K', BO: '45K (15%)', BP: '$48', BQ: '193M ($340K)',
      BR: '204K', BS: '33K (16%)', BT: '$47', BU: '138M ($243K)', BV: '$1.5M', BW: '7', BX: '100%',
      BY: '138,244,640', BZ: 'Pink',
    });
  });

  it('20260325_TIERBOOSTWEEKPLUS_45_7500', () => {
    expectRow('20260325_TIERBOOSTWEEKPLUS_45_7500', {
      U: '36.9%', Y: 'TBD', AB: '$3,606,418', AC: '88%', AD: '$3,173,648', AM: '54.5%', AQ: '$81',
      AX: '2,802,375,000', AY: '3,444,000,000', AZ: '3,123,187,500', BI: '$5,496,810', BL: '$6,926,658',
      BO: '416K (55%)', BQ: '3.1B ($5.5M)', BR: '652K', BS: '240K (37%)', BT: 'TBD', BU: '1.8B ($3M)', BV: 'TBD',
      BZ: 'Pink',
    });
  });

  it('20251228_MAPLETIERBOOST_500', () => {
    expectRow('20251228_MAPLETIERBOOST_500', {
      S: '48,200,500', T: '', U: '100.0%', AB: '$96,409', AC: '100%', AD: '$96,409', AM: '71.5%', AQ: '$0',
      AX: '34,320,000', AY: '48,510,000', BI: '$82,830', BO: '83K (72%)', BP: 'N/A', BQ: '41M ($83K)',
      BS: '96K (100%)', BU: '48M ($96K)', BZ: 'Light green',
    });
  });

  it('20261105_CANPUPPYPARTY_RSVP_AO', () => {
    expectRow('20261105_CANPUPPYPARTY_RSVP_AO', {
      U: 'null', W: 'N/A', AB: '$0', AL: '40,750', AX: '0', AY: '0', BN: '40.7K', BO: '0 (0%)', BQ: 'N/A', BR: '0',
      BS: 'N/A', BU: '0K ($0)', BW: '6', BX: '43%', BY: '0', BZ: 'Light green',
    });
  });
});

describe('E1 reconciliation: all 768 R&F rows against the Excel snapshot', () => {
  const cols = RF_COLUMNS.slice(RF_COLUMNS.indexOf('S')).map((c) => ({
    letter: c, header: RF_BY_LETTER[c].header, format: RF_BY_LETTER[c].format,
  }));
  const res = runCheck({
    offers,
    snapshot: rfSnap as unknown as Snapshot,
    columns: cols,
    compute: (o) => computeRfCells(o, AS_OF),
    isChanged: () => false,
    issues: report.issues as ImportIssue[],
  });
  const pct = (c: string) => {
    const s = res.columns.find((x) => x.letter === c)!;
    return (100 * s.matches) / s.compared;
  };

  it('compares every row', () => {
    expect(res.offersCompared).toBe(768);
  });
  it('S..AM and BM match 100%', () => {
    for (const c of RF_COLUMNS.slice(RF_COLUMNS.indexOf('S'), RF_COLUMNS.indexOf('AM') + 1)) expect(`${c} ${pct(c)}`).toBe(`${c} 100`);
    expect(pct('BM')).toBe(100);
  });
  it('AN..BL at least 99%, BN..BV at least 98%', () => {
    for (const c of RF_COLUMNS.slice(RF_COLUMNS.indexOf('AN'), RF_COLUMNS.indexOf('BL') + 1)) expect(pct(c)).toBeGreaterThanOrEqual(99);
    for (const c of RF_COLUMNS.slice(RF_COLUMNS.indexOf('BN'), RF_COLUMNS.indexOf('BV') + 1)) expect(pct(c)).toBeGreaterThanOrEqual(98);
  });
  it('BW..BZ match except rows with a classified Excel data issue', () => {
    for (const c of ['BW', 'BX', 'BY', 'BZ']) {
      const s = res.columns.find((x) => x.letter === c)!;
      expect(s.compared - s.matches).toBe(s.byReason['Excel data issue']);
    }
  });
  it('has 0 mismatches with reason "Logic difference"', () => {
    expect(res.byReason['Logic difference']).toBe(0);
  });
});
