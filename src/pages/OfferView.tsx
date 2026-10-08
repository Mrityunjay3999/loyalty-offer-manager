import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import { ExcelGrid, type ExcelColumn } from '@/components/ExcelGrid';
import { ColumnPickerExportDialog } from '@/components/ColumnPickerExportDialog';
import { OfferDetailDrawer } from '@/components/OfferDetailDrawer';
import { fields } from '@/lib/dataLoaders';
import { statusOf } from '@/lib/lifecycle';
import { computedFieldValue, softLockDate } from '@/lib/calculations';
import { planningMonth, fiscalYearOf } from '@/lib/offers';
import { formatDate } from '@/lib/format';
import { displayField as display } from '@/lib/displayField';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { OfferRecord } from '@/lib/types';

const DEFAULT_COLS = [
  'offerId', 'offerName', 'buildStatus', 'startDate', 'endDate', 'numberOfDays',
  '__fiscalYear', 'country', 'category', 'subCategory', 'offerTiering', 'offerDesign',
  'channel', 'ppContact', 'groupedOffer', '__updated',
];

export function OfferView() {
  const offers = useAppStore((s) => s.offers);
  const push = useToasts((s) => s.push);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [pm, setPm] = useState('');
  const [fy, setFy] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [tier, setTier] = useState('');
  const [design, setDesign] = useState('');
  const [grouped, setGrouped] = useState('');
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [colPickOpen, setColPickOpen] = useState(false);

  // A5/A4: exclude Draft and Cancelled.
  const base = useMemo(
    () => offers.filter((o) => statusOf(o) !== 'Draft' && statusOf(o) !== 'Cancelled'),
    [offers],
  );

  const opts = useMemo(() => {
    const d = (fn: (o: OfferRecord) => string) => [...new Set(base.map(fn).filter(Boolean))].sort();
    return {
      pm: [...new Set(base.map(planningMonth).filter(Boolean))],
      fy: d(fiscalYearOf),
      category: d((o) => String(o.category ?? '')),
      country: d((o) => String(o.country ?? '')),
      tier: d((o) => String(o.offerTiering ?? '')),
      design: d((o) => String(o.offerDesign ?? '')),
    };
  }, [base]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    base.forEach((o) => { const s = statusOf(o); c[s] = (c[s] ?? 0) + 1; });
    return c;
  }, [base]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter((o) => {
      if (q && !`${o.offerName ?? ''} ${o.offerId ?? ''}`.toLowerCase().includes(q)) return false;
      if (status.length && !status.includes(statusOf(o))) return false;
      if (pm && planningMonth(o) !== pm) return false;
      if (fy && fiscalYearOf(o) !== fy) return false;
      if (category && o.category !== category) return false;
      if (country && o.country !== country) return false;
      if (tier && o.offerTiering !== tier) return false;
      if (design && o.offerDesign !== design) return false;
      if (grouped === 'Yes' && o.groupedOffer !== 'Yes') return false;
      if (grouped === 'No' && o.groupedOffer === 'Yes') return false;
      return true;
    });
  }, [base, search, status, pm, fy, category, country, tier, design, grouped]);

  const columns = useMemo<ExcelColumn[]>(() => {
    const specials: ExcelColumn[] = [
      { id: '__fiscalYear', header: 'Fiscal year', width: 90, defaultVisible: DEFAULT_COLS.includes('__fiscalYear'),
        sortValue: (o) => fiscalYearOf(o), cell: (o) => fiscalYearOf(o) || '—' },
      { id: '__updated', header: 'Last updated', width: 110, defaultVisible: DEFAULT_COLS.includes('__updated'),
        sortValue: (o) => o._updatedAt ?? '', cell: (o) => (o._updatedAt ? formatDate(o._updatedAt.slice(0, 10)) : '—') },
    ];
    const fieldCols: ExcelColumn[] = fields
      .filter((f) => f.control !== 'hidden')
      .map((f) => ({
        id: f.id,
        header: f.label,
        group: f.step,
        width: f.id === 'offerName' ? 230 : 150,
        defaultVisible: DEFAULT_COLS.includes(f.id),
        sortValue: (o) => {
          if (f.id === 'softLockDate') return softLockDate(o);
          const v = f.control === 'computed' ? computedFieldValue(f.id, o) : o[f.id];
          return typeof v === 'number' ? v : String(v ?? '');
        },
        cell: (o) => {
          if (f.id === 'buildStatus') return <StatusPill status={statusOf(o)} withTooltip={false} />;
          if (f.id === 'softLockDate') return softLockDate(o);
          return display(f, o) || <span className="text-muted">—</span>;
        },
      }));
    // order: default columns first (special interleaved), then the rest
    const all = [...fieldCols, ...specials];
    const byId = Object.fromEntries(all.map((c) => [c.id, c]));
    const ordered: ExcelColumn[] = [];
    for (const id of DEFAULT_COLS) if (byId[id]) ordered.push(byId[id]);
    for (const c of all) if (!DEFAULT_COLS.includes(c.id)) ordered.push(c);
    return ordered;
  }, []);

  function exportCsv() {
    const visibleFieldIds = DEFAULT_COLS.filter((id) => !id.startsWith('__'));
    const cols = visibleFieldIds.map((id) => fields.find((f) => f.id === id)!).filter(Boolean);
    const headers = cols.map((f) => f.label);
    const data = rows.map((o) => cols.map((f) => display(f, o)));
    downloadCsv('offer-view', toCsv(headers, data));
    push(`Exported ${rows.length} offers.`, 'success');
  }

  const userId = useAppStore((s) => s.currentUserId);
  const detail = offers.find((o) => o._uid === detailUid);

  return (
    <div>
      <PageHeader title="Offer View" count={rows.length} />
      <p className="mb-3 text-sm text-muted">
        Read-only view of all offers. Your filters, sorting and column layout are saved for you only
        and never change what other people see.
      </p>

      {/* Status chips (no Draft, no Cancelled) */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.keys(statusCounts).sort().map((st) => {
          const active = status.includes(st);
          return (
            <button key={st} onClick={() => setStatus((s) => (active ? s.filter((x) => x !== st) : [...s, st]))}
              className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink hover:bg-surface'}`}>
              {st} <span className="tabular-nums text-muted">{statusCounts[st]}</span>
            </button>
          );
        })}
      </div>

      {/* Quick filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2">
        <input className="min-w-[200px] flex-1 rounded border border-border px-2 py-1 text-sm" placeholder="Search name or Offer ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Sel label="Planning month" value={pm} options={opts.pm} onChange={setPm} />
        <Sel label="Fiscal year" value={fy} options={opts.fy} onChange={setFy} />
        <Sel label="Category" value={category} options={opts.category} onChange={setCategory} />
        <Sel label="Country" value={country} options={opts.country} onChange={setCountry} />
        <Sel label="Tier" value={tier} options={opts.tier} onChange={setTier} />
        <Sel label="Offer Design" value={design} options={opts.design} onChange={setDesign} />
        <Sel label="Grouped" value={grouped} options={['Yes', 'No']} onChange={setGrouped} />
        <span className="ml-auto text-[11px] text-muted">Filters and layout on this page are personal.</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No offers match these filters." />
      ) : (
        <ExcelGrid
          rows={rows}
          columns={columns}
          storageKey={`lom-offerview-${userId}`}
          getRowId={(o) => o._uid ?? String(o.offerId)}
          onRowClick={(o) => setDetailUid(o._uid ?? null)}
          toolbarRight={
            <>
              <button onClick={() => setColPickOpen(true)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface">
                <Download size={13} /> Export selected columns
              </button>
              <button onClick={exportCsv} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface">
                <Download size={13} /> Export CSV
              </button>
            </>
          }
        />
      )}
      <ColumnPickerExportDialog offers={rows} open={colPickOpen} onClose={() => setColPickOpen(false)} />

      <OfferDetailDrawer offer={detail} open={detailUid !== null} onClose={() => setDetailUid(null)} />
    </div>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select className="rounded border border-border px-2 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
