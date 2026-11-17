/* eslint-disable no-console */
// v3 Package A: import the 2 Excel exports into generated JSON the app loads.
// Run with `npm run import:excel`. Reads data/source/*.csv (never read by the app).
//
// Outputs (src/data/imported/):
//   offers.base.json            imported offers in form-field shape + an _import block
//   excelSnapshot.rf.json       raw display text of all 78 R&F cells per row
//   excelSnapshot.metadata.json raw display text of Metadata BW..FC per offer
//   importReport.json           counts, matching results and every data issue
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {
  parseExcelCell,
  parseExcelDate,
  colIndex,
  colRange,
  normHeader,
  isExcelError,
} from '../src/lib/excelParse';
import { computeRfCells } from '../src/lib/rfEngine';
import { compareCell } from '../src/lib/excelFormat';
import { RF_BY_LETTER } from '../src/lib/forecastColumnRegistry';
import { computeMdCells } from '../src/lib/mdEngine';
import { MD_REGISTRY } from '../src/lib/mdRegistry';
import type { OfferRecord } from '../src/lib/types';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data/source');
// Real output stays private (git-ignored); scripts/anonymizeData.ts writes the dummy copy the app ships.
const OUT = path.join(ROOT, 'data/private/imported');
const IMPORTED_ON = '2026-11-11';
const IMPORTED_AT_ISO = '2026-11-11T09:00:00.000Z';

type Row = string[];
type Val = string | number;
type Offer = Record<string, unknown>;

interface Issue {
  id: string;
  type:
    | 'rf_only'
    | 'text_in_number'
    | 'files_disagree'
    | 'new_status'
    | 'new_category_pair'
    | 'duplicate_name'
    | 'failed_lookup'
    | 'excel_formula_gap'
    | 'excel_error_cells'
    | 'rounded_export';
  severity: 'issue' | 'info';
  offerId: number | null;
  offerName: string;
  file: 'R&F tab' | 'Metadata' | 'Both';
  row: number | null; // spreadsheet row number
  column: string;
  excelValue: string;
  valueUsed: string;
  message: string;
  offerIds?: number[];
}

// ---------------------------------------------------------------- read files
function readCsv(file: string): Row[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  return Papa.parse<Row>(text, { skipEmptyLines: false }).data;
}
const rf = readCsv('rf_live.csv');
const md = readCsv('metadata_master.csv');
const fields = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/fields.json'), 'utf8')) as Array<{
  id: string;
  control: string;
}>;
const dropdowns = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/dropdowns.json'), 'utf8')) as Record<
  string,
  string[]
>;
const reference = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/reference.json'), 'utf8')) as {
  categorySubCategory: Array<{ category: string; subCategory: string; foundInImport?: boolean }>;
  lifecycle: Array<{ status: string; foundInImport?: boolean }>;
};
const control: Record<string, string> = Object.fromEntries(fields.map((f) => [f.id, f.control]));

const cell = (r: Row, L: string) => (r[colIndex(L)] ?? '') as string;
const trim = (s: unknown) => String(s ?? '').trim();

// ---------------------------------------------------------------- issues
const issues: Issue[] = [];
function addIssue(i: Omit<Issue, 'id'>): string {
  const id = `ISS-${String(issues.length + 1).padStart(4, '0')}`;
  issues.push({ id, ...i });
  return id;
}

// ---------------------------------------------------------------- R&F rows
const RF_HEADER_ROW = 3; // 0-based index of row 4
const RF_LETTERS = colRange('A', 'BZ');
const rfData: Array<{ row: number; r: Row }> = [];
for (let i = RF_HEADER_ROW + 1; i < rf.length; i++) {
  const r = rf[i];
  if (!r || r.every((c) => trim(c) === '')) continue;
  rfData.push({ row: i + 1, r });
}

// ---------------------------------------------------------------- Metadata rows
const MD_HEADER_ROW = 2; // row 3
const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const mdReal: Array<{ row: number; r: Row }> = [];
let mdEmpty = 0;
let mdNA = 0;
const naRows: Array<{ row: number; r: Row }> = [];
for (let i = MD_HEADER_ROW + 1; i < md.length; i++) {
  const r = md[i];
  if (!r) continue;
  const name = trim(cell(r, 'O'));
  const start = trim(cell(r, 'J'));
  if (name && DATE_RE.test(start)) {
    mdReal.push({ row: i + 1, r });
    continue;
  }
  if (r.some((c) => trim(c) === '#N/A')) {
    mdNA++;
    naRows.push({ row: i + 1, r });
    continue;
  }
  if (r.every((c) => trim(c) === '')) continue; // trailing blank line, not a formula row
  mdEmpty++;
}

