import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Download, X, Sigma, Pencil } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { PhaseBadge } from '@/components/PhaseBadge';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import { TagPill, type TagKind } from '@/components/TagPill';
import { ExcelGrid, type ExcelColumn } from '@/components/ExcelGrid';
import { FieldRenderer } from '@/components/fields/FieldRenderer';
import { fieldsByStep } from '@/lib/dataLoaders';
import { statusOf, isLocked } from '@/lib/lifecycle';
import { computeResultsForecast, inResultsForecast, type RfRow } from '@/lib/resultsForecast';
import { forecastNeeded } from '@/lib/calculations';
import { fiscalYearOf } from '@/lib/offers';
import { can } from '@/lib/permissions';
import { formatDate, isNoValue } from '@/lib/format';
import { toCsv, downloadCsv } from '@/lib/csv';
import { optionsForField } from '@/lib/options';
import type { OfferRecord, OfferValue } from '@/lib/types';

type Kind = 'num' | 'cur' | 'pct' | 'pctNA' | 'text' | 'tbdnum' | 'tbdcur' | 'colour' | 'date' | 'status';

function fmt(kind: Kind, v: unknown): string {
  if (kind === 'text' || kind === 'date' || kind === 'colour' || kind === 'status') return String(v ?? '');
  if (v === 'TBD') return 'TBD';
  if (v === null || v === undefined || v === '') return kind === 'pctNA' ? 'Not available' : '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (kind === 'cur' || kind === 'tbdcur') return `$${Math.round(n).toLocaleString()}`;
  if (kind === 'pct' || kind === 'pctNA') return `${(n * 100).toFixed(n * 100 < 10 ? 1 : 0)}%`;
  return Math.round(n).toLocaleString();
}

const COLOUR_CHIP: Record<string, string> = {
  Pink: 'bg-pink-100 text-pink-700',
  'Light green': 'bg-green-100 text-green-700',
  'Dark Green': 'bg-green-700 text-white',
};

// [rf key | offer field id, header, excel col, kind, tag, group]
type Grp = 'basics' | 'RESULTS' | 'FORECAST' | 'WBR';
interface Def { key: string; header: string; col: string; kind: Kind; tag: TagKind; grp: Grp; fromOffer?: boolean }

