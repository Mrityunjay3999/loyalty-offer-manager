import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import Papa from 'papaparse';
import { useAppStore } from '@/store/useAppStore';
import { importMetaOf } from '@/store/importedBase';
import { includeForResultsForecast } from '@/lib/calculations';
import { RF_REGISTRY, CALENDAR_BAND, CALENDAR_TWINS, REGISTRY } from '@/lib/forecastColumnRegistry';
import { GRID_ENTRIES, RF_PRESETS, gridValue, buildExportTable } from '@/lib/rfGrid';
import { formatXVal } from '@/lib/excelFormat';
import { colLetter, normHeader } from '@/lib/excelParse';
import dropdowns from '@/data/dropdowns.json';
import type { OfferRecord } from '@/lib/types';

const AS_OF = new Date(2026, 10, 11);
const offers = () => useAppStore.getState().offers;
const byId = (id: number) => offers().find((o) => o.offerId === id)!;
const rf = (L: string) => RF_REGISTRY.find((e) => e.letter === L)!;
const show = (o: OfferRecord, L: string) => formatXVal(gridValue(rf(L), o, AS_OF, importMetaOf(o._uid)), rf(L).format);

describe('C2 rows selector', () => {
  it('shows the 768 Excel rows by default and 2,127 included offers in "All"', () => {
    const included = offers().filter((o) => includeForResultsForecast(o) === 'Yes');
    const excel = included.filter((o) => importMetaOf(o._uid)?.inExcelRfTab ?? true);
    expect(excel).toHaveLength(768);
    expect(included).toHaveLength(2127);
  });
});

describe('Package F fixes (on the dummy data)', () => {
  it('F1: values come from the newer Excel data', () => {
    expect(show(byId(5054), 'C')).toBe('Live');
    expect(show(byId(5025), 'C')).toBe('Completed');
    expect(show(byId(5025), 'B')).toBe('Sep 26');
    expect(show(byId(4956), 'O')).toBe('56,122,114');
  });
  it('F2: blank pulled inputs show 0', () => {
    const o = byId(5163);
    for (const L of ['O', 'P', 'Q', 'R']) expect(`${L}=${show(o, L)}`).toBe(`${L}=0`);
  });
  it('F3: colour code shows once the offer has started', () => {
    expect(show(byId(5163), 'BZ')).toBe('Light green');
    expect(show(byId(4599), 'BZ')).toBe('Dark Green');
    expect(show(byId(4503), 'BZ')).toBe('Dark Green');
  });
  it('F4: Bonus rate Avg uses 0.0%', () => {
    expect(show(byId(4495), 'AM')).toBe('24.8%');
    expect(show(byId(4423), 'AM')).toBe('11.8%');
    expect(show(byId(4491), 'AM')).toBe('71.5%');
    expect(show(byId(4612), 'AM')).toBe('100.0%');
  });
  it('F5: Bonus Pts Issued shows 2 decimals when not whole (grid and export)', () => {
    expect(show(byId(4412), 'R')).toBe('870,185.34');
    const t = buildExportTable([rf('R')], [byId(4412)], AS_OF, importMetaOf);
    expect(t.data[0][0]).toBe('870,185.34');
  });
  it('F6: imported forecast inputs give Activation Avg 40,750 for 5163', () => {
    expect(show(byId(5163), 'AL')).toBe('40,750');
  });
  it('F7 / F8: calculated zeros show instead of blanks', () => {
    const o = byId(4503);
    expect([show(o, 'AM'), show(o, 'AP'), show(o, 'AZ'), show(o, 'BI')]).toEqual(['0.0%', '0', '0', '$0']);
    const p = byId(4599);
    expect([show(p, 'AZ'), show(p, 'BI')]).toEqual(['0', '$0']);
  });
  it('F9: the export writes the displayed value (Promo Days included)', () => {
    const o = byId(5163);
    const t = buildExportTable([rf('A'), rf('F'), rf('BZ')], [o], AS_OF, importMetaOf);
    expect(t.header).toEqual(['Offer ID', 'Promo Days', 'Color code']);
    expect(t.letters).toEqual(['A', 'F', 'BZ']);
    expect(t.data[0]).toEqual(['5163', '14', 'Light green']);
  });
  it('F10: Offer ID and Offer Name first, then Excel order (Promo Days after End Date)', () => {
    const letters = GRID_ENTRIES.filter((e) => e.source === 'R&F tab').map((e) => e.letter);
    expect(letters.slice(0, 8)).toEqual(['A', 'J', 'B', 'C', 'D', 'E', 'F', 'G']);
    const full = RF_PRESETS[0].visible;
    for (const k of ['rf:H', 'rf:M', 'rf:N']) expect(full).toContain(k);
  });
  it('F12: Initial QA and Ready to Go are in the status list', () => {
    expect(dropdowns.status).toContain('Initial QA');
    expect(dropdowns.status).toContain('Ready to Go');
  });
  it('F13 / F14: V, W, X, BW, BX and the CALENDAR band are shown by default', () => {
    const full = RF_PRESETS[0].visible;
    for (const k of ['rf:V', 'rf:W', 'rf:X', 'rf:BW', 'rf:BX']) expect(full).toContain(k);
    expect(full.filter((k) => k.startsWith('cal:'))).toHaveLength(16); // CX, CV hidden by default
  });
});

