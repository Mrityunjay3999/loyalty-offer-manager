import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Download } from 'lucide-react';
import { useAppStore, isChangedSinceImport } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { importMetaOf } from '@/store/importedBase';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { MultiSelect } from '@/components/MultiSelect';
import { ExcelGrid, type ExcelColumn } from '@/components/ExcelGrid';
import { rfColumn, BAND_STYLE } from '@/components/rf/rfColumns';
import { RfDetailDrawer } from '@/components/rf/RfDetailDrawer';
import { RfHowTab } from '@/components/rf/RfHowTab';
import { statusOf } from '@/lib/lifecycle';
import { computeRfCells, EXCEL_EXPORT_DATE } from '@/lib/rfEngine';
import { forecastNeeded, includeForResultsForecast } from '@/lib/calculations';
import { fiscalYearOf } from '@/lib/offers';
import { can } from '@/lib/permissions';
import { todayISO } from '@/lib/format';
import { toCsv, downloadCsv } from '@/lib/csv';
import { REGISTRY, RF_REGISTRY, CALENDAR_BAND, type RegistryEntry } from '@/lib/forecastColumnRegistry';
import { GRID_ENTRIES, RF_PRESETS, COMPLETED_OR_LATER, buildExportTable } from '@/lib/rfGrid';
import { useImportReport } from '@/lib/importData';
import type { OfferRecord } from '@/lib/types';

type RowsMode = 'excel' | 'all';
const SOURCES = ['Excel R&F tab + Metadata', 'Metadata only', 'Excel R&F tab only', 'Created in prototype'];

interface Filters {
  search: string;
  fy: string;
  status: string;
  category: string;
  sub: string[];
  tier: string;
  design: string;
  markets: string[];
  dash: string[];
  colour: string;
  source: string;
  changed: boolean;
  hasIssue: boolean;
  resultsMissing: boolean;
  forecastMissing: boolean;
  fcstNeeded: boolean;
}
const EMPTY: Filters = {
  search: '', fy: '', status: '', category: '', sub: [], tier: '', design: '', markets: [], dash: [],
  colour: '', source: '', changed: false, hasIssue: false, resultsMissing: false, forecastMissing: false, fcstNeeded: false,
};

/** ISO yyyy-MM-dd -> local midnight Date. */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function sourceOf(o: OfferRecord): string {
  const m = importMetaOf(o._uid);
  if (m) return m.source;
  return o._demoSample ? 'Demo sample' : 'Created in prototype';
}