// ---------------------------------------------------------------- value conversion
/** Convert a display cell to the stored shape for a form field. Undefined = leave blank. */
function toField(fieldId: string, raw: string, opts: { naIsBlank?: boolean } = {}): Val | undefined {
  const t = trim(raw);
  if (t === '' || t === '#N/A') return undefined;
  const c = control[fieldId];
  if (c === undefined) throw new Error(`Unknown field id in mapping: ${fieldId}`);
  if (c === 'date' || c === 'dateOrNA') {
    const iso = parseExcelDate(t);
    if (iso) return iso;
    if (t === 'N/A' || t === 'null') return opts.naIsBlank ? undefined : 'N/A';
    return t;
  }
  if (c === 'number' || c === 'currency' || c === 'percent') {
    const p = parseExcelCell(t);
    if (typeof p === 'number') return p;
    if (isExcelError(p)) return undefined;
    return t; // "N/A" and other text stay text
  }
  if (fieldId === 'offerId') {
    const p = parseExcelCell(t);
    return typeof p === 'number' ? p : t;
  }
  return t;
}

// A3: Metadata "TR Calendar" column -> form field id.
const MD_TO_FIELD: Array<[string, string, { naIsBlank?: boolean }?]> = [
  ['B', 'offerId'],
  ['G', 'earlyActivationDate', { naIsBlank: true }],
  ['H', 'buildStatus'],
  ['J', 'startDate'],
  ['K', 'endDate'],
  ['N', 'offerTiering'],
  ['O', 'offerName'],
  ['P', 'groupedOffer'],
  ['Q', 'country'],
  ['R', 'broadVsTargeted'],
  ['S', 'promotionDescription'],
  ['T', 'offerShortDescription'],
  ['U', 'channel'],
  ['V', 'productVsBasket'],
  ['W', 'awardRule'],
  ['X', 'awardRuleMaxQty'],
  ['Y', 'freeVsTransactional'],
  ['Z', 'offerThreshold'],
  ['AA', 'inspireOfferThreshold'],
  ['AB', 'displayOfferThreshold'],
  ['AC', 'offerThresholdRule'],
  ['AD', 'multiplier'],
  ['AE', 'fixedPoints'],
  ['AF', 'offerDesign'],
  ['AG', 'kognitivActivationSetupType'],
  ['AH', 'kognitivOfferSetupType'],
  ['AI', 'activationRequired'],
  ['AJ', 'optInMethod'],
  ['AK', 'autoActivationConfigured'],
  ['AL', 'postActivationDescriptor'],
  ['AM', 'tieredOfferDetails'],
  ['AN', 'audienceOrigination'],
  ['AO', 'memberDescriptor'],
  ['AP', 'internalRewardExternalRef'],
  ['AQ', 'transactionExternalRefId'],
  ['AR', 'activationDescriptor'],
  ['AS', 'canActivationDescriptor'],
  ['AT', 'category'],
  ['AU', 'subCategory'],
  ['AV', 'proprietaryBrand'],
  ['AW', 'offset'],
  ['AX', 'fundingStructure'],
  ['BC', 'ltbpExpiryDisplayed'],
  ['BD', 'ltbpRemovalDate'],
  ['BE', 'pointsAwardDate'],
  ['BF', 'txnTypeFixedPointBack'],
  ['BG', 'txnTypeUploadPts'],
  ['BH', 'txnTypeRemovePts'],
  ['BI', 'interactionType'],
  ['BJ', 'primaryBrand'],
  ['BK', 'brandOffer'],
  ['BL', 'dogCustomer'],
  ['BM', 'catCustomer'],
  ['BN', 'birdCustomer'],
  ['BO', 'smallPetCustomer'],
  ['BP', 'reptileCustomer'],
  ['BQ', 'aquaticCustomer'],
  ['BR', 'hardgoodsOffer'],
  ['BS', 'consumablesOffer'],
  ['BT', 'specialtyOffer'],
  ['BU', 'servicesOffer'],
  ['BV', 'charitiesOffer'],
  ['BW', 'audienceSize'],
  ['BX', 'activations'],
  ['BY', 'bonusedMembers'],
  ['BZ', 'bonusPtsIssued'],
  ['CW', 'forecastDate', { naIsBlank: true }],
  ['EY', 'deactivationCode'],
  ['FD', 'signageRequested'],
  ['FE', 'labelsRequested'],
  ['FF', 'usprFosSignage'],
  ['FH', 'usprPrioritySkus'],
  ['FI', 'canPrioritySkus'],
  ['FJ', 'redText'],
];
// Values typed only in Metadata, going to the new D2 fields.
const MD_TO_NEW_FIELD: Array<[string, string]> = [
  ['CA', 'bonusedMembersUnique'],
  ['CB', 'earlyActivationCount'],
  ['EL', 'divisionShareHG'],
  ['EM', 'divisionShareCONS'],
  ['EN', 'divisionShareSPEC'],
  ['EO', 'divisionShareSVCS'],
  ['EP', 'divisionShareCharities'],
  ['CI', 'redemptionConversion'],
  ['CK', 'basePtsPerDollar'],
];
const METADATA_ONLY = ['EB', 'EC', 'EF', 'EG', 'ER', 'ES'];

function num(raw: string): number | null {
  const p = parseExcelCell(raw);
  return typeof p === 'number' ? p : null;
}
function numOr0(raw: string): number {
  return num(raw) ?? 0;
}

