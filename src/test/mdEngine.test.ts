import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import Papa from 'papaparse';
import { useAppStore } from '@/store/useAppStore';
import { importMetaOf } from '@/store/importedBase';
import { computeMdCells } from '@/lib/mdEngine';
import { MD_REGISTRY } from '@/lib/mdRegistry';
import { REGISTRY } from '@/lib/forecastColumnRegistry';
import { formatXVal } from '@/lib/excelFormat';
import { colIndex, colRange, normHeader } from '@/lib/excelParse';
import { runCheck, metadataReason, type ImportIssue, type Snapshot } from '@/lib/excelCheck';
import { columnValue, metadataLetterOf } from '@/lib/feed';
import { fields, fieldsByStep, metadataFields } from '@/lib/dataLoaders';
import { isFieldVisible } from '@/lib/visibility';
import mdSnap from '@/data/imported/excelSnapshot.metadata.json';
import report from '@/data/imported/importReport.json';
import type { OfferRecord } from '@/lib/types';

const AS_OF = new Date(2026, 10, 11);
const offers = () => useAppStore.getState().offers;
const byName = (n: string) => offers().find((o) => o.offerName === n)!;
const md = (L: string) => MD_REGISTRY.find((e) => e.letter === L)!;
const show = (o: OfferRecord, L: string) => formatXVal(computeMdCells(o, AS_OF, importMetaOf(o._uid))[L], md(L).format);

