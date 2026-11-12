import { useMemo, useState } from 'react';
import { Download, ExternalLink, Check, CircleAlert } from 'lucide-react';
import { useAppStore, isChangedSinceImport } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { importMetaOf } from '@/store/importedBase';
import { computeRfCells, RF_COLUMNS } from '@/lib/rfEngine';
import { computeMdCells } from '@/lib/mdEngine';
import { RF_BY_LETTER } from '@/lib/forecastColumnRegistry';
import { MD_REGISTRY } from '@/lib/mdRegistry';
import {
  runCheck,
  metadataReason,
  REASONS,
  type CheckResult,
  type MismatchReason,
} from '@/lib/excelCheck';
import { useRfSnapshot, useMetadataSnapshot, useImportReport, type ImportReport } from '@/lib/importData';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { OfferRecord } from '@/lib/types';

/** The Check tab always uses the Excel export date. */
const CHECK_DATE = new Date(2026, 10, 11);

const REASON_HELP: Record<MismatchReason, string> = {
  'Export rounding': 'The CSV rounded an input percentage or $ that the formula used; the import rebuilt the exact value, but some rows only have the rounded display.',
  'The 2 files disagree': 'The offer is one of the 15 where the Metadata file and the R&F tab hold different values. The import uses the R&F value.',
  'Excel data issue': 'Excel itself is inconsistent: an error cell, a text in a number cell, a formula missing or overwritten, an Excel lookup into the R&F tab that finds no row (Excel shows null), or the EQ range comparison Excel cannot evaluate.',
  'Pasted history value': 'Metadata rows older than the live formulas hold pasted values: blank, TBD or a frozen number on a row starting before 2025.',
  'Logic difference': 'Anything else. A logic difference is a bug in the prototype.',
};