// ---------------------------------------------------------------- dates
const DAY = 86_400_000;
function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function totalOfferDays(o: Offer): number | null {
  const s = typeof o.startDate === 'string' ? parseExcelIso(o.startDate) : null;
  const e = typeof o.endDate === 'string' ? parseExcelIso(o.endDate) : null;
  if (s === null || e === null) return null;
  const ea = typeof o.earlyActivationDate === 'string' ? parseExcelIso(o.earlyActivationDate) : null;
  return Math.round((e - (ea ?? s)) / DAY) + 1;
}
function parseExcelIso(v: string): number | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? isoToUtc(v) : null;
}

// ---------------------------------------------------------------- A4 rebuild
/**
 * Rebuild the exact forecast inputs from the totals (A4). `cols` maps the logical
 * names to the column letters of the file used (R&F or Metadata).
 */
function rebuildForecast(
  o: Offer,
  r: Row,
  cols: { AF: string; AG: string; AH: string; AI: string; AJ: string; AK: string; AN: string; AO: string; AR: string; AS: string },
): string[] {
  const derived: string[] = [];
  const AF = num(cell(r, cols.AF));
  const AG = num(cell(r, cols.AG));
  const AN = num(cell(r, cols.AN));
  const AO = num(cell(r, cols.AO));
  const AR = num(cell(r, cols.AR));
  const AS = num(cell(r, cols.AS));
  const days = totalOfferDays(o);

  const set = (id: string, v: number | null, isDerived: boolean) => {
    if (v === null || v === 0) {
      delete o[id]; // a pulled blank and 0 calculate the same; keep the form blank
      return;
    }
    o[id] = v;
    if (isDerived) derived.push(id);
  };

  // bonus rates
  if (AF !== null && AF > 0 && AN !== null) set('bonusRateLow', AN / AF, true);
  else set('bonusRateLow', num(cell(r, cols.AH)), false);
  if (AG !== null && AG > 0 && AO !== null) set('bonusRateHigh', AO / AG, true);
  else set('bonusRateHigh', num(cell(r, cols.AI)), false);
  // avg spend per txn
  if (AN !== null && AN > 0 && AR !== null) set('avgSpendPerTxnLow', AR / AN, true);
  else set('avgSpendPerTxnLow', num(cell(r, cols.AJ)), false);
  if (AO !== null && AO > 0 && AS !== null) set('avgSpendPerTxnHigh', AS / AO, true);
  else set('avgSpendPerTxnHigh', num(cell(r, cols.AK)), false);
  // activation by day = total / total offer days (full precision)
  if (days && days > 0) {
    set('activationByDayLow', AF !== null ? AF / days : null, true);
    set('activationByDayHigh', AG !== null ? AG / days : null, true);
  }
  return derived;
}