describe('C3b coverage (Metadata file)', () => {
  const rows = Papa.parse<string[]>(fs.readFileSync('data/source/metadata_master.csv', 'utf8')).data;
  it('every Master Sheet header BW..FC has exactly 1 registry entry with the same letter and header', () => {
    for (const L of colRange('BW', 'FC')) {
      const matches = REGISTRY.filter((e) => e.source === 'Metadata' && e.letter === L);
      expect(matches).toHaveLength(1);
      expect(`${L}: ${matches[0].header}`).toBe(`${L}: ${normHeader(rows[2][colIndex(L)])}`);
      expect(matches[0].tab).toBe('metadata');
    }
  });
  it('holds the 18 BASICS inputs with their exact headers', () => {
    const basics = MD_REGISTRY.filter((e) => e.band === 'MD_BASICS');
    expect(basics.map((e) => e.letter)).toEqual(['B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'O', 'Q', 'AD', 'AE', 'AF', 'AT', 'AU']);
    for (const e of basics) expect(e.header).toBe(normHeader(rows[2][colIndex(e.letter)]));
  });
});

describe('D2 new fields are data-driven', () => {
  const ids = ['bonusedMembersUnique', 'earlyActivationCount', 'divisionShareHG', 'divisionShareCONS', 'divisionShareSPEC', 'divisionShareSVCS', 'divisionShareCharities', 'redemptionConversion', 'basePtsPerDollar'];
  it('are in fields.json, so they reach the form, column picker, dictionary and export', () => {
    expect(fields.filter((f) => ids.includes(f.id))).toHaveLength(9);
    const step9 = fieldsByStep['9. Results'].map((f) => f.id);
    const step7 = fieldsByStep['7. Forecast'].map((f) => f.id);
    for (const id of ids.slice(0, 7)) expect(step9).toContain(id);
    expect(step7).toContain('redemptionConversion');
    expect(step7).toContain('basePtsPerDollar');
    const econ = fields.find((f) => f.id === 'redemptionConversion')!;
    expect(econ.readOnlyInForm).toBe(true);
    expect(econ.fieldTag).toBe('Fixed number');
    expect(econ.group).toBe('Points economics');
  });
  it('follow their visibility rules', () => {
    expect(isFieldVisible('earlyActivationCount', { earlyActivationDate: '' })).toBe(false);
    expect(isFieldVisible('earlyActivationCount', { earlyActivationDate: '2026-01-01' })).toBe(true);
    expect(isFieldVisible('divisionShareHG', { hardgoodsOffer: 'Yes', consumablesOffer: 'No' })).toBe(false);
    expect(isFieldVisible('divisionShareHG', { hardgoodsOffer: 'Yes', consumablesOffer: 'Yes' })).toBe(true);
  });
});

describe('D1 Metadata logic: 20260330_CATLRGBGS_10X', () => {
  it('matches the Excel Master Sheet values', () => {
    const o = byName('20260330_CATLRGBGS_10X');
    expect(show(o, 'CC')).toBe('148,186');
    expect(show(o, 'CF')).toBe('13,265,665.20');
    expect(show(o, 'CG')).toBe('0.20%');
    expect(show(o, 'CH')).toBe('15.18%');
    expect(show(o, 'CJ')).toBe('9');
    expect(show(o, 'CK')).toBe('10.00');
    expect(show(o, 'CL')).toBe('$1,031,773.96');
    expect(show(o, 'CP')).toBe('88%');
    expect(show(o, 'CR')).toBe('$46');
    expect(show(o, 'CS')).toBe('TBD');
    expect(show(o, 'CV')).toBe('USD');
    expect(show(o, 'ET')).toBe('90');
    expect(show(o, 'EU')).toBe('Yes');
    expect(show(o, 'EZ')).toBe('7');
    expect(show(o, 'FA')).toBe('21,169');
    expect(show(o, 'FC')).toBe('92,859,656');
    expect(show(o, 'I')).toBe('Completed');
  });
});

describe('E1 Metadata reconciliation (as of 11/11/2026)', () => {
  const byId = new Map(offers().map((o) => [o.offerId, o]));
  const res = runCheck({
    offers: offers(),
    snapshot: mdSnap as unknown as Snapshot,
    columns: MD_REGISTRY.filter((e) => e.band !== 'MD_BASICS').map((e) => ({ letter: e.letter, header: e.header, format: e.format })),
    compute: (o) => computeMdCells(o, AS_OF, importMetaOf(o._uid)),
    isChanged: () => false,
    issues: report.issues as ImportIssue[],
    extraReason: (id, L, t) => {
      const o = byId.get(id);
      return metadataReason(o, !!importMetaOf(o?._uid)?.inExcelRfTab, t, L);
    },
  });
  const col = (L: string) => res.columns.find((c) => c.letter === L)!;
  it('compares all 2,423 Metadata offers', () => {
    expect(res.offersCompared).toBe(2423);
  });
  it('CP, CV, ET and EZ match 100%', () => {
    for (const L of ['CP', 'CV', 'ET', 'EZ']) expect(`${L} ${col(L).compared - col(L).matches}`).toBe(`${L} 0`);
  });
  it('CG differs only on explained rows, incl. the REPLENISHMENTCAT Excel data issue', () => {
    expect(col('CG').byReason['Logic difference']).toBe(0);
    const m = res.mismatches.find((x) => x.letter === 'CG' && x.offerName === '20241024_REPLENISHMENTCAT_3X')!;
    expect(m.excel).toBe('null');
    expect(m.proto).toBe('4.70%');
    expect(m.reason).toBe('Excel data issue');
  });
  it('ED blanks on older rows are pasted history values', () => {
    expect(col('ED').byReason['Pasted history value']).toBeGreaterThan(600);
  });
  it('has 0 mismatches with reason "Logic difference"', () => {
    expect(res.byReason['Logic difference']).toBe(0);
  });
});

describe('D4 data feed wiring', () => {
  it('the listed Metadata columns now show a value instead of "Not captured"', () => {
    const o = byName('20260330_CATLRGBGS_10X');
    const letters = ['CA', 'CB', 'CC', 'CF', 'CS', 'CT', 'CU', 'ET', 'DS', 'DT', 'DU', 'DV', 'DW', 'EA', 'ED', 'EE', 'EI', 'EJ', 'EK', 'EL', 'EM', 'EN', 'EO', 'EP', 'EQ', 'FA', 'FC'];
    for (const L of letters) {
      const m = metadataFields.find((x) => metadataLetterOf(x) === L)!;
      expect(`${L} ${columnValue(m, o).captured}`).toBe(`${L} true`);
    }
    const fb = metadataFields.find((x) => metadataLetterOf(x) === 'FB')!;
    expect(columnValue(fb, o).captured).toBe(false);
  });
});