const DEFS: Def[] = [
  // basics
  { key: 'buildStatus', header: 'Status', col: 'C', kind: 'status', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'dashboardMonth', header: 'Dashboard Mo.', col: 'B', kind: 'text', tag: 'Typed', grp: 'basics', fromOffer: true },
  { key: 'startDate', header: 'Start Date', col: 'D', kind: 'date', tag: 'Typed', grp: 'basics', fromOffer: true },
  { key: 'endDate', header: 'End Date', col: 'E', kind: 'date', tag: 'Typed', grp: 'basics', fromOffer: true },
  { key: 'numberOfDays', header: 'Promo Days', col: 'F', kind: 'num', tag: 'Calculated', grp: 'basics', fromOffer: true },
  { key: 'category', header: 'Category', col: 'G', kind: 'text', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'subCategory', header: 'Sub-Category', col: 'H', kind: 'text', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'offerTiering', header: 'Tiering', col: 'I', kind: 'text', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'country', header: 'Markets', col: 'K', kind: 'text', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'offerDesign', header: 'Offer Design', col: 'L', kind: 'text', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'multiplier', header: 'Multiplier', col: 'M', kind: 'text', tag: 'Dropdown', grp: 'basics', fromOffer: true },
  { key: 'fixedPoints', header: 'Fixed pts', col: 'N', kind: 'num', tag: 'Typed', grp: 'basics', fromOffer: true },
  // RESULTS (typed)
  { key: 'audienceSize', header: 'Audience Size', col: 'O', kind: 'num', tag: 'Typed', grp: 'RESULTS', fromOffer: true },
  { key: 'activations', header: 'Activations', col: 'P', kind: 'num', tag: 'Typed', grp: 'RESULTS', fromOffer: true },
  { key: 'bonusedMembers', header: 'Bonused members', col: 'Q', kind: 'num', tag: 'Typed', grp: 'RESULTS', fromOffer: true },
  { key: 'bonusPtsIssued', header: 'Bonus Pts Issued', col: 'R', kind: 'num', tag: 'Typed', grp: 'RESULTS', fromOffer: true },
  // RESULTS (calculated)
  { key: 'ltbpOutstanding', header: 'LTBP outstanding', col: 'S', kind: 'num', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'ltbpRemoved', header: 'LTBP removed', col: 'T', kind: 'num', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'bonusRate', header: 'Bonus rate', col: 'U', kind: 'pctNA', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'bonusedSales', header: 'Bonused sales', col: 'Y', kind: 'tbdcur', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'basePoints', header: 'Base points', col: 'Z', kind: 'tbdnum', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'basePointsRedeemable', header: 'Base pts redeemable $', col: 'AA', kind: 'tbdcur', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'bonusPointsRedeemable', header: 'Bonus pts redeemable $', col: 'AB', kind: 'cur', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'redemptionRateResults', header: 'Assumed redemption rate', col: 'AC', kind: 'pct', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'bonusRedeemableWithBreakage', header: 'Redeemable $ (breakage)', col: 'AD', kind: 'cur', tag: 'Calculated', grp: 'RESULTS' },
  { key: 'spendPerBonusedMember', header: 'Spend / bonused member', col: 'AE', kind: 'tbdcur', tag: 'Calculated', grp: 'RESULTS' },
  // FORECAST
  { key: 'activationLow', header: 'Activation Low', col: 'AF', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'activationHigh', header: 'Activation High', col: 'AG', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusRateLowIn', header: 'Bonus rate Low', col: 'AH', kind: 'pct', tag: 'Typed', grp: 'FORECAST' },
  { key: 'bonusRateHighIn', header: 'Bonus rate High', col: 'AI', kind: 'pct', tag: 'Typed', grp: 'FORECAST' },
  { key: 'avgSpendLowIn', header: 'Avg spend Low', col: 'AJ', kind: 'cur', tag: 'Typed', grp: 'FORECAST' },
  { key: 'avgSpendHighIn', header: 'Avg spend High', col: 'AK', kind: 'cur', tag: 'Typed', grp: 'FORECAST' },
  { key: 'activationAvg', header: 'Activation Avg', col: 'AL', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusRateAvg', header: 'Bonus rate Avg', col: 'AM', kind: 'pct', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusedMembersLow', header: 'Bonused members Low', col: 'AN', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusedMembersHigh', header: 'Bonused members High', col: 'AO', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusedMembersAvg', header: 'Bonused members Avg', col: 'AP', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'spendPerTxnAvg', header: 'Spend/txn Avg', col: 'AQ', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusedSalesLow', header: 'Bonused sales Low', col: 'AR', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusedSalesHigh', header: 'Bonused sales High', col: 'AS', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusedSalesAvg', header: 'Bonused sales Avg', col: 'AT', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'basePointsLow', header: 'Base points Low', col: 'AU', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'basePointsHigh', header: 'Base points High', col: 'AV', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'basePointsAvg', header: 'Base points Avg', col: 'AW', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusPointsLow', header: 'Bonus points Low', col: 'AX', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusPointsHigh', header: 'Bonus points High', col: 'AY', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusPointsAvg', header: 'Bonus points Avg', col: 'AZ', kind: 'num', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'basePointsRedeemableLow', header: 'Base pts redeem $ Low', col: 'BA', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'basePointsRedeemableHigh', header: 'Base pts redeem $ High', col: 'BB', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusPointsRedeemableLow', header: 'Bonus pts redeem $ Low', col: 'BC', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusPointsRedeemableHigh', header: 'Bonus pts redeem $ High', col: 'BD', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusPointsRedeemableAvg', header: 'Redeemable $MDs (100%)', col: 'BE', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'redemptionRateForecast', header: 'Fcst redemption rate', col: 'BF', kind: 'pct', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusRedeemableLow', header: 'Redeemable $ breakage Low', col: 'BG', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusRedeemableHigh', header: 'Redeemable $ breakage High', col: 'BH', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'bonusRedeemableAvg', header: '$MDs with breakage', col: 'BI', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'jbpLow', header: 'JBP Low', col: 'BJ', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'jbpHigh', header: 'JBP High', col: 'BK', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  { key: 'jbpAvg', header: 'JBP Avg', col: 'BL', kind: 'cur', tag: 'Calculated', grp: 'FORECAST' },
  // WBR
  { key: 'wbrOfferPeriod', header: 'Offer Period', col: 'BM', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrFcstActivations', header: 'Fcst activations', col: 'BN', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrFcstBonused', header: 'Fcst bonused (rate)', col: 'BO', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrFcstSpend', header: 'Fcst spend/member', col: 'BP', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrFcstBonusPts', header: 'Fcst bonus pts', col: 'BQ', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrActActivations', header: 'Act activations', col: 'BR', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrActBonused', header: 'Act bonused (rate)', col: 'BS', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrActSpend', header: 'Act spend/member', col: 'BT', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrActBonusPts', header: 'Act bonus pts', col: 'BU', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'wbrActBonusedSales', header: 'Act bonused sales', col: 'BV', kind: 'text', tag: 'Calculated', grp: 'WBR' },
  { key: 'proratedPts', header: 'Prorated pts', col: 'BY', kind: 'num', tag: 'Calculated', grp: 'WBR' },
  { key: 'colourCode', header: 'Colour code', col: 'BZ', kind: 'colour', tag: 'Calculated', grp: 'WBR' },
];

const COMPACT = new Set([
  'buildStatus', 'dashboardMonth', 'startDate', 'endDate', 'numberOfDays', 'category', 'offerTiering',
  'country', 'offerDesign', 'audienceSize', 'activations', 'bonusedMembers', 'bonusPtsIssued',
  'activationAvg', 'bonusRateAvg', 'bonusedMembersAvg', 'bonusPointsAvg', 'bonusRedeemableAvg', 'colourCode',
]);
const GROUP_BG: Record<Grp, string> = {
  basics: 'bg-white', RESULTS: 'bg-green-50', FORECAST: 'bg-blue-50', WBR: 'bg-amber-50',
};

function getVal(d: Def, o: OfferRecord, rf: RfRow): unknown {
  if (d.fromOffer) return o[d.key];
  return (rf as unknown as Record<string, unknown>)[d.key];
}

export function ResultsForecast() {
  const offers = useAppStore((s) => s.offers);
  const role = useAppStore((s) => s.role);
  const canEdit = can(role, 'createEditCopy');
  const push = useToasts((s) => s.push);

  const [search, setSearch] = useState('');
  const [fy, setFy] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('');
  const [design, setDesign] = useState('');
  const [colour, setColour] = useState('');
  const [fcstNeeded, setFcstNeeded] = useState(false);
  const [detailUid, setDetailUid] = useState<string | null>(null);

  // B1: offers appear when includeForResultsForecast = Yes (excludes Draft, Cancelled, IMP only).
  const base = useMemo(() => offers.filter(inResultsForecast), [offers]);
  const rfByUid = useMemo(() => {
    const m = new Map<string, RfRow>();
    base.forEach((o) => m.set(o._uid!, computeResultsForecast(o)));
    return m;
  }, [base]);

  const opts = useMemo(() => {
    const d = (fn: (o: OfferRecord) => string) => [...new Set(base.map(fn).filter(Boolean))].sort();
    return {
      fy: d(fiscalYearOf), status: d((o) => statusOf(o)), category: d((o) => String(o.category ?? '')),
      tier: d((o) => String(o.offerTiering ?? '')), design: d((o) => String(o.offerDesign ?? '')),
    };
  }, [base]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter((o) => {
      if (q && !`${o.offerName ?? ''} ${o.offerId ?? ''}`.toLowerCase().includes(q)) return false;
      if (fy && fiscalYearOf(o) !== fy) return false;
      if (status && statusOf(o) !== status) return false;
      if (category && o.category !== category) return false;
      if (tier && o.offerTiering !== tier) return false;
      if (design && o.offerDesign !== design) return false;
      if (colour && (rfByUid.get(o._uid!)?.colourCode ?? '') !== colour) return false;
      if (fcstNeeded && forecastNeeded(o) !== 'Yes') return false;
      return true;
    });
  }, [base, search, fy, status, category, tier, design, colour, fcstNeeded, rfByUid]);

  const columns = useMemo<ExcelColumn[]>(() => {
    const idCol: ExcelColumn = {
      id: 'offerId', header: 'Offer ID', width: 90, group: 'basics', groupClass: GROUP_BG.basics,
      tag: 'Auto-generated', excelCol: '(A)', tooltip: 'Replaces the hand-typed Ref Number (Excel column A).',
      sortValue: (o) => Number(o.offerId) || 0, cell: (o) => String(o.offerId ?? ''),
    };
    const nameCol: ExcelColumn = {
      id: 'offerName', header: 'Offer Name', width: 220, group: 'basics', groupClass: GROUP_BG.basics,
      tag: 'Typed', excelCol: 'J', sortValue: (o) => String(o.offerName ?? ''),
      cell: (o) => String(o.offerName ?? ''),
    };
    const numberOfDaysCol: ExcelColumn = {
      id: 'numberOfDays', header: 'Promo Days', width: 90, group: 'basics', groupClass: GROUP_BG.basics,
      tag: 'Calculated', excelCol: 'F', defaultVisible: true,
      sortValue: (o) => { const s = new Date(String(o.startDate)); const e = new Date(String(o.endDate)); return isNoValue(o.startDate) || isNoValue(o.endDate) ? 0 : Math.round((+e - +s) / 86400000) + 1; },
      cell: (o) => { if (isNoValue(o.startDate) || isNoValue(o.endDate)) return ''; const s = new Date(String(o.startDate)); const e = new Date(String(o.endDate)); return Math.round((+e - +s) / 86400000) + 1; },
    };
    const defCols: ExcelColumn[] = DEFS.filter((d) => d.key !== 'numberOfDays').map((d) => ({
      id: d.key, header: d.header, width: d.grp === 'WBR' ? 130 : 120, group: d.grp, groupClass: GROUP_BG[d.grp],
      tag: d.tag, excelCol: d.col, defaultVisible: COMPACT.has(d.key),
      sortValue: (o) => { const rf = rfByUid.get(o._uid!)!; const v = getVal(d, o, rf); return typeof v === 'number' ? v : String(v ?? ''); },
      cell: (o) => {
        const rf = rfByUid.get(o._uid!)!;
        if (d.key === 'buildStatus') return <StatusPill status={statusOf(o)} withTooltip={false} />;
        const v = getVal(d, o, rf);
        if (d.kind === 'colour') return v ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${COLOUR_CHIP[String(v)]}`}>{String(v)}</span> : '';
        if (d.kind === 'date') return v ? formatDate(v) : '';
        if (d.fromOffer && (d.kind === 'num')) return isNoValue(v) ? '' : Number(v).toLocaleString();
        return fmt(d.kind, v) || (d.fromOffer && isNoValue(v) ? '' : fmt(d.kind, v));
      },
    }));
    return [idCol, nameCol, numberOfDaysCol, ...defCols];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfByUid]);

  function exportCsv() {
    const headers = ['Offer ID', 'Offer Name', ...DEFS.filter((d) => COMPACT.has(d.key)).map((d) => d.header)];
    const data = rows.map((o) => {
      const rf = rfByUid.get(o._uid!)!;
      return [o.offerId, o.offerName, ...DEFS.filter((d) => COMPACT.has(d.key)).map((d) => {
        if (d.key === 'buildStatus') return statusOf(o);
        const v = getVal(d, o, rf);
        return d.kind === 'date' ? (v ? formatDate(v) : '') : fmt(d.kind, v);
      })];
    });
    downloadCsv('results-forecast', toCsv(headers, data));
    push(`Exported ${rows.length} rows.`, 'success');
  }

  const detail = offers.find((o) => o._uid === detailUid);

  return (
    <div>
      <PageHeader title="Results & Forecast" count={rows.length}>
        <PhaseBadge note="Interim calculation. The analytics team's forecast and results models will replace these formulas after MVP." />
      </PageHeader>
      <p className="mb-3 text-sm text-muted">
        Calculated from each offer. Nothing is typed on this page. Forecast inputs and actual results
        are entered on the offer (Step 7 and Step 9).
      </p>

      <Tabs.Root defaultValue="grid">
        <Tabs.List className="mb-4 flex gap-1 border-b border-border">
          {[['grid', 'Grid'], ['wbr', 'WBR'], ['how', 'How it is calculated']].map(([v, l]) => (
            <Tabs.Trigger key={v} value={v}
              className="border-b-2 border-transparent px-3 py-2 text-sm text-muted data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-primary">
              {l}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="grid">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2">
            <input className="min-w-[180px] flex-1 rounded border border-border px-2 py-1 text-sm" placeholder="Search name or Offer ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Sel label="Fiscal year" value={fy} options={opts.fy} onChange={setFy} />
            <Sel label="Status" value={status} options={opts.status} onChange={setStatus} />
            <Sel label="Category" value={category} options={opts.category} onChange={setCategory} />
            <Sel label="Tier" value={tier} options={opts.tier} onChange={setTier} />
            <Sel label="Offer Design" value={design} options={opts.design} onChange={setDesign} />
            <Sel label="Colour code" value={colour} options={['Pink', 'Light green', 'Dark Green']} onChange={setColour} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={fcstNeeded} onChange={(e) => setFcstNeeded(e.target.checked)} /> Forecast needed = Yes</label>
            <div className="ml-2 flex items-center gap-1 text-[11px] text-muted">
              <span className="inline-block h-3 w-3 rounded bg-green-50 ring-1 ring-green-200" /> RESULTS
              <span className="ml-1 inline-block h-3 w-3 rounded bg-blue-50 ring-1 ring-blue-200" /> FORECAST
              <span className="ml-1 inline-block h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-200" /> WBR
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No offers match these filters." />
          ) : (
            <ExcelGrid rows={rows} columns={columns} storageKey={`lom-rf-${role}`} getRowId={(o) => o._uid!}
              onRowClick={(o) => setDetailUid(o._uid ?? null)}
              toolbarRight={<button onClick={exportCsv} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"><Download size={13} /> Export CSV</button>} />
          )}
        </Tabs.Content>

        <Tabs.Content value="wbr"><WbrTab rows={base} rf={rfByUid} /></Tabs.Content>
        <Tabs.Content value="how"><HowTab /></Tabs.Content>
      </Tabs.Root>

      {/* Detail drawer */}
      <Dialog.Root open={detailUid !== null} onOpenChange={(o) => !o && setDetailUid(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-3xl flex-col border-l border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-ink">
                {String(detail?.offerName ?? '')} {detail && <StatusPill status={statusOf(detail)} />}
              </Dialog.Title>
              <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
            </div>
            {detail && <DetailBody offer={detail} canEdit={canEdit && !isLocked(statusOf(detail))} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}


function DetailBody({ offer, canEdit }: { offer: OfferRecord; canEdit: boolean }) {
  const [panel, setPanel] = useState<null | 'forecast' | 'results'>(null);
  const rf = computeResultsForecast(offer);
  const W = rf.bonusPointCalc;

  const fRows: Array<[string, string, string?]> = [
    ['Activation Low', fmt('num', rf.activationLow), `${offer.activationByDayLow ?? '?'} × ${rf.wbrOfferPeriod ? '(total days)' : ''}`],
    ['Bonused members Low', fmt('num', rf.bonusedMembersLow), `${fmt('num', rf.activationLow)} × ${fmt('pct', rf.bonusRateLowIn)}`],
    ['Bonused sales Low', fmt('cur', rf.bonusedSalesLow)],
    ['Bonus points Avg', fmt('num', rf.bonusPointsAvg)],
    ['Redeemable $ (100%) Avg', fmt('cur', rf.bonusPointsRedeemableAvg)],
    ['Redemption rate', fmt('pct', rf.redemptionRateForecast)],
    ['$MDs with breakage', fmt('cur', rf.bonusRedeemableAvg)],
    ['JBP Avg', fmt('cur', rf.jbpAvg)],
  ];
  const aRows: Array<[string, string, string?]> = [
    ['Audience size', fmt('num', offer.audienceSize)],
    ['Activations', fmt('num', offer.activations)],
    ['Activation rate', offer.activations && offer.audienceSize ? fmt('pct', Number(offer.activations) / Number(offer.audienceSize)) : 'Not available'],
    ['Bonused members', fmt('num', offer.bonusedMembers)],
    ['Bonus rate', fmt('pctNA', rf.bonusRate)],
    ['Bonus Pts Issued', fmt('num', offer.bonusPtsIssued)],
    ['Bonused sales', fmt('tbdcur', rf.bonusedSales)],
    ['Redeemable $ (breakage)', fmt('cur', rf.bonusRedeemableWithBreakage)],
    ['Spend / bonused member', fmt('tbdcur', rf.spendPerBonusedMember), `Bonused sales ÷ bonused members (W = ${W ?? '?'})`],
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {canEdit && (
        <div className="mb-4 flex gap-2">
          <button onClick={() => setPanel('forecast')} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"><Pencil size={14} /> Enter forecast</button>
          <button onClick={() => setPanel('results')} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"><Pencil size={14} /> Enter results</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <DetailCol title="Forecast" rows={fRows} bg="bg-blue-50" />
        <DetailCol title="Actuals" rows={aRows} bg="bg-green-50" />
      </div>
      <div className="mt-4 rounded-lg border border-border p-3 text-sm">
        <h4 className="mb-1 font-semibold">WBR</h4>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span>Period: {rf.wbrOfferPeriod || '—'}</span>
          <span>Fcst: {rf.wbrFcstActivations} / {rf.wbrFcstBonused} / {rf.wbrFcstBonusPts}</span>
          <span>Act: {rf.wbrActActivations} / {rf.wbrActBonused} / {rf.wbrActBonusPts}</span>
          <span>Colour: {rf.colourCode ? <span className={`rounded-full px-1.5 py-0.5 ${COLOUR_CHIP[rf.colourCode]}`}>{rf.colourCode}</span> : '—'}</span>
        </div>
      </div>
      {panel && <InlineEditor offer={offer} kind={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}

function DetailCol({ title, rows, bg }: { title: string; rows: Array<[string, string, string?]>; bg: string }) {
  return (
    <div className={`rounded-lg border border-border ${bg} p-3`}>
      <h4 className="mb-2 font-semibold text-ink">{title}</h4>
      <dl className="space-y-1 text-xs">
        {rows.map(([label, val, fx]) => (
          <div key={label} className="flex items-center justify-between gap-2 border-b border-border/40 py-0.5">
            <dt className="flex items-center gap-1 text-muted">
              {label}
              {fx && (
                <Tooltip.Provider delayDuration={100}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild><button className="text-primary"><Sigma size={11} /></button></Tooltip.Trigger>
                    <Tooltip.Portal><Tooltip.Content side="top" className="z-50 max-w-[300px] rounded border border-border bg-white p-2 text-[11px] text-ink shadow-md">{fx}</Tooltip.Content></Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
            </dt>
            <dd className="text-right font-medium text-ink">{val || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function InlineEditor({ offer, kind, onClose }: { offer: OfferRecord; kind: 'forecast' | 'results'; onClose: () => void }) {
  const updateOffer = useAppStore((s) => s.updateOffer);
  const addAudit = useAppStore((s) => s.addAudit);
  const role = useAppStore((s) => s.role);
  const dropdowns = useAppStore((s) => s.dropdowns);
  const categorySubCategory = useAppStore((s) => s.categorySubCategory);
  const push = useToasts((s) => s.push);
  const [work, setWork] = useState<OfferRecord>(offer);

  const stepFields = (fieldsByStep[kind === 'forecast' ? '7. Forecast' : '9. Results'] ?? [])
    .filter((f) => f.control !== 'computed' && f.control !== 'hidden' && f.phase !== 'Phase 2');

  function save() {
    for (const f of stepFields) {
      if (String(offer[f.id] ?? '') !== String(work[f.id] ?? '')) {
        addAudit({ offerId: String(offer.offerId ?? ''), offerUid: offer._uid, user: role, action: 'field changed', fieldLabel: f.label, oldValue: (offer[f.id] as OfferValue) ?? null, newValue: (work[f.id] as OfferValue) ?? null });
      }
    }
    updateOffer(offer._uid!, work);
    push(`${kind === 'forecast' ? 'Forecast' : 'Results'} saved.`, 'success');
    onClose();
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-semibold">{kind === 'forecast' ? 'Enter forecast (Step 7)' : 'Enter results (Step 9)'}</h4>
        <button onClick={onClose} className="text-muted hover:text-ink"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stepFields.map((f) => (
          <FieldRenderer key={f.id} field={f} value={work[f.id]} onChange={(v) => setWork((w) => ({ ...w, [f.id]: v }))}
            options={optionsForField(f.id, f.optionsKey, dropdowns, categorySubCategory, work.category)} />
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">Cancel</button>
        <button onClick={save} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">Save</button>
      </div>
    </div>
  );
}

function WbrTab({ rows, rf }: { rows: OfferRecord[]; rf: Map<string, RfRow> }) {
  if (rows.length === 0) return <EmptyState title="No offers to show." />;
  const cols: Array<[string, (o: OfferRecord, r: RfRow) => string]> = [
    ['Offer Name', (o) => String(o.offerName ?? '')],
    ['Status', (o) => statusOf(o)],
    ['Dashboard', (o) => String(o.dashboardMonth ?? '')],
    ['Period', (_o, r) => r.wbrOfferPeriod],
    ['Fcst activations', (_o, r) => r.wbrFcstActivations],
    ['Fcst bonused', (_o, r) => r.wbrFcstBonused],
    ['Fcst spend', (_o, r) => r.wbrFcstSpend],
    ['Fcst bonus pts', (_o, r) => r.wbrFcstBonusPts],
    ['Act activations', (_o, r) => r.wbrActActivations],
    ['Act bonused', (_o, r) => r.wbrActBonused],
    ['Act spend', (_o, r) => r.wbrActSpend],
    ['Act bonus pts', (_o, r) => r.wbrActBonusPts],
    ['Act bonused sales', (_o, r) => r.wbrActBonusedSales],
    ['Colour', (_o, r) => r.colourCode],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full whitespace-nowrap text-left text-xs">
        <thead className="border-b border-border bg-surface text-muted"><tr>{cols.map(([h]) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((o) => { const r = rf.get(o._uid!)!; return (
          <tr key={o._uid} className="border-b border-border last:border-0">{cols.map(([h, fn]) => {
            const val = fn(o, r);
            return <td key={h} className="px-2 py-1.5">{h === 'Colour' && val ? <span className={`rounded-full px-1.5 py-0.5 ${COLOUR_CHIP[val]}`}>{val}</span> : val || '—'}</td>;
          })}</tr>
        ); })}</tbody>
      </table>
    </div>
  );
}

function HowTab() {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-1 font-semibold">Flow</h3>
        <p className="text-muted">Offer form (Step 2, 3, 5, 7, 9) → Results &amp; Forecast → back to Step 7 (6 totals, Forecast needed) → WBR. Separately: Offer form → Databricks metadata (own formulas).</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card title="Inputs"><p className="text-muted">Typed and dropdown values from Steps 2, 3, 5, 7 and 9. Fixed numbers: 10 base pts per $, 2 $ per 1,000 pts, 1,000 points unit.</p></Card>
        <Card title="Results formulas"><p className="text-muted">Bonus rate = members ÷ activations; Bonused sales (Multiplier) = pts ÷ W ÷ 10; redeemable $ = pts ÷ 1,000 × 2; breakage uses the forecast rate.</p></Card>
        <Card title="Forecast formulas"><p className="text-muted">Activation = by-day × total days; bonused members = activation × rate; bonus points = base × W (or members × W); JBP = base + bonus redeemable.</p></Card>
        <Card title="WBR text rules"><p className="text-muted">Thousands/M/B rounding exactly as the Excel tab (ROUND half away from zero); colour code Pink/Light green/Dark Green by prorated vs forecast range.</p></Card>
      </div>
      <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">Same measure, 2 rules <TagPill kind="Confirm with business" /></h3>
        <p className="mb-2 text-xs text-muted">Which rule the product keeps is a business decision.</p>
        <table className="w-full text-left text-xs">
          <thead className="text-muted"><tr><th className="py-1">Measure</th><th className="py-1">Results &amp; Forecast rule</th><th className="py-1">Metadata rule</th></tr></thead>
          <tbody className="align-top">
            <tr className="border-t border-border/50"><td className="py-1">Assumed redemption rate (actuals)</td><td className="py-1">100% for Points donations / Extra entries / LTBO; 88% from 1 Oct 2025; else 85%</td><td className="py-1">100% for LTBO or REDEMPTION; 88% from 1 Oct 2025; 85% from 1 Nov 2024; else 80%</td></tr>
            <tr className="border-t border-border/50"><td className="py-1">Forecast bonus points Low/High</td><td className="py-1">Forced to 0 when Cancelled</td><td className="py-1">No Cancelled check</td></tr>
            <tr className="border-t border-border/50"><td className="py-1">LTBP removed</td><td className="py-1">Only when lifecycle status is exactly Completed</td><td className="py-1">When the date-based Offer Status is Completed</td></tr>
            <tr className="border-t border-border/50"><td className="py-1">Days elapsed / prorated</td><td className="py-1">Counts from Start Date</td><td className="py-1">Counts from Early Activation Date when present</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-white p-4"><h3 className="mb-1 font-semibold">{title}</h3>{children}</div>;
}
function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select className="rounded border border-border px-2 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