export function ResultsForecast() {
  const offers = useAppStore((s) => s.offers);
  const offerDiffs = useAppStore((s) => s.offerDiffs);
  const role = useAppStore((s) => s.role);
  const userId = useAppStore((s) => s.currentUserId);
  const canForecast = can(role, 'enterForecast');
  const canResults = can(role, 'enterResults');
  const push = useToasts((s) => s.push);
  const report = useImportReport();

  // C2.1 rows selector, remembered per user
  const modeKey = `lom-rf-rows-${userId}`;
  const [mode, setModeState] = useState<RowsMode>(() => {
    try {
      return localStorage.getItem(modeKey) === 'all' ? 'all' : 'excel';
    } catch {
      return 'excel';
    }
  });
  const setMode = (m: RowsMode) => {
    setModeState(m);
    try {
      localStorage.setItem(modeKey, m);
    } catch {
      /* ignore */
    }
  };
  // C2.2 as-of date
  const [asOfIso, setAsOfIso] = useState(todayISO());
  const asOf = useMemo(() => isoToDate(asOfIso), [asOfIso]);

  const [f, setF] = useState<Filters>(EMPTY);
  const patch = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const [detailUid, setDetailUid] = useState<string | null>(null);

  // B2: only offers whose "Include for Results and Forecast?" is Yes.
  const included = useMemo(() => offers.filter((o) => includeForResultsForecast(o) === 'Yes'), [offers]);
  const excelRows = useMemo(
    () => included.filter((o) => {
      const m = importMetaOf(o._uid);
      return m ? m.inExcelRfTab : true; // + offers created in the prototype
    }),
    [included],
  );
  const base = mode === 'all' ? included : excelRows;

  const opts = useMemo(() => {
    const d = (fn: (o: OfferRecord) => string) => [...new Set(base.map(fn).filter(Boolean))].sort();
    return {
      fy: d((o) => fiscalYearOf(o) || importMetaOf(o._uid)?.fiscal?.fy || ''),
      status: d((o) => statusOf(o)),
      category: d((o) => String(o.category ?? '')),
      sub: d((o) => String(o.subCategory ?? '')),
      tier: d((o) => String(o.offerTiering ?? '')),
      design: d((o) => String(o.offerDesign ?? '')),
      markets: d((o) => String(o.country ?? '')),
      dash: d((o) => String(o.dashboardMonth ?? '')),
    };
  }, [base]);

  const rows = useMemo(() => {
    const q = f.search.trim().toLowerCase();
    return base.filter((o) => {
      if (q && !`${o.offerName ?? ''} ${o.offerId ?? ''}`.toLowerCase().includes(q)) return false;
      if (f.fy && (fiscalYearOf(o) || importMetaOf(o._uid)?.fiscal?.fy || '') !== f.fy) return false;
      if (f.status && statusOf(o) !== f.status) return false;
      if (f.category && o.category !== f.category) return false;
      if (f.sub.length && !f.sub.includes(String(o.subCategory ?? ''))) return false;
      if (f.tier && o.offerTiering !== f.tier) return false;
      if (f.design && o.offerDesign !== f.design) return false;
      if (f.markets.length && !f.markets.includes(String(o.country ?? ''))) return false;
      if (f.dash.length && !f.dash.includes(String(o.dashboardMonth ?? ''))) return false;
      if (f.source && sourceOf(o) !== f.source) return false;
      if (f.changed && !isChangedSinceImport(o._uid, offerDiffs)) return false;
      if (f.hasIssue && !(importMetaOf(o._uid)?.issues.length)) return false;
      if (f.fcstNeeded && forecastNeeded(o) !== 'Yes') return false;
      if (f.colour || f.resultsMissing || f.forecastMissing) {
        const c = computeRfCells(o, asOf);
        if (f.colour && c.BZ !== f.colour) return false;
        if (f.resultsMissing && !(c.O === 0 && c.P === 0 && c.Q === 0 && c.R === 0 && COMPLETED_OR_LATER.has(statusOf(o)))) return false;
        if (f.forecastMissing && !(c.AF === 0 && c.AG === 0)) return false;
      }
      return true;
    });
  }, [base, f, offerDiffs, asOf]);

  const issuesByOffer = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const i of report?.issues ?? []) {
      if (i.severity !== 'issue') continue;
      for (const id of [i.offerId, ...(i.offerIds ?? [])]) {
        if (id === null || id === undefined) continue;
        if (!m.has(id)) m.set(id, []);
        if (!m.get(id)!.includes(i.message)) m.get(id)!.push(i.message);
      }
    }
    return m;
  }, [report]);

  const badges = useCallback(
    (o: OfferRecord): ReactNode => {
      const meta = importMetaOf(o._uid);
      const out: ReactNode[] = [];
      if (isChangedSinceImport(o._uid, offerDiffs)) {
        out.push(<span key="c" className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800" title="Edited in the prototype. The Excel snapshot is unchanged.">Changed since import</span>);
      }
      if (meta?.issues.length) {
        const msgs = typeof o.offerId === 'number' ? issuesByOffer.get(o.offerId) ?? [] : [];
        out.push(<IssueBadge key="i" messages={msgs} />);
      }
      if (o._demoSample) out.push(<span key="d" className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">Demo sample</span>);
      if (mode === 'all' && meta?.source === 'Metadata only') {
        out.push(<span key="m" className="shrink-0 rounded-full border border-slate-300 px-1.5 text-[10px] text-slate-600" title="In the Metadata file but not in the Excel Results and Forecast tab.">Metadata only</span>);
      }
      return out.length ? <>{out}</> : null;
    },
    [offerDiffs, issuesByOffer, mode],
  );

  const ctx = useMemo(() => ({ asOf, metaOf: importMetaOf, badges }), [asOf, badges]);
  const gridColumns = useMemo<ExcelColumn[]>(() => GRID_ENTRIES.map((e) => rfColumn(e, ctx)), [ctx]);
  const wbrEntries = useMemo(
    () => ['A', 'J', 'C', 'B', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ'].map((L) => RF_REGISTRY.find((e) => e.letter === L)!),
    [],
  );
  const wbrColumns = useMemo<ExcelColumn[]>(() => wbrEntries.map((e) => rfColumn(e, ctx)), [wbrEntries, ctx]);

  // Exports read exactly what the grid shows (visible columns, filtered + sorted rows).
  const gridView = useRef<{ visible: string[]; rows: OfferRecord[] }>({ visible: [], rows: [] });
  const wbrView = useRef<{ visible: string[]; rows: OfferRecord[] }>({ visible: [], rows: [] });
  const onGridView = useCallback((v: { visible: string[]; rows: OfferRecord[] }) => (gridView.current = v), []);
  const onWbrView = useCallback((v: { visible: string[]; rows: OfferRecord[] }) => (wbrView.current = v), []);
  const byKey = useMemo(() => Object.fromEntries(REGISTRY.map((e) => [e.key, e])), []);

  function exportView(view: { visible: string[]; rows: OfferRecord[] }, name: string) {
    const entries = view.visible.map((k) => byKey[k]).filter(Boolean) as RegistryEntry[];
    const t = buildExportTable(entries, view.rows, asOf, importMetaOf);
    downloadCsv(name, toCsv(t.header, [t.letters, ...t.data]));
    push(`Exported ${view.rows.length} rows x ${entries.length} columns.`, 'success');
  }
  function exportAllForecasting() {
    const groups: Array<[string, RegistryEntry[]]> = [
      ['Results and Forecast tab (A to BZ)', RF_REGISTRY],
      ['CALENDAR (offer form)', CALENDAR_BAND],
    ];
    const g = groups.flatMap(([label, es]) => es.map(() => label));
    const t = buildExportTable(groups.flatMap(([, es]) => es), gridView.current.rows, asOf, importMetaOf);
    downloadCsv('all-forecasting-columns', toCsv(g, [t.header, t.letters, ...t.data]));
    push(`Exported ${gridView.current.rows.length} offers x ${t.header.length} columns.`, 'success');
  }

  const detail = offers.find((o) => o._uid === detailUid);
  const activeFilters = Object.entries(f).filter(([, v]) => (Array.isArray(v) ? v.length : v)).length;

  return (
    <div>
      <PageHeader title="Results & Forecast" count={rows.length}>
        <MvpBadge />
        <span className="text-[11px] text-muted">Interim calculation. The analytics team's forecast and results models will replace these formulas after MVP.</span>
      </PageHeader>
      <p className="mb-2 text-sm text-muted">
        Calculated from each offer. Nothing is typed on this page. Forecast inputs and actual results
        are entered on the offer (Step 7 and Step 9).
      </p>
      <p className="mb-3 text-[11px] text-muted">
        Data: Excel exports of 11/11/2026. Results and Forecast tab (768 rows) and Metadata Master Sheet (2,423 offers). Imported into the prototype; edits made here do not change Excel.
      </p>

      {/* C2 header controls */}
      <div className="mb-3 grid gap-3 rounded-lg border border-border bg-white p-3 lg:grid-cols-2">
        <div>
          <div className="inline-flex overflow-hidden rounded border border-border text-xs" role="radiogroup" aria-label="Rows">
            <button role="radio" aria-checked={mode === 'excel'} onClick={() => setMode('excel')} className={`px-3 py-1 ${mode === 'excel' ? 'bg-primary text-white' : 'bg-white'}`}>
              Same rows as Excel ({excelRows.length.toLocaleString()})
            </button>
            <button role="radio" aria-checked={mode === 'all'} onClick={() => setMode('all')} className={`px-3 py-1 ${mode === 'all' ? 'bg-primary text-white' : 'bg-white'}`}>
              All included offers ({included.length.toLocaleString()})
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Excel only lists an offer in this tab after someone types its reference number. 260 offers starting on or after 1 Nov 2025 are in the Metadata file but have no row in the Excel tab. In the product every offer that meets the rule appears automatically.
          </p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              As-of date
              <input type="date" value={asOfIso} onChange={(e) => e.target.value && setAsOfIso(e.target.value)} className="rounded border border-border px-1.5 py-0.5" />
            </label>
            <button onClick={() => setAsOfIso(EXCEL_EXPORT_DATE)} className="rounded border border-border px-2 py-0.5 hover:bg-surface">
              Use Excel export date (11/11/2026)
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">Prorated columns (BW to BZ) and Metadata prorated columns use this date.</p>
        </div>
      </div>

      {/* Shared filters (Grid, WBR) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2">
        <input className="min-w-[180px] flex-1 rounded border border-border px-2 py-1 text-sm" placeholder="Search name or Offer ID" value={f.search} onChange={(e) => patch({ search: e.target.value })} />
        <Sel label="Fiscal year" value={f.fy} options={opts.fy} onChange={(v) => patch({ fy: v })} />
        <Sel label="Status" value={f.status} options={opts.status} onChange={(v) => patch({ status: v })} />
        <Sel label="Category" value={f.category} options={opts.category} onChange={(v) => patch({ category: v })} />
        <MultiSelect label="Sub-Category" options={opts.sub} value={f.sub} onChange={(v) => patch({ sub: v })} />
        <Sel label="Tier" value={f.tier} options={opts.tier} onChange={(v) => patch({ tier: v })} />
        <Sel label="Offer Design" value={f.design} options={opts.design} onChange={(v) => patch({ design: v })} />
        <MultiSelect label="Markets" options={opts.markets} value={f.markets} onChange={(v) => patch({ markets: v })} />
        <MultiSelect label="Dashboard Mo." options={opts.dash} value={f.dash} onChange={(v) => patch({ dash: v })} />
        <Sel label="Colour code" value={f.colour} options={['Pink', 'Light green', 'Dark Green']} onChange={(v) => patch({ colour: v })} />
        <Sel label="Source" value={f.source} options={SOURCES} onChange={(v) => patch({ source: v })} />
        <Check label="Forecast needed = Yes" checked={f.fcstNeeded} onChange={(v) => patch({ fcstNeeded: v })} />
        <Check label="Changed since import" checked={f.changed} onChange={(v) => patch({ changed: v })} />
        <Check label="Has data issue" checked={f.hasIssue} onChange={(v) => patch({ hasIssue: v })} />
        <Check label="Results missing" checked={f.resultsMissing} onChange={(v) => patch({ resultsMissing: v })} title="Audience size, activations, bonused members and bonus points all 0, and status Completed or later." />
        <Check label="Forecast missing" checked={f.forecastMissing} onChange={(v) => patch({ forecastMissing: v })} title="Activation Low and High both 0." />
        {activeFilters > 0 && (
          <button onClick={() => setF(EMPTY)} className="rounded border border-border px-2 py-1 text-xs hover:bg-surface">Clear filters ({activeFilters})</button>
        )}
        <div className="ml-auto flex items-center gap-1 text-[11px] text-muted">
          {(['RESULTS', 'FORECAST', 'WBR', 'CALENDAR'] as const).map((b) => (
            <span key={b} className="flex items-center gap-1">
              <span className={`ml-1 inline-block h-3 w-3 rounded ${BAND_STYLE[b].legend}`} /> {b}
            </span>
          ))}
        </div>
      </div>

      <Tabs.Root defaultValue="grid">
        <Tabs.List className="mb-3 flex gap-1 border-b border-border">
          {[['grid', 'Grid'], ['wbr', 'WBR'], ['how', 'How it is calculated']].map(([v, l]) => (
            <Tabs.Trigger key={v} value={v} className="border-b-2 border-transparent px-3 py-2 text-sm text-muted data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-primary">
              {l}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="grid">
          {rows.length === 0 ? (
            <EmptyState title="No offers match these filters." />
          ) : (
            <ExcelGrid
              rows={rows}
              columns={gridColumns}
              storageKey={`lom-rf-v3-${userId}`}
              getRowId={(o) => o._uid!}
              onRowClick={(o) => setDetailUid(o._uid ?? null)}
              presets={RF_PRESETS}
              defaultPreset="Excel full (A to BZ)"
              onView={onGridView}
              toolbarRight={
                <>
                  <button onClick={() => exportView(gridView.current, 'results-forecast')} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"><Download size={13} /> Export CSV</button>
                  <button onClick={exportAllForecasting} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"><Download size={13} /> Export all forecasting columns</button>
                </>
              }
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="wbr">
          <p className="mb-2 text-[11px] text-muted">Prorated columns BW to BZ use the as-of date {asOf.toLocaleDateString('en-US')}.</p>
          {rows.length === 0 ? (
            <EmptyState title="No offers match these filters." />
          ) : (
            <ExcelGrid
              rows={rows}
              columns={wbrColumns}
              storageKey={`lom-rfwbr-v3-${userId}`}
              getRowId={(o) => o._uid!}
              onRowClick={(o) => setDetailUid(o._uid ?? null)}
              onView={onWbrView}
              toolbarRight={<button onClick={() => exportView(wbrView.current, 'results-forecast-wbr')} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"><Download size={13} /> Export CSV</button>}
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="how">
          <RfHowTab offers={base} asOf={asOf} />
        </Tabs.Content>
      </Tabs.Root>

      <RfDetailDrawer offer={detail} asOf={asOf} canForecast={canForecast} canResults={canResults} onClose={() => setDetailUid(null)} />
    </div>
  );
}

function MvpBadge() {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span tabIndex={0} className="cursor-help rounded-full border border-success bg-success/10 px-2 py-0.5 text-xs font-medium text-success">MVP</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="bottom" className="z-50 max-w-[260px] rounded border border-border bg-white p-2 text-xs shadow-md">
            The business confirmed Results & Forecast is in MVP.
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function IssueBadge({ messages }: { messages: string[] }) {
  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="shrink-0 cursor-help rounded-full bg-danger/10 px-1.5 text-[10px] text-danger">Data issue</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="right" className="z-50 max-w-[360px] rounded border border-border bg-white p-2 text-[11px] shadow-md">
            {messages.length ? (
              <ul className="list-disc space-y-1 pl-4">{messages.map((m) => <li key={m}>{m}</li>)}</ul>
            ) : (
              'Data issue found on import.'
            )}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select className={`rounded border px-2 py-1 text-xs ${value ? 'border-primary text-primary' : 'border-border'}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function Check({ label, checked, onChange, title }: { label: string; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="flex items-center gap-1 text-xs" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