describe('C3 views', () => {
  it('Excel full holds all 78 R&F columns; Business summary is the 21 export columns', () => {
    const full = RF_PRESETS.find((p) => p.name === 'Excel full (A to BZ)')!.visible;
    expect(full.filter((k) => k.startsWith('rf:'))).toHaveLength(78);
    expect(RF_PRESETS.find((p) => p.name === 'Business summary')!.visible).toHaveLength(21);
    for (const p of RF_PRESETS) expect(p.visible.slice(0, 2)).toEqual(['rf:A', 'rf:J']);
  });
});

describe('C3b coverage (R&F tab and Calendar main tab)', () => {
  // Needs the real Excel export, which stays on the developer's machine (data/source is git-ignored).
  it.skipIf(!fs.existsSync('data/source/rf_live.csv'))('every R&F header A..BZ has exactly 1 registry entry with the same letter and header', () => {
    const rows = Papa.parse<string[]>(fs.readFileSync('data/source/rf_live.csv', 'utf8')).data;
    const headers = rows[3];
    expect(headers).toHaveLength(78);
    headers.forEach((h, i) => {
      const L = colLetter(i);
      const matches = REGISTRY.filter((e) => e.source === 'R&F tab' && e.letter === L);
      expect(matches).toHaveLength(1);
      expect(`${L}: ${matches[0].header}`).toBe(`${L}: ${normHeader(h)}`);
    });
  });
  it('the 29 Calendar forecast and results columns are present (11 via twins + 18 in the band)', () => {
    expect(CALENDAR_TWINS).toHaveLength(11);
    expect(CALENDAR_BAND).toHaveLength(18);
    const letters = [...CALENDAR_TWINS, ...CALENDAR_BAND].map((e) => e.letter).sort();
    expect(letters).toEqual(
      ['CP', 'DD', 'DE', 'DF', 'DG', 'DM', 'DN', 'DO', 'DP', 'DQ', 'DR', 'CS', 'DC', 'DH', 'DI', 'DJ', 'DK', 'DL', 'DS', 'DT', 'DU', 'DV', 'DW', 'DX', 'DY', 'DZ', 'CW', 'CX', 'CV'].sort(),
    );
    // the band copies of R&F AN/AO/AR/AS/BG/BH equal their R&F twins
    const o = byId(4661);
    const pairs: Array<[string, string]> = [['DS', 'AN'], ['DT', 'AO'], ['DU', 'AR'], ['DV', 'AS'], ['DW', 'BG'], ['DX', 'BH']];
    for (const [c, r] of pairs) {
      const ce = CALENDAR_BAND.find((e) => e.letter === c)!;
      expect(gridValue(ce, o, AS_OF)).toEqual(gridValue(rf(r), o, AS_OF));
    }
  });
  it('the Grid tab renders every grid registry entry except the twins', () => {
    const gridKeys = new Set(GRID_ENTRIES.map((e) => e.key));
    for (const e of REGISTRY.filter((x) => x.tab === 'grid' && !x.key.startsWith('cal:') )) expect(gridKeys.has(e.key)).toBe(true);
    for (const e of CALENDAR_BAND) expect(gridKeys.has(e.key)).toBe(true);
  });
});

describe('C6 How it is calculated', () => {
  it('the 4 cards cover all 78 R&F columns exactly once, in Excel order within each card', async () => {
    const { HOW_CARDS } = await import('@/components/rf/RfHowTab');
    const all = HOW_CARDS.flatMap((c) => c.letters);
    expect(all).toHaveLength(78);
    expect(new Set(all).size).toBe(78);
    const order = RF_REGISTRY.map((e) => e.letter);
    for (const c of HOW_CARDS) {
      const idx = c.letters.map((l) => order.indexOf(l));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  }, 20000); // the dynamic import of the tab can be slow on a busy machine
});