// ---------------------------------------------------------------- A4 refinement (R&F offers)
// The export rounds bonused members (AN/AO) and sales (AR/AS) to whole numbers, so
// AN / AF can miss the typed rate when AN is small. Excel's bonus points keep far
// more precision: AX = AN x W (fixed designs) and AX = AR x X x W (Multiplier).
// We try the A4 rule first plus these refined candidates, and keep the one that
// reproduces the most of Excel's own displayed forecast cells.
const SCORE_COLS = [
  'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY',
  'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BN', 'BO', 'BP', 'BQ',
];
type Pair = { rate: number | null; spend: number | null };
function sideCandidates(
  r: Row,
  total: number | null,
  L: { H: string; J: string; N: string; R: string; X: string },
  W: number | null,
  X: number,
  isMult: boolean,
): Pair[] {
  const shownRate = num(cell(r, L.H));
  const shownSpend = num(cell(r, L.J));
  const shownN = num(cell(r, L.N));
  const shownR = num(cell(r, L.R));
  const bonusPts = num(cell(r, L.X));
  const nCands = [shownN];
  const rCands = [shownR];
  if (W && W > 0 && bonusPts !== null && bonusPts > 0) {
    if (isMult) rCands.push(bonusPts / (X * W));
    else nCands.push(bonusPts / W);
  }
  const out: Pair[] = [];
  for (const n of nCands) {
    for (const s of rCands) {
      const rate = total && total > 0 && n !== null ? n / total : shownRate;
      const spend = n !== null && n > 0 && s !== null ? s / n : shownSpend;
      out.push({ rate, spend });
      if (shownSpend && shownSpend > 0 && s !== null && total && total > 0) {
        out.push({ rate: s / shownSpend / total, spend: shownSpend });
      }
    }
  }
  out.push({ rate: shownRate, spend: shownSpend });
  // de-duplicate (keep first = the A4 rule order)
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = `${p.rate}|${p.spend}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function refineFromTotals(o: Offer, r: Row): boolean {
  const cells = computeRfCells(o as OfferRecord, new Date(2026, 10, 11));
  const W = typeof cells.W === 'number' ? cells.W : null;
  const X = typeof o.basePtsPerDollar === 'number' ? o.basePtsPerDollar : 10;
  const isMult = String(o.offerDesign ?? '').toLowerCase() === 'multiplier';
  const low = sideCandidates(r, num(cell(r, 'AF')), { H: 'AH', J: 'AJ', N: 'AN', R: 'AR', X: 'AX' }, W, X, isMult);
  const high = sideCandidates(r, num(cell(r, 'AG')), { H: 'AI', J: 'AK', N: 'AO', R: 'AS', X: 'AY' }, W, X, isMult);
  const apply = (t: Offer, l: Pair, h: Pair) => {
    const set = (id: string, v: number | null) => {
      if (v === null || v === 0) delete t[id];
      else t[id] = v;
    };
    set('bonusRateLow', l.rate);
    set('avgSpendPerTxnLow', l.spend);
    set('bonusRateHigh', h.rate);
    set('avgSpendPerTxnHigh', h.spend);
  };
  const score = (t: Offer) => {
    const c = computeRfCells(t as OfferRecord, new Date(2026, 10, 11)) as Record<string, unknown>;
    let s = 0;
    for (const L of SCORE_COLS) if (compareCell(cell(r, L), c[L] as never, RF_BY_LETTER[L].format).match) s++;
    return s;
  };
  // Score the current (A4 rule) values first so a tie keeps them.
  let best = score(o);
  let bestPair: [Pair, Pair] | null = null;
  for (const l of low) {
    for (const h of high) {
      const t: Offer = { ...o };
      apply(t, l, h);
      const s = score(t);
      if (s > best) {
        best = s;
        bestPair = [l, h];
      }
    }
  }
  if (!bestPair) return false;
  apply(o, bestPair[0], bestPair[1]);
  return true;
}

// Same refinement for history offers (Metadata only), scored against the Metadata
// file's own forecast columns: DP = DF x CJ (fixed designs), DP = DJ x CK x CJ (Multiplier).
const MD_SCORE = MD_REGISTRY.filter((e) => e.band === 'MD_FORECAST' && e.letter !== 'CW');
function refineHistory(o: Offer, r: Row): boolean {
  const c0 = computeMdCells(o as OfferRecord, new Date(2026, 10, 11));
  const W = typeof c0.CJ === 'number' ? c0.CJ : null;
  const X = typeof o.basePtsPerDollar === 'number' ? o.basePtsPerDollar : 10;
  const isMult = String(o.offerDesign ?? '').toLowerCase() === 'multiplier';
  const low = sideCandidates(r, num(cell(r, 'CX')), { H: 'CZ', J: 'DB', N: 'DF', R: 'DJ', X: 'DP' }, W, X, isMult);
  const high = sideCandidates(r, num(cell(r, 'CY')), { H: 'DA', J: 'DC', N: 'DG', R: 'DK', X: 'DQ' }, W, X, isMult);
  const apply = (t: Offer, l: Pair, h: Pair) => {
    const set = (id: string, v: number | null) => {
      if (v === null || v === 0) delete t[id];
      else t[id] = v;
    };
    set('bonusRateLow', l.rate);
    set('avgSpendPerTxnLow', l.spend);
    set('bonusRateHigh', h.rate);
    set('avgSpendPerTxnHigh', h.spend);
  };
  const score = (t: Offer) => {
    const c = computeMdCells(t as OfferRecord, new Date(2026, 10, 11));
    let n = 0;
    for (const e of MD_SCORE) if (compareCell(cell(r, e.letter), c[e.letter], e.format).match) n++;
    return n;
  };
  let best = score(o);
  let bestPair: [Pair, Pair] | null = null;
  for (const l of low) {
    for (const h of high) {
      const t: Offer = { ...o };
      apply(t, l, h);
      const n = score(t);
      if (n > best) {
        best = n;
        bestPair = [l, h];
      }
    }
  }
  if (!bestPair) return false;
  apply(o, bestPair[0], bestPair[1]);
  return true;
}

// ---------------------------------------------------------------- build Metadata offers
const offers: Offer[] = [];
const byName = new Map<string, Offer[]>();
const byId = new Map<number, Offer>();
const mdRowByOffer = new Map<Offer, Row>();

for (const { row, r } of mdReal) {
  const o: Offer = {};
  for (const [L, id, opts] of MD_TO_FIELD) {
    const v = toField(id, cell(r, L), opts);
    if (v !== undefined) o[id] = v;
  }
  for (const [L, id] of MD_TO_NEW_FIELD) {
    const p = parseExcelCell(cell(r, L));
    if (typeof p === 'number') o[id] = p;
  }
  // redemptionConversion / basePtsPerDollar default to 2 / 10 when missing
  if (typeof o.redemptionConversion !== 'number') o.redemptionConversion = 2;
  if (typeof o.basePtsPerDollar !== 'number') o.basePtsPerDollar = 10;

  const metadataOnlyValues: Record<string, string> = {};
  for (const L of METADATA_ONLY) {
    const t = trim(cell(r, L));
    if (t) metadataOnlyValues[L] = t;
  }

  o._import = {
    source: 'Metadata only',
    inExcelRfTab: false,
    excelMetadataRow: row,
    excelMetadataRefNumber: num(cell(r, 'A')) ?? undefined,
    importedOn: IMPORTED_ON,
    derivedFields: [] as string[],
    issues: [] as string[],
    fiscal: { fy: trim(cell(r, 'D')), fm: trim(cell(r, 'E')), fw: trim(cell(r, 'F')) },
    metadataOnlyValues,
  };
  offers.push(o);
  mdRowByOffer.set(o, r);
  const name = String(o.offerName ?? '');
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name)!.push(o);
  if (typeof o.offerId === 'number') byId.set(o.offerId, o);
}

const imp = (o: Offer) => o._import as {
  source: string;
  inExcelRfTab: boolean;
  excelRfRow?: number;
  excelMetadataRow?: number;
  excelRfRefNumber?: number;
  excelMetadataRefNumber?: number;
  derivedFields: string[];
  issues: string[];
};

// duplicate names in Metadata
let duplicateNames = 0;
for (const [name, list] of byName) {
  if (list.length > 1) {
    duplicateNames++;
    for (const o of list) {
      const id = addIssue({
        type: 'duplicate_name',
        severity: 'issue',
        offerId: o.offerId as number,
        offerName: name,
        file: 'Metadata',
        row: imp(o).excelMetadataRow ?? null,
        column: 'O',
        excelValue: name,
        valueUsed: name,
        message: `The Promotion Name appears ${list.length} times in the Metadata file (Offer IDs ${list
          .map((x) => x.offerId)
          .join(', ')}). Both rows were imported with their own Offer IDs.`,
        offerIds: list.map((x) => x.offerId as number),
      });
      imp(o).issues.push(id);
    }
  }
}

// Metadata forecast columns used for history offers (A4 bracketed letters)
const MD_FCST = { AF: 'CX', AG: 'CY', AH: 'CZ', AI: 'DA', AJ: 'DB', AK: 'DC', AN: 'DF', AO: 'DG', AR: 'DJ', AS: 'DK' };
const RF_FCST = { AF: 'AF', AG: 'AG', AH: 'AH', AI: 'AI', AJ: 'AJ', AK: 'AK', AN: 'AN', AO: 'AO', AR: 'AR', AS: 'AS' };

/** Excel rows where a calculated cell is blank although its inputs are present. */
function checkFormulaGaps(o: Offer, r: Row, row: number) {
  const D = parseExcelDate(cell(r, 'D'));
  const E = parseExcelDate(cell(r, 'E'));
  if (D && E && trim(cell(r, 'F')) === '') {
    const id = addIssue({
      type: 'excel_formula_gap',
      severity: 'issue',
      offerId: (o.offerId as number) ?? null,
      offerName: String(o.offerName ?? ''),
      file: 'R&F tab',
      row,
      column: 'F',
      excelValue: '(blank)',
      valueUsed: 'End - Start + 1',
      message:
        'Promo Days (column F) is blank in the Excel row although Start and End Date are set, so Excel\'s prorated columns BW to BZ use a blank. The prototype calculates Promo Days from the dates.',
    });
    imp(o).issues.push(id);
  }
}

// ---------------------------------------------------------------- join R&F by name
let matched = 0;
const rfOnly: Array<{ row: number; r: Row }> = [];
const rfOffers: Offer[] = [];
const disagreeOffers = new Set<number>();
let maxId = Math.max(...offers.map((o) => (typeof o.offerId === 'number' ? o.offerId : 0)));

const DISAGREE_PAIRS: Array<[string, string, string]> = [
  ['BW', 'O', 'Audience size'],
  ['BX', 'P', 'Activations'],
  ['BY', 'Q', 'Bonused members'],
  ['BZ', 'R', 'Bonus points issued'],
  ['CX', 'AF', 'Forecast activation Low'],
  ['CY', 'AG', 'Forecast activation High'],
  ['DB', 'AJ', 'Forecast avg spend Low'],
  ['DC', 'AK', 'Forecast avg spend High'],
];

function applyRfOverrides(o: Offer, r: Row, row: number) {
  const name = String(o.offerName ?? '');
  const setText = (id: string, L: string) => {
    const t = trim(cell(r, L));
    if (t !== '') o[id] = t;
  };
  setText('dashboardMonth', 'B');
  setText('buildStatus', 'C');
  const d = parseExcelDate(cell(r, 'D'));
  const e = parseExcelDate(cell(r, 'E'));
  if (d) o.startDate = d;
  if (e) o.endDate = e;
  setText('category', 'G');
  setText('subCategory', 'H');
  setText('offerTiering', 'I');
  setText('country', 'K');
  setText('offerDesign', 'L');
  setText('multiplier', 'M');
  const fp = toField('fixedPoints', cell(r, 'N'));
  if (fp !== undefined) o.fixedPoints = fp;

  // results O..R: R&F wins when it holds a number
  const RES: Array<[string, string, string]> = [
    ['O', 'audienceSize', 'BW'],
    ['P', 'activations', 'BX'],
    ['Q', 'bonusedMembers', 'BY'],
    ['R', 'bonusPtsIssued', 'BZ'],
  ];
  for (const [L, id, mdL] of RES) {
    const t = trim(cell(r, L));
    if (t === '') continue;
    const p = parseExcelCell(t);
    if (typeof p === 'number') {
      if (p === 0 && o[id] === undefined) continue; // pulled blank: keep the form blank
      // R&F sometimes shows a value rounded to whole units; keep Metadata's exact value then.
      if (typeof o[id] === 'number' && Math.abs((o[id] as number) - p) <= 0.5 + 1e-9) continue;
      o[id] = p;
    } else {
      const issueId = addIssue({
        type: 'text_in_number',
        severity: 'issue',
        offerId: (o.offerId as number) ?? null,
        offerName: name,
        file: 'R&F tab',
        row,
        column: L,
        excelValue: t,
        valueUsed: o[id] === undefined ? '' : String(o[id]),
        message: `R&F column ${L} should hold a number but holds the text "${t}". The Metadata value (column ${mdL}) was kept.`,
      });
      imp(o).issues.push(issueId);
    }
  }
}

for (const { row, r } of rfData) {
  const name = trim(cell(r, 'J'));
  const list = byName.get(name);
  if (!list || list.length === 0) {
    rfOnly.push({ row, r });
    continue;
  }
  matched++;
  const o = list[0];
  const mr = mdRowByOffer.get(o)!;
  const i = imp(o);
  i.source = 'Excel R&F tab + Metadata';
  i.inExcelRfTab = true;
  i.excelRfRow = row;
  i.excelRfRefNumber = num(cell(r, 'A')) ?? undefined;

  // the 2 files disagree? (compare before overriding; blank counts as 0)
  const diffs: string[] = [];
  for (const [mdL, rfL, label] of DISAGREE_PAIRS) {
    const mv = parseExcelCell(cell(mr, mdL));
    const rv = parseExcelCell(cell(r, rfL));
    // Blank and "N/A" count as 0 (Excel pulls them as 0). A gap of 0.5 or less is
    // only display rounding in one of the exports, not a disagreement.
    const asNum = (v: unknown) => (typeof v === 'number' ? v : v === '' || v === 'N/A' ? 0 : null);
    const mn = asNum(mv);
    const rn = asNum(rv);
    const differ =
      mn === null || rn === null ? trim(cell(mr, mdL)) !== trim(cell(r, rfL)) : Math.abs(mn - rn) > 0.5 + 1e-9;
    if (differ) {
      diffs.push(label);
      const issueId = addIssue({
        type: 'files_disagree',
        severity: 'issue',
        offerId: o.offerId as number,
        offerName: name,
        file: 'Both',
        row,
        column: `${rfL} (R&F) / ${mdL} (Metadata)`,
        excelValue: `R&F ${trim(cell(r, rfL))} | Metadata ${trim(cell(mr, mdL))}`,
        valueUsed: typeof rv === 'number' ? trim(cell(r, rfL)) : trim(cell(mr, mdL)),
        message: `${label}: the R&F tab and the Metadata file differ. The import uses the R&F value when it is a number.`,
      });
      i.issues.push(issueId);
    }
  }
  if (diffs.length) disagreeOffers.add(o.offerId as number);

  applyRfOverrides(o, r, row);
  i.derivedFields = rebuildForecast(o, r, RF_FCST);
  refineFromTotals(o, r);
  checkFormulaGaps(o, r, row);
  rfOffers.push(o);
}

// R&F rows not in Metadata: new offers with new Offer IDs
for (const { row, r } of rfOnly) {
  const name = trim(cell(r, 'J'));
  maxId += 1;
  const o: Offer = { offerId: maxId, offerName: name };
  applyRfOverrides(o, r, row);
  const V = num(cell(r, 'V'));
  const X = num(cell(r, 'X'));
  o.redemptionConversion = V ?? 2;
  o.basePtsPerDollar = X ?? 10;
  o._import = {
    source: 'Excel R&F tab only',
    inExcelRfTab: true,
    excelRfRow: row,
    excelRfRefNumber: num(cell(r, 'A')) ?? undefined,
    importedOn: IMPORTED_ON,
    derivedFields: [] as string[],
    issues: [] as string[],
    metadataOnlyValues: {},
  };
  imp(o).derivedFields = rebuildForecast(o, r, RF_FCST);
  refineFromTotals(o, r);
  checkFormulaGaps(o, r, row);
  const issueId = addIssue({
    type: 'rf_only',
    severity: 'issue',
    offerId: maxId,
    offerName: name,
    file: 'R&F tab',
    row,
    column: 'J',
    excelValue: name,
    valueUsed: `Offer ID ${maxId}`,
    message:
      'Offer ID created on import. This offer is not in the Metadata file, so its real Unique Offer ID was not shared.',
  });
  imp(o).issues.push(issueId);
  offers.push(o);
  rfOffers.push(o);
  byId.set(maxId, o);
}

// history offers (Metadata only): rebuild forecast inputs from the Metadata columns
for (const o of offers) {
  if (imp(o).inExcelRfTab) continue;
  const mr = mdRowByOffer.get(o);
  if (mr) {
    imp(o).derivedFields = rebuildForecast(o, mr, MD_FCST);
    refineHistory(o, mr);
  }
}

// rounded export values (informational): rebuilt rate/spend differs from the shown text
for (const o of rfOffers) {
  const i = imp(o);
  const r = rfData.find((x) => x.row === i.excelRfRow)!.r;
  const checks: Array<[string, string]> = [
    ['bonusRateLow', 'AH'],
    ['bonusRateHigh', 'AI'],
    ['avgSpendPerTxnLow', 'AJ'],
    ['avgSpendPerTxnHigh', 'AK'],
  ];
  for (const [id, L] of checks) {
    if (!i.derivedFields.includes(id)) continue;
    const shown = numOr0(cell(r, L));
    const used = typeof o[id] === 'number' ? (o[id] as number) : 0;
    if (Math.abs(shown - used) > 1e-9) {
      addIssue({
        type: 'rounded_export',
        severity: 'info',
        offerId: o.offerId as number,
        offerName: String(o.offerName),
        file: 'R&F tab',
        row: i.excelRfRow ?? null,
        column: L,
        excelValue: trim(cell(r, L)),
        valueUsed: String(used),
        message: `The export shows a rounded ${L} value. The exact input was rebuilt from the totals (A4).`,
      });
    }
  }
}

// Metadata rows of real offers that show Excel errors in BW..FB (FC errors are
// expected: Excel has no IFERROR there).
for (const o of offers) {
  const r = mdRowByOffer.get(o);
  if (!r) continue;
  const bad = colRange('BW', 'FB').filter((L) => /^#(N\/A|REF!|VALUE!|DIV\/0!)$/.test(trim(cell(r, L))));
  if (!bad.length) continue;
  const id = addIssue({
    type: 'excel_error_cells',
    severity: 'issue',
    offerId: o.offerId as number,
    offerName: String(o.offerName ?? ''),
    file: 'Metadata',
    row: imp(o).excelMetadataRow ?? null,
    column: bad.join(', '),
    excelValue: trim(cell(r, bad[0])),
    valueUsed: '(calculated from the offer)',
    message: `The Metadata row shows Excel errors in ${bad.length} column(s) (${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ', ...' : ''}). The prototype calculates them from the offer.`,
  });
  imp(o).issues.push(id);
}

// Metadata CJ (Bonus point calculation) that does not follow its own formula
// =IF(AF="Multiplier",LEFT(AD,LEN(AD)-1)-1,AE): e.g. 0 while AE is "N/A".
for (const o of offers) {
  const r = mdRowByOffer.get(o);
  if (!r) continue;
  const AF = trim(cell(r, 'AF')).toLowerCase();
  const AE = trim(cell(r, 'AE'));
  const CJ = trim(cell(r, 'CJ'));
  if (AF !== 'multiplier' && AE === 'N/A' && typeof parseExcelCell(CJ) === 'number') {
    const id = addIssue({
      type: 'excel_formula_gap',
      severity: 'issue',
      offerId: o.offerId as number,
      offerName: String(o.offerName ?? ''),
      file: 'Metadata',
      row: imp(o).excelMetadataRow ?? null,
      column: 'CJ',
      excelValue: CJ,
      valueUsed: 'N/A (from AE)',
      message: `Metadata column CJ shows ${CJ} although its formula gives "N/A" for this row (AE is "N/A"), so CT and CU differ too. The prototype follows the formula.`,
    });
    imp(o).issues.push(id);
  }
}

// failed lookups
for (const { row, r } of naRows) {
  addIssue({
    type: 'failed_lookup',
    severity: 'issue',
    offerId: null,
    offerName: '',
    file: 'Metadata',
    row,
    column: 'B..FM',
    excelValue: '#N/A',
    valueUsed: '(row skipped)',
    message: `Metadata row ${row} (Ref Nbr ${trim(cell(r, 'A')) || 'blank'}): every lookup cell shows #N/A, so the row was skipped.`,
  });
}