export function RfCheckTab({ onOpen }: { onOpen: (uid: string) => void }) {
  const offers = useAppStore((s) => s.offers);
  const offerDiffs = useAppStore((s) => s.offerDiffs);
  const rfSnap = useRfSnapshot();
  const mdSnap = useMetadataSnapshot();
  const report = useImportReport();

  const isChanged = (o: OfferRecord) => isChangedSinceImport(o._uid, offerDiffs);

  const rfRes = useMemo<CheckResult | null>(() => {
    if (!rfSnap || !report) return null;
    const cols = RF_COLUMNS.slice(RF_COLUMNS.indexOf('S')).map((c) => ({ letter: c, header: RF_BY_LETTER[c].header, format: RF_BY_LETTER[c].format }));
    return runCheck({ offers, snapshot: rfSnap, columns: cols, compute: (o) => computeRfCells(o, CHECK_DATE), isChanged, issues: report.issues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfSnap, report, offers, offerDiffs]);

  const mdRes = useMemo<CheckResult | null>(() => {
    if (!mdSnap || !report) return null;
    const byId = new Map(offers.map((o) => [o.offerId, o]));
    const cols = MD_REGISTRY.filter((e) => e.band !== 'MD_BASICS').map((e) => ({ letter: e.letter, header: e.header, format: e.format }));
    return runCheck({
      offers,
      snapshot: mdSnap,
      columns: cols,
      compute: (o) => computeMdCells(o, CHECK_DATE, importMetaOf(o._uid)),
      isChanged,
      issues: report.issues,
      extraReason: (id, L, t) => {
        const o = byId.get(id);
        return metadataReason(o, !!importMetaOf(o?._uid)?.inExcelRfTab, t, L);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mdSnap, report, offers, offerDiffs]);

  if (!rfRes || !report) return <p className="rounded-lg border border-border bg-white p-4 text-sm text-muted">Loading the Excel snapshots…</p>;

  return (
    <div className="space-y-5 text-sm">
      <p className="text-xs text-muted">
        Compares the prototype with the Excel exports cell by cell, as of the export date 11/11/2026. Only imported offers that have not been changed since import are compared.
        Numbers match within max(1, 0.5% of the Excel value); percentages match on the displayed precision; text matches exactly; Excel "null" equals "Not available".
      </p>
      <CheckSection title="Results and Forecast tab (columns S to BZ)" res={rfRes} file="rf" onOpen={onOpen} />
      {mdRes ? (
        <CheckSection title="Metadata file (columns BW to FC)" res={mdRes} file="metadata" onOpen={onOpen} />
      ) : (
        <p className="text-xs text-muted">Loading the Metadata snapshot…</p>
      )}
      <ReasonLegend />
      <ImportSummary report={report} />
      <DataIssues report={report} onOpen={onOpen} />
    </div>
  );
}

function pct(n: number, d: number) {
  return d ? `${((100 * n) / d).toFixed(n === d ? 0 : 2)}%` : 'n/a';
}

function CheckSection({ title, res, file, onOpen }: { title: string; res: CheckResult; file: string; onOpen: (uid: string) => void }) {
  const push = useToasts((s) => s.push);
  const [col, setCol] = useState<string | null>(null);
  const [reason, setReason] = useState<MismatchReason | ''>('');
  const list = res.mismatches.filter((m) => (!col || m.letter === col) && (!reason || m.reason === reason));
  const CAP = 300;

  function exportList() {
    downloadCsv(
      `check-against-excel-${file}`,
      toCsv(['Offer ID', 'Offer Name', 'Column', 'Header', 'Excel text', 'Prototype value', 'Reason'], list.map((m) => [m.offerId, m.offerName, m.letter, m.header, m.excel, m.proto, m.reason])),
    );
    push(`Exported ${list.length} mismatches.`, 'success');
  }

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card label="Offers compared" value={res.offersCompared.toLocaleString()} />
        <Card label="Cells compared" value={res.cellsCompared.toLocaleString()} />
        <Card label="Match" value={pct(res.matches, res.cellsCompared)} />
        <Card
          label="Mismatches by reason"
          value={
            <ul className="text-[11px] font-normal">
              {REASONS.map((r) => (
                <li key={r} className={r === 'Logic difference' && res.byReason[r] > 0 ? 'text-danger' : ''}>{r}: {res.byReason[r].toLocaleString()}</li>
              ))}
            </ul>
          }
        />
      </div>
      {res.changedNotCompared.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          Changed since import (not compared): {res.changedNotCompared.map((c) => c.offerName).slice(0, 8).join(', ')}
          {res.changedNotCompared.length > 8 ? ` and ${res.changedNotCompared.length - 8} more` : ''}.
        </p>
      )}
      <div className="mb-4 max-h-[42vh] overflow-auto rounded border border-border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface text-muted">
            <tr>
              <th className="px-2 py-1.5">Col</th><th className="px-2">Excel header</th><th className="px-2 text-right">Compared</th><th className="px-2 text-right">Matches</th><th className="px-2 text-right">Match %</th>
              {REASONS.map((r) => <th key={r} className="px-2 text-right">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {res.columns.map((c) => {
              const full = c.matches === c.compared;
              return (
                <tr key={c.letter} onClick={() => setCol(col === c.letter ? null : c.letter)} className={`cursor-pointer border-t border-border/50 hover:bg-surface ${col === c.letter ? 'bg-primary/5' : ''}`}>
                  <td className="px-2 py-1 font-medium">{c.letter}</td>
                  <td className="max-w-[260px] truncate px-2" title={c.header}>{c.header}</td>
                  <td className="px-2 text-right tabular-nums">{c.compared.toLocaleString()}</td>
                  <td className="px-2 text-right tabular-nums">{c.matches.toLocaleString()}</td>
                  <td className={`px-2 text-right tabular-nums ${full ? 'text-success' : ''}`}>
                    <span className="inline-flex items-center gap-1">{full ? <Check size={11} /> : null}{pct(c.matches, c.compared)}</span>
                  </td>
                  {REASONS.map((r) => (
                    <td key={r} className={`px-2 text-right tabular-nums ${r === 'Logic difference' && c.byReason[r] ? 'font-semibold text-danger' : 'text-muted'}`}>{c.byReason[r] || ''}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">Mismatch list</span>
        {col && <button onClick={() => setCol(null)} className="rounded-full border border-primary px-2 text-primary">Column {col} ×</button>}
        <select value={reason} onChange={(e) => setReason(e.target.value as MismatchReason | '')} className="rounded border border-border px-1.5 py-0.5">
          <option value="">Reason: All</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-muted">{list.length.toLocaleString()} mismatches{list.length > CAP ? `, first ${CAP} shown` : ''}</span>
        <button onClick={exportList} className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-surface"><Download size={12} /> Export mismatch list (CSV)</button>
      </div>
      {list.length === 0 ? (
        <p className="flex items-center gap-1 text-xs text-success"><Check size={12} /> No mismatches for this selection.</p>
      ) : (
        <div className="max-h-[40vh] overflow-auto rounded border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-muted"><tr><th className="px-2 py-1.5">Offer ID</th><th className="px-2">Offer Name</th><th className="px-2">Column</th><th className="px-2">Excel text</th><th className="px-2">Prototype</th><th className="px-2">Reason</th><th /></tr></thead>
            <tbody>
              {list.slice(0, CAP).map((m, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="px-2 py-1 tabular-nums">{m.offerId}</td>
                  <td className="max-w-[220px] truncate px-2" title={m.offerName}>{m.offerName}</td>
                  <td className="px-2" title={m.header}>{m.letter}</td>
                  <td className="px-2">{m.excel === '' ? <span className="text-muted">(blank)</span> : m.excel}</td>
                  <td className="px-2">{m.proto === '' ? <span className="text-muted">(blank)</span> : m.proto === 'null' ? 'Not available' : m.proto}</td>
                  <td className={`px-2 ${m.reason === 'Logic difference' ? 'text-danger' : 'text-muted'}`}>{m.reason}</td>
                  <td className="px-2"><button onClick={() => onOpen(m.uid)} className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink size={11} /> Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function ReasonLegend() {
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 font-semibold">Mismatch reasons</h3>
      <dl className="space-y-1 text-xs">
        {REASONS.map((r) => (
          <div key={r} className="grid grid-cols-[180px_minmax(0,1fr)] gap-2">
            <dt className={`font-medium ${r === 'Logic difference' ? 'text-danger' : ''}`}>{r}</dt>
            <dd className="text-muted">{REASON_HELP[r]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const COUNT_ROWS: Array<[string, string, string]> = [
  ['R&F data rows', 'rfDataRows', '768'],
  ['Metadata real offers', 'metadataRealOffers', '2,423'],
  ['Metadata empty rows', 'metadataEmptyRows', '477'],
  ['Metadata "#N/A" rows', 'metadataFailedLookupRows', '182'],
  ['R&F rows matched to Metadata by name', 'rfMatchedToMetadata', '766'],
  ['R&F rows not in Metadata', 'rfNotInMetadata', '2'],
  ['Metadata offers not in the R&F tab', 'metadataNotInRf', '1,657'],
  ['  of which start on or after 11/1/2025', 'metadataNotInRfStartingFrom20251101', '260'],
  ['Offers imported', 'offersImported', '2,425'],
  ['Duplicate Offer IDs', 'duplicateOfferIds', '0'],
  ['Offers included in Results & Forecast (B2 rule)', 'includedInResultsForecast', '2,127'],
  ['Offers where the 2 files disagree', 'filesDisagreeOffers', '15'],
];

function ImportSummary({ report }: { report: ImportReport }) {
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 font-semibold">Import summary</h3>
      <table className="w-full max-w-2xl text-left text-xs">
        <thead className="text-muted"><tr><th className="py-1">Check</th><th className="text-right">Expected</th><th className="text-right">Actual</th><th /></tr></thead>
        <tbody>
          {COUNT_ROWS.map(([label, key, expected]) => {
            const actual = report.counts[key] ?? 0;
            const ok = actual.toLocaleString() === expected;
            return (
              <tr key={key} className="border-t border-border/50">
                <td className="whitespace-pre py-1">{label}</td>
                <td className="text-right tabular-nums text-muted">{expected}</td>
                <td className="text-right tabular-nums">{actual.toLocaleString()}</td>
                <td className="pl-2">{ok ? <Check size={12} className="text-success" /> : <CircleAlert size={12} className="text-warning" />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">
        Found in imported data: statuses {Object.entries(report.newStatuses).map(([s, c]) => `"${s}" (${c.total})`).join(', ')}; {Object.keys(report.newCategoryPairs).length} category / sub-category pairs.
      </p>
    </section>
  );
}

const ISSUE_TYPE_LABEL: Record<string, string> = {
  rf_only: 'R&F-only offers (Offer ID created on import)',
  text_in_number: 'Text in a number cell',
  files_disagree: 'The 2 files disagree',
  new_status: 'New statuses',
  new_category_pair: 'New category / sub-category pairs',
  duplicate_name: 'Duplicate name in the Metadata file',
  failed_lookup: 'Failed lookups ("#N/A" rows skipped)',
  excel_formula_gap: 'Excel formula missing or overwritten',
  excel_error_cells: 'Excel error cells in a Metadata row',
  rounded_export: 'Rounded export values (informational)',
};

function DataIssues({ report, onOpen }: { report: ImportReport; onOpen: (uid: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, ImportReport['issues']>();
    for (const i of report.issues) {
      if (!m.has(i.type)) m.set(i.type, []);
      m.get(i.type)!.push(i);
    }
    return [...m.entries()];
  }, [report]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 font-semibold">Data issues</h3>
      <div className="space-y-1">
        {groups.map(([type, list]) => (
          <div key={type} className="rounded border border-border/60">
            <button onClick={() => setOpen(open === type ? null : type)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-surface">
              <span className="font-medium">{ISSUE_TYPE_LABEL[type] ?? type}</span>
              <span className="tabular-nums text-muted">{list.length.toLocaleString()}</span>
            </button>
            {open === type && (
              <ul className="max-h-60 divide-y divide-border/50 overflow-auto border-t border-border/60 text-xs">
                {list.slice(0, 400).map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-2 px-3 py-1">
                    <span>
                      {i.offerName && <span className="font-medium">{i.offerName}: </span>}
                      {i.message}
                      <span className="text-muted"> ({i.file}{i.row ? `, row ${i.row}` : ''}, {i.column})</span>
                    </span>
                    {i.offerId !== null && (
                      <button onClick={() => onOpen(`imp-${i.offerId}`)} className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline">
                        <ExternalLink size={11} /> Open offer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
