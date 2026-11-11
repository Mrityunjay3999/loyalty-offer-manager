// v3: lazy access to the generated import report and Excel snapshots. They are
// loaded with dynamic import() only when a tab or drawer needs them.
import { useEffect, useState } from 'react';
import type { ImportIssue, Snapshot } from './excelCheck';

export interface ImportReport {
  importedOn: string;
  files: Record<string, string>;
  counts: Record<string, number>;
  newStatuses: Record<string, { total: number; inRf: number }>;
  newCategoryPairs: Record<string, number>;
  filesDisagreeOfferNames: string[];
  excelHeaderNote: { Y1: string; Z1: string; AA1: string };
  issues: ImportIssue[];
}

let reportP: Promise<ImportReport> | null = null;
let rfSnapP: Promise<Snapshot> | null = null;
let mdSnapP: Promise<Snapshot> | null = null;
let reportCache: ImportReport | null = null;
let rfSnapCache: Snapshot | null = null;
let mdSnapCache: Snapshot | null = null;

export function loadImportReport(): Promise<ImportReport> {
  reportP ??= import('@/data/imported/importReport.json').then((m) => {
    reportCache = (m.default ?? m) as unknown as ImportReport;
    return reportCache;
  });
  return reportP;
}
export function loadRfSnapshot(): Promise<Snapshot> {
  rfSnapP ??= import('@/data/imported/excelSnapshot.rf.json').then((m) => {
    rfSnapCache = (m.default ?? m) as unknown as Snapshot;
    return rfSnapCache;
  });
  return rfSnapP;
}
export function loadMetadataSnapshot(): Promise<Snapshot> {
  mdSnapP ??= import('@/data/imported/excelSnapshot.metadata.json').then((m) => {
    mdSnapCache = (m.default ?? m) as unknown as Snapshot;
    return mdSnapCache;
  });
  return mdSnapP;
}

function useLazy<T>(cache: () => T | null, load: () => Promise<T>): T | null {
  const [v, setV] = useState<T | null>(cache);
  useEffect(() => {
    if (v) return;
    let live = true;
    void load().then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, [v, load]);
  return v;
}
export const useImportReport = () => useLazy(() => reportCache, loadImportReport);
export const useRfSnapshot = () => useLazy(() => rfSnapCache, loadRfSnapshot);
export const useMetadataSnapshot = () => useLazy(() => mdSnapCache, loadMetadataSnapshot);

/** Index a snapshot by Offer ID -> { row, values by column letter }. */
export function snapshotIndex(s: Snapshot | null): Map<number, { row: number; byLetter: Record<string, string> }> {
  const m = new Map<number, { row: number; byLetter: Record<string, string> }>();
  if (!s) return m;
  for (const r of s.rows) {
    const byLetter: Record<string, string> = {};
    s.columns.forEach((c, i) => (byLetter[c] = r.v[i] ?? ''));
    m.set(r.offerId, { row: r.row, byLetter });
  }
  return m;
}