// ---------------------------------------------------------------- A5 statuses and pairs
// Values added to the reference data from this import (tagged foundInImport)
// still count as "found in imported data" for the report.
const importedStatuses = new Set(reference.lifecycle.filter((l) => l.foundInImport).map((l) => l.status));
const knownStatuses = new Set(['Draft', ...(dropdowns.status ?? [])].filter((x) => !importedStatuses.has(x)));
const statusCounts: Record<string, { total: number; inRf: number }> = {};
for (const o of offers) {
  const s = String(o.buildStatus ?? '');
  if (!s || knownStatuses.has(s)) continue;
  statusCounts[s] ??= { total: 0, inRf: 0 };
  statusCounts[s].total++;
  if (imp(o).inExcelRfTab) statusCounts[s].inRf++;
}
for (const [s, c] of Object.entries(statusCounts)) {
  addIssue({
    type: 'new_status',
    severity: 'issue',
    offerId: null,
    offerName: '',
    file: 'Both',
    row: null,
    column: 'Status',
    excelValue: s,
    valueUsed: s,
    message: `Status "${s}" is used by ${c.total} offers (${c.inRf} in the R&F tab) but is not in the status list. Added to the lifecycle with the tag "Found in imported data".`,
    offerIds: offers.filter((o) => o.buildStatus === s).map((o) => o.offerId as number),
  });
}
const knownPairs = new Set(
  reference.categorySubCategory.filter((p) => !p.foundInImport).map((p) => `${p.category}|${p.subCategory}`),
);
const pairCounts: Record<string, number> = {};
for (const o of rfOffers) {
  const k = `${o.category ?? ''}|${o.subCategory ?? ''}`;
  if (!o.category || !o.subCategory || knownPairs.has(k)) continue;
  pairCounts[k] = (pairCounts[k] ?? 0) + 1;
}
for (const [k, n] of Object.entries(pairCounts)) {
  const [category, subCategory] = k.split('|');
  addIssue({
    type: 'new_category_pair',
    severity: 'issue',
    offerId: null,
    offerName: '',
    file: 'R&F tab',
    row: null,
    column: 'G/H',
    excelValue: `${category} / ${subCategory}`,
    valueUsed: `${category} / ${subCategory}`,
    message: `Category / Sub-Category pair used by ${n} R&F offers but missing from the reference list. Added with the tag "Found in imported data".`,
    offerIds: rfOffers
      .filter((o) => o.category === category && o.subCategory === subCategory)
      .map((o) => o.offerId as number),
  });
}

