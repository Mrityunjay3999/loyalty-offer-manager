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

describe('B3 full-row fixtures (as of 11/11/2026)', () => {
  const expectRow = (name: string, exp: Partial<Record<RfCol, string>>) => {
    const o = byName(name);
    for (const [c, v] of Object.entries(exp)) expect(`${c}=${shown(o, c as RfCol)}`).toBe(`${c}=${v}`);
  };

  it('20260330_CATLRGBGS_10X', () => {
    expectRow('20260330_CATLRGBGS_10X', {
      U: '15.2%', W: '9', Y: '$1,031,774', Z: '10,317,739.60', AA: '$20,635', AB: '$185,719', AC: '88%',
      AD: '$163,433', AE: '$45.88',
      AL: '220,500', AM: '14.5%', AN: '27,300', AO: '36,960', AP: '32,130', AQ: '$48',
      AR: '$1,228,500', AS: '$1,848,000', AT: '$1,538,250', AU: '12,285,000', AV: '18,480,000', AW: '15,382,500',
      AX: '110,565,000', AY: '166,320,000', AZ: '138,442,500',
      BA: '$24,570', BB: '$36,960', BC: '$221,130', BD: '$332,640', BE: '$276,885', BF: '88%', BG: '$194,594',
      BH: '$292,723', BI: '$243,659', BJ: '$245,700', BK: '$369,600', BL: '$307,650',
      BM: '3/30-4/5', BN: '220.5K', BO: '32K (15%)', BP: '$48', BQ: '138M ($244K)', BR: '148K', BS: '22K (15%)',
      BT: '$46', BU: '93M ($163K)', BV: '$1M', BW: '7', BX: '100%', BY: '92,859,656', BZ: 'Pink',
    });
  });

  it('20260323_TIERA_50_5000', () => {
    expectRow('20260323_TIERA_50_5000', {
      U: '34.1%', Y: 'TBD', AB: '$2,855,980', AC: '88%', AD: '$2,513,262',
      AM: '49.0%', AQ: '$88', AX: '1,612,100,000', AY: '1,963,500,000', AZ: '1,787,800,000', BI: '$3,146,528',
      BL: '$4,210,115',
      BO: '358K (49%)', BQ: '1.8B ($3.1M)', BR: '837K', BS: '286K (34%)', BT: 'TBD', BU: '1.4B ($3M)', BV: 'TBD',
      BZ: 'Pink',
    });
  });

  it('20251228_JANMEMBIRTHDAY_1000', () => {
    expectRow('20251228_JANMEMBIRTHDAY_1000', {
      S: '147,337,000', T: '', U: '100.0%', AB: '$294,660', AC: '100%', AD: '$294,660',
      AM: '65.5%', AQ: '$0', AX: '67,100,000', AY: '91,000,000', BI: '$158,100',
      BO: '79K (66%)', BP: 'N/A', BQ: '79M ($158K)', BS: '147K (100%)', BU: '147M ($295K)', BZ: 'Dark Green',
    });
  });

  it('20261101_CANSANTA_RSVP_AO', () => {
    expectRow('20261101_CANSANTA_RSVP_AO', {
      U: 'null', W: 'N/A', AB: '$0', AL: '31,500', AX: '0', AY: '0',
      BN: '31.5K', BO: '0 (0%)', BQ: 'N/A', BR: '0', BS: 'N/A', BU: '0K ($0)', BW: '10', BX: '71%', BY: '0',
      BZ: 'Light green',
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
