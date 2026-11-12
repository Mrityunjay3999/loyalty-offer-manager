// v3 E1: compare the prototype's calculations with the Excel snapshots, cell by
// cell, and classify every mismatch. Used by the "Check against Excel" tab and
// the reconciliation test.
import type { XVal } from './excel';
import { compareCell, type Fmt } from './excelFormat';
import type { OfferRecord } from './types';

export type MismatchReason =
  | 'Export rounding'
  | 'The 2 files disagree'
  | 'Excel data issue'
  | 'Pasted history value'
  | 'Logic difference';

export const REASONS: MismatchReason[] = [
  'Export rounding',
  'The 2 files disagree',
  'Excel data issue',
  'Pasted history value',
  'Logic difference',
];

export interface Snapshot {
  exportedOn: string;
  columns: string[];
  headers: string[];
  rows: Array<{ offerId: number; row: number; v: string[] }>;
}

export interface ImportIssue {
  id: string;
  type: string;
  severity: 'issue' | 'info';
  offerId: number | null;
  offerName: string;
  file: string;
  row: number | null;
  column: string;
  excelValue: string;
  valueUsed: string;
  message: string;
  offerIds?: number[];
}

export interface CheckColumn {
  letter: string;
  header: string;
  format: Fmt;
}

export interface Mismatch {
  offerId: number;
  offerName: string;
  uid: string;
  letter: string;
  header: string;
  excel: string;
  proto: string;
  reason: MismatchReason;
}

export interface ColumnStat {
  letter: string;
  header: string;
  compared: number;
  matches: number;
  byReason: Record<MismatchReason, number>;
}

export interface CheckResult {
  offersCompared: number;
  cellsCompared: number;
  matches: number;
  columns: ColumnStat[];
  mismatches: Mismatch[];
  changedNotCompared: Array<{ offerId: number; offerName: string; uid: string }>;
  byReason: Record<MismatchReason, number>;
}

const emptyReasons = (): Record<MismatchReason, number> =>
  Object.fromEntries(REASONS.map((r) => [r, 0])) as Record<MismatchReason, number>;

/** Issue types per Offer ID, for classification. */
export function issueTypesByOffer(issues: ImportIssue[]): Map<number, Set<string>> {
  const m = new Map<number, Set<string>>();
  const add = (id: number | null, t: string) => {
    if (id === null) return;
    if (!m.has(id)) m.set(id, new Set());
    m.get(id)!.add(t);
  };
  for (const i of issues) {
    add(i.offerId, i.type);
    for (const id of i.offerIds ?? []) add(id, i.type);
  }
  return m;
}

/** E1 reasons, in priority order. */
export function classify(
  offerId: number,
  types: Map<number, Set<string>>,
  extra?: (offerId: number) => MismatchReason | null,
): MismatchReason {
  const t = types.get(offerId) ?? new Set<string>();
  if (t.has('files_disagree')) return 'The 2 files disagree';
  if (t.has('text_in_number') || t.has('excel_formula_gap') || t.has('excel_error_cells')) return 'Excel data issue';
  const x = extra?.(offerId);
  if (x) return x;
  if (t.has('rounded_export')) return 'Export rounding';
  return 'Logic difference';
}

/**
 * Generic comparison of computed cells against a snapshot.
 * `compute(o)` returns the cell values keyed by column letter.
 */
export function runCheck(params: {
  offers: OfferRecord[];
  snapshot: Snapshot;
  columns: CheckColumn[];
  compute: (o: OfferRecord) => Record<string, XVal>;
  isChanged: (o: OfferRecord) => boolean;
  issues: ImportIssue[];
  extraReason?: (offerId: number, letter: string, excelText: string) => MismatchReason | null;
}): CheckResult {
  const { offers, snapshot, columns, compute, isChanged, issues, extraReason } = params;
  const byId = new Map<number, OfferRecord>();
  for (const o of offers) if (typeof o.offerId === 'number') byId.set(o.offerId, o);
  const types = issueTypesByOffer(issues);
  const idx = Object.fromEntries(snapshot.columns.map((c, i) => [c, i]));

  const stats: Record<string, ColumnStat> = {};
  for (const c of columns) {
    stats[c.letter] = { letter: c.letter, header: c.header, compared: 0, matches: 0, byReason: emptyReasons() };
  }
  const mismatches: Mismatch[] = [];
  const changedNotCompared: CheckResult['changedNotCompared'] = [];
  const byReason = emptyReasons();
  let offersCompared = 0;

  for (const row of snapshot.rows) {
    const o = byId.get(row.offerId);
    if (!o) continue;
    if (isChanged(o)) {
      changedNotCompared.push({ offerId: row.offerId, offerName: String(o.offerName ?? ''), uid: String(o._uid ?? '') });
      continue;
    }
    offersCompared++;
    const cells = compute(o);
    for (const c of columns) {
      const i = idx[c.letter];
      if (i === undefined) continue;
      const excelText = row.v[i] ?? '';
      const r = compareCell(excelText, cells[c.letter] ?? '', c.format);
      const s = stats[c.letter];
      s.compared++;
      if (r.match) {
        s.matches++;
        continue;
      }
      const reason = classify(row.offerId, types, (id) => extraReason?.(id, c.letter, excelText) ?? null);
      s.byReason[reason]++;
      byReason[reason]++;
      mismatches.push({
        offerId: row.offerId,
        offerName: String(o.offerName ?? ''),
        uid: String(o._uid ?? ''),
        letter: c.letter,
        header: c.header,
        excel: r.excel,
        proto: r.proto,
        reason,
      });
    }
  }
  const cols = columns.map((c) => stats[c.letter]);
  return {
    offersCompared,
    cellsCompared: cols.reduce((a, s) => a + s.compared, 0),
    matches: cols.reduce((a, s) => a + s.matches, 0),
    columns: cols,
    mismatches,
    changedNotCompared,
    byReason,
  };
}

/**
 * E1 reasons specific to the Metadata file:
 * - an Excel error or "null" from a lookup into the Results and Forecast tab that
 *   finds no row for the offer -> Excel data issue;
 * - a blank or frozen number on a row whose start date is before 2025 ->
 *   Pasted history value.
 */
export function metadataReason(
  o: Record<string, unknown> | undefined,
  inExcelRfTab: boolean,
  excelText: string,
  letter?: string,
): MismatchReason | null {
  const t = String(excelText ?? '').trim();
  if (/^#/.test(t)) return 'Excel data issue';
  if (t === 'null' && !inExcelRfTab) return 'Excel data issue';
  // EQ: Excel compares a range of cells to 100%, which it cannot evaluate reliably
  // and shows blank; the prototype checks that the 5 shares add up to 100% (D1).
  if (letter === 'EQ' && t === '') return 'Excel data issue';
  const start = String(o?.startDate ?? '');
  if (start && start < '2025-01-01' && (t === '' || t === 'TBD' || /^[$(\-\d]/.test(t))) return 'Pasted history value';
  return null;
}