// ---------------------------------------------------------------- finalise offers
for (const o of offers) {
  o._uid = `imp-${o.offerId}`;
  o._updatedAt = IMPORTED_AT_ISO;
}

// ---------------------------------------------------------------- counts
const ids = offers.map((o) => o.offerId as number);
const dupIds = ids.length - new Set(ids).size;
const ci = (s: unknown) => String(s ?? '').toLowerCase();
const impOnly = offers.filter((o) => ci(o.offerDesign) === 'imp only').length;
const includedRf = offers.filter(
  (o) => String(o.buildStatus ?? '') !== '' && ci(o.buildStatus) !== 'cancelled' && ci(o.offerDesign) !== 'imp only',
).length;
const mdNotInRf = offers.filter((o) => imp(o).source === 'Metadata only');
const mdNotInRfRecent = mdNotInRf.filter((o) => String(o.startDate ?? '') >= '2025-11-01').length;
const cancelled = offers.filter((o) => ci(o.buildStatus) === 'cancelled').length;
const blankStatus = offers.filter((o) => String(o.buildStatus ?? '') === '').length;

const report = {
  importedOn: IMPORTED_ON,
  files: {
    rf: 'data/source/rf_live.csv (Excel Calendar, tab "LIVE - Results and Forecast")',
    metadata: 'data/source/metadata_master.csv (Excel Metadata, tab "Master Sheet")',
  },
  counts: {
    rfDataRows: rfData.length,
    metadataRealOffers: mdReal.length,
    metadataEmptyRows: mdEmpty,
    metadataFailedLookupRows: mdNA,
    rfMatchedToMetadata: matched,
    rfNotInMetadata: rfOnly.length,
    metadataNotInRf: mdNotInRf.length,
    metadataNotInRfStartingFrom20251101: mdNotInRfRecent,
    offersImported: offers.length,
    duplicateOfferIds: dupIds,
    impOnlyOffers: impOnly,
    cancelledOffers: cancelled,
    blankStatusOffers: blankStatus,
    includedInResultsForecast: includedRf,
    filesDisagreeOffers: disagreeOffers.size,
    duplicateNames,
    redemptionConversion250: offers.filter((o) => o.redemptionConversion === 2.5).length,
    redemptionConversion2: offers.filter((o) => o.redemptionConversion === 2).length,
  },
  newStatuses: statusCounts,
  newCategoryPairs: pairCounts,
  filesDisagreeOfferNames: [...disagreeOffers].map((id) => String(byId.get(id)?.offerName ?? id)),
  excelHeaderNote: { Y1: trim(rf[0]?.[colIndex('Y')]), Z1: trim(rf[0]?.[colIndex('Z')]), AA1: trim(rf[0]?.[colIndex('AA')]) },
  issues,
};

// ---------------------------------------------------------------- snapshots
const rfSnapshot = {
  exportedOn: IMPORTED_ON,
  columns: RF_LETTERS,
  headers: RF_LETTERS.map((L) => normHeader(rf[RF_HEADER_ROW][colIndex(L)])),
  rows: rfOffers.map((o) => {
    const i = imp(o);
    const r = rfData.find((x) => x.row === i.excelRfRow)!.r;
    return { offerId: o.offerId, row: i.excelRfRow, v: RF_LETTERS.map((L) => cell(r, L)) };
  }),
};
const MD_SNAP_LETTERS = colRange('BW', 'FC');
const mdSnapshot = {
  exportedOn: IMPORTED_ON,
  columns: MD_SNAP_LETTERS,
  headers: MD_SNAP_LETTERS.map((L) => normHeader(md[MD_HEADER_ROW][colIndex(L)])),
  rows: offers
    .filter((o) => mdRowByOffer.has(o))
    .map((o) => {
      const r = mdRowByOffer.get(o)!;
      return { offerId: o.offerId, row: imp(o).excelMetadataRow, v: MD_SNAP_LETTERS.map((L) => cell(r, L)) };
    }),
};

// ---------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'offers.base.json'), JSON.stringify(offers));
fs.writeFileSync(path.join(OUT, 'excelSnapshot.rf.json'), JSON.stringify(rfSnapshot));
fs.writeFileSync(path.join(OUT, 'excelSnapshot.metadata.json'), JSON.stringify(mdSnapshot));
fs.writeFileSync(path.join(OUT, 'importReport.json'), JSON.stringify(report, null, 1));

console.log('Import complete');
console.table(report.counts);
console.log('New statuses:', statusCounts);
console.log('New category pairs:', pairCounts);
console.log('Issues by type:', issues.reduce<Record<string, number>>((a, x) => ((a[x.type] = (a[x.type] ?? 0) + 1), a), {}));
