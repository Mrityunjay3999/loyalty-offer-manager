import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Plus,
  Copy,
  Download,
  Columns3,
  Save,
  MoreVertical,
  Link2,
  History as HistoryIcon,
  XCircle,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { fieldsById } from '@/lib/dataLoaders';
import { STATUS_ORDER, statusOf, isEarlierThanAudited } from '@/lib/lifecycle';
import { computedFieldValue, softLockDate } from '@/lib/calculations';
import { checklistProgress, planningMonth } from '@/lib/offers';
import { formatDate, formatCurrency, formatPercent, isNoValue, parseISO } from '@/lib/format';
import { can } from '@/lib/permissions';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { OfferRecord, FieldDef } from '@/lib/types';

interface Filters {
  search: string;
  statuses: string[];
  planningMonth: string;
  category: string;
  subCategory: string;
  country: string;
  offerTiering: string;
  offerDesign: string;
  ppContact: string;
  grouped: '' | 'Yes' | 'No';
  next30: boolean;
  pastSoftLockNotAudited: boolean;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  statuses: [],
  planningMonth: '',
  category: '',
  subCategory: '',
  country: '',
  offerTiering: '',
  offerDesign: '',
  ppContact: '',
  grouped: '',
  next30: false,
  pastSoftLockNotAudited: false,
};

// Default column order (spec 7.1). Special columns use "__"-prefixed ids.
const DEFAULT_ORDER = [
  'offerId',
  'offerName',
  'buildStatus',
  'startDate',
  'endDate',
  'numberOfDays',
  'softLockDate',
  'country',
  'category',
  'subCategory',
  'offerTiering',
  'offerDesign',
  'channel',
  'ppContact',
  '__checklist',
  'forecastStatus',
  'groupedOffer',
  '__updated',
];
// Field ids shown by default (for CSV export & visibility seeding).
const DEFAULT_FIELD_COLS = DEFAULT_ORDER.filter((id) => !id.startsWith('__'));

/** Display string for a field value (raw, computed or formatted). */
function displayValue(field: FieldDef, o: OfferRecord): string {
  if (field.control === 'computed') {
    const v = computedFieldValue(field.id, o);
    return v === null || v === undefined ? '' : String(v);
  }
  const v = o[field.id];
  if (isNoValue(v)) return v === 'N/A' ? 'N/A' : '';
  if (field.control === 'date' || field.control === 'dateOrNA') return formatDate(v);
  if (field.control === 'currency') return formatCurrency(v);
  if (field.control === 'percent') return formatPercent(v, 1);
  return String(v);
}

function sortValue(field: FieldDef, o: OfferRecord): string | number {
  if (field.control === 'computed') {
    const v = computedFieldValue(field.id, o);
    return typeof v === 'number' ? v : String(v ?? '');
  }
  const v = o[field.id];
  if (isNoValue(v)) return '';
  if (field.control === 'number' || field.control === 'currency' || field.control === 'percent') {
    return typeof v === 'number' ? v : Number(v) || 0;
  }
  return String(v);
}

export function OffersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const offers = useAppStore((s) => s.offers);
  const role = useAppStore((s) => s.role);
  const copyOffer = useAppStore((s) => s.copyOffer);
  const cancelOffer = useAppStore((s) => s.cancelOffer);
  const savedViews = useAppStore((s) => s.savedViews);
  const addSavedView = useAppStore((s) => s.addSavedView);
  const deleteSavedView = useAppStore((s) => s.deleteSavedView);
  const push = useToasts((s) => s.push);

  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    search: searchParams.get('q') ?? '',
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [cancelUid, setCancelUid] = useState<string | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [historyUid, setHistoryUid] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const canEdit = can(role, 'createEditCopy');
  const canCancel = can(role, 'cancel');

  // Distinct filter options from the data.
  const distinct = useMemo(() => {
    const get = (fn: (o: OfferRecord) => string) =>
      [...new Set(offers.map(fn).filter(Boolean))].sort();
    return {
      planningMonth: [...new Set(offers.map(planningMonth).filter(Boolean))],
      category: get((o) => String(o.category ?? '')),
      subCategory: get((o) => String(o.subCategory ?? '')),
      country: get((o) => String(o.country ?? '')),
      offerTiering: get((o) => String(o.offerTiering ?? '')),
      offerDesign: get((o) => String(o.offerDesign ?? '')),
      ppContact: get((o) => String(o.ppContact ?? '')),
    };
  }, [offers]);

  // Status counts for chips.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of offers) {
      const st = statusOf(o);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [offers]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const q = filters.search.trim().toLowerCase();

    return offers.filter((o) => {
      const st = statusOf(o);
      // A4: Cancelled offers are hidden unless the "Show cancelled" toggle is on.
      if (st === 'Cancelled' && !showCancelled) return false;
      if (q) {
        const hay = [o.offerName, o.offerId, o.activationDescriptor]
          .map((v) => String(v ?? '').toLowerCase())
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      if (filters.statuses.length && !filters.statuses.includes(st)) return false;
      if (filters.planningMonth && planningMonth(o) !== filters.planningMonth) return false;
      if (filters.category && o.category !== filters.category) return false;
      if (filters.subCategory && o.subCategory !== filters.subCategory) return false;
      if (filters.country && o.country !== filters.country) return false;
      if (filters.offerTiering && o.offerTiering !== filters.offerTiering) return false;
      if (filters.offerDesign && o.offerDesign !== filters.offerDesign) return false;
      if (filters.ppContact && o.ppContact !== filters.ppContact) return false;
      if (filters.grouped === 'Yes' && o.groupedOffer !== 'Yes') return false;
      if (filters.grouped === 'No' && o.groupedOffer === 'Yes') return false;
      if (filters.next30) {
        const s = parseISO(o.startDate);
        if (!s || s < today || s > in30) return false;
      }
      if (filters.pastSoftLockNotAudited) {
        const sl = parseISO(softLockDate(o));
        if (!sl || sl >= today || !isEarlierThanAudited(st)) return false;
      }
      return true;
    });
  }, [offers, filters, showCancelled]);

  const columns = useMemo<ColumnDef<OfferRecord>[]>(() => {
    const fieldCols: ColumnDef<OfferRecord>[] = Object.values(fieldsById)
      .filter((f) => f.control !== 'hidden')
      .map((f) => ({
        id: f.id,
        header: f.label,
        accessorFn: (o) => sortValue(f, o),
        enableSorting: true,
        cell: ({ row }) => {
          const o = row.original;
          if (f.id === 'offerName') {
            return (
              <Link
                to={`/offers/${o._uid}`}
                className="font-medium text-primary hover:underline"
              >
                {displayValue(f, o) || '(unnamed)'}
              </Link>
            );
          }
          if (f.id === 'buildStatus') return <StatusPill status={statusOf(o)} />;
          if (f.id === 'softLockDate') {
            const sl = softLockDate(o);
            const past = (() => {
              const d = parseISO(sl);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return d && d < today && isEarlierThanAudited(statusOf(o));
            })();
            return <span className={past ? 'font-medium text-danger' : ''}>{sl}</span>;
          }
          if (f.id === 'groupedOffer') {
            return o.groupedOffer === 'Yes' ? (
              <span title="Grouped offer" className="text-primary">
                <Link2 size={15} />
              </span>
            ) : (
              <span className="text-muted">—</span>
            );
          }
          return <span>{displayValue(f, o) || <span className="text-muted">—</span>}</span>;
        },
      }));

    const checklistCol: ColumnDef<OfferRecord> = {
      id: '__checklist',
      header: 'Checklist',
      accessorFn: (o) => checklistProgress(o).done,
      cell: ({ row }) => {
        const { done, total } = checklistProgress(row.original);
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-primary"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <span className="tabular-nums text-muted">
              {done} / {total}
            </span>
          </div>
        );
      },
    };

    const updatedCol: ColumnDef<OfferRecord> = {
      id: '__updated',
      header: 'Last updated',
      accessorFn: (o) => o._updatedAt ?? '',
      cell: ({ row }) =>
        row.original._updatedAt ? (
          <span className="text-muted">
            {formatDate(row.original._updatedAt.slice(0, 10))}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    };

    const actionsCol: ColumnDef<OfferRecord> = {
      id: '__actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => <RowMenu offer={row.original} />,
    };

    // Order: select, then DEFAULT_ORDER (special + fields), then the remaining
    // fields (hidden by default), then actions.
    const byId = new Map<string, ColumnDef<OfferRecord>>();
    for (const c of fieldCols) byId.set(c.id as string, c);
    byId.set('__checklist', checklistCol);
    byId.set('__updated', updatedCol);

    const ordered: ColumnDef<OfferRecord>[] = [];
    for (const id of DEFAULT_ORDER) {
      const c = byId.get(id);
      if (c) ordered.push(c);
    }
    for (const c of fieldCols) {
      if (!DEFAULT_ORDER.includes(c.id as string)) ordered.push(c);
    }

    return [selectColumn(), ...ordered, actionsCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Column visibility default: only the curated set + special columns visible.
  const initialVisibility = useMemo<VisibilityState>(() => {
    const vis: VisibilityState = {};
    for (const f of Object.values(fieldsById)) {
      if (f.control === 'hidden') continue;
      vis[f.id] = DEFAULT_FIELD_COLS.includes(f.id);
    }
    return vis;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveVisibility =
    Object.keys(columnVisibility).length === 0 ? initialVisibility : columnVisibility;

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, rowSelection, columnVisibility: effectiveVisibility },
    getRowId: (o) => o._uid ?? String(o.offerId),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedRows = table.getSelectedRowModel().rows;

  function RowMenu({ offer }: { offer: OfferRecord }) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button aria-label="Row actions" className="rounded p-1 text-muted hover:bg-surface">
            <MoreVertical size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-[160px] rounded-md border border-border bg-white py-1 shadow-lg"
          >
            <MenuItem onSelect={() => navigate(`/offers/${offer._uid}`)}>Open</MenuItem>
            {canEdit && (
              <MenuItem
                onSelect={() => {
                  const id = copyOffer(offer._uid!);
                  if (id) {
                    push('Offer copied to a new draft.', 'success');
                    navigate(`/offers/${id}`);
                  }
                }}
              >
                Copy
              </MenuItem>
            )}
            <MenuItem onSelect={() => setHistoryUid(offer._uid!)}>View history</MenuItem>
            {canCancel && statusOf(offer) !== 'Cancelled' && (
              <MenuItem destructive onSelect={() => setCancelUid(offer._uid!)}>
                Cancel offer
              </MenuItem>
            )}
            <MenuItem onSelect={() => exportRows([offer])}>Export row</MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  function exportRows(rows: OfferRecord[]) {
    const visibleFieldIds = Object.values(fieldsById)
      .filter((f) => f.control !== 'hidden' && effectiveVisibility[f.id] !== false)
      .filter((f) => DEFAULT_FIELD_COLS.includes(f.id) || effectiveVisibility[f.id]);
    const headers = visibleFieldIds.map((f) => f.label);
    const data = rows.map((o) => visibleFieldIds.map((f) => displayValue(f, o)));
    downloadCsv('offers', toCsv(headers, data));
    push(`Exported ${rows.length} offer${rows.length === 1 ? '' : 's'} to CSV.`, 'success');
  }

  const cancelOfferRecord = offers.find((o) => o._uid === cancelUid);
  const historyOffer = offers.find((o) => o._uid === historyUid);
  const viewsForRole = savedViews.filter((v) => v.role === role);

  return (
    <div>
      <PageHeader
        title="Offers"
        count={filtered.length}
        right={
          <>
            <button
              disabled={!canEdit}
              onClick={() => navigate('/offers/new')}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              title={canEdit ? '' : 'Only Offer Team Editor, Loyalty & Pricing or Admin can create offers'}
            >
              <Plus size={15} /> New offer
            </button>
            <button
              disabled={!canEdit || selectedRows.length !== 1}
              onClick={() => {
                const id = copyOffer(selectedRows[0].original._uid!);
                if (id) {
                  push('Offer copied to a new draft.', 'success');
                  navigate(`/offers/${id}`);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface disabled:opacity-50"
            >
              <Copy size={15} /> Copy offer
            </button>
            <button
              onClick={() =>
                exportRows(selectedRows.length ? selectedRows.map((r) => r.original) : filtered)
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface"
            >
              <Download size={15} /> Export CSV
            </button>
            <ColumnsMenu table={table} />
            <button
              onClick={() => setSaveViewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface"
            >
              <Save size={15} /> Save view
            </button>
          </>
        }
      />

      {/* Status summary chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_ORDER.map((st) => {
          const count = statusCounts[st] ?? 0;
          if (count === 0 && st !== 'Draft') return null;
          const active = filters.statuses.includes(st);
          const labelText = st === 'Draft' ? 'Drafts' : st;
          return (
            <button
              key={st}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  statuses: active
                    ? f.statuses.filter((s) => s !== st)
                    : [...f.statuses, st],
                }))
              }
              className={`rounded-full border px-2.5 py-1 text-xs ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink hover:bg-surface'
              }`}
            >
              {labelText} <span className="tabular-nums text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-3">
        <input
          className="min-w-[220px] flex-1 rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          placeholder="Search name, ID or activation descriptor"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <FilterSelect label="Planning month" value={filters.planningMonth} options={distinct.planningMonth} onChange={(v) => setFilters((f) => ({ ...f, planningMonth: v }))} />
        <FilterSelect label="Category" value={filters.category} options={distinct.category} onChange={(v) => setFilters((f) => ({ ...f, category: v }))} />
        <FilterSelect label="Sub-Category" value={filters.subCategory} options={distinct.subCategory} onChange={(v) => setFilters((f) => ({ ...f, subCategory: v }))} />
        <FilterSelect label="Country" value={filters.country} options={distinct.country} onChange={(v) => setFilters((f) => ({ ...f, country: v }))} />
        <FilterSelect label="Tier" value={filters.offerTiering} options={distinct.offerTiering} onChange={(v) => setFilters((f) => ({ ...f, offerTiering: v }))} />
        <FilterSelect label="Offer Design" value={filters.offerDesign} options={distinct.offerDesign} onChange={(v) => setFilters((f) => ({ ...f, offerDesign: v }))} />
        <FilterSelect label="P&P Contact" value={filters.ppContact} options={distinct.ppContact} onChange={(v) => setFilters((f) => ({ ...f, ppContact: v }))} />
        <FilterSelect label="Grouped" value={filters.grouped} options={['Yes', 'No']} onChange={(v) => setFilters((f) => ({ ...f, grouped: v as Filters['grouped'] }))} />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={filters.next30} onChange={(e) => setFilters((f) => ({ ...f, next30: e.target.checked }))} />
          Starts in next 30 days
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={filters.pastSoftLockNotAudited} onChange={(e) => setFilters((f) => ({ ...f, pastSoftLockNotAudited: e.target.checked }))} />
          Past soft lock &amp; not Audited
        </label>
        {canEdit && (
          <label className="flex items-center gap-1.5 text-xs" title="Cancelled offers are hidden by default (A4)">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Show cancelled
          </label>
        )}
        <button
          onClick={() => setFilters({ ...EMPTY_FILTERS })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface"
        >
          <X size={13} /> Clear filters
        </button>

        {viewsForRole.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted">Saved views ({role}):</span>
            <select
              className="rounded-md border border-border px-2 py-1 text-xs"
              value=""
              onChange={(e) => {
                const v = viewsForRole.find((x) => x.id === e.target.value);
                if (v) {
                  setFilters(v.state.filters as Filters);
                  if (v.state.columnVisibility) setColumnVisibility(v.state.columnVisibility as VisibilityState);
                  push(`Applied view "${v.name}".`, 'info');
                }
              }}
            >
              <option value="">Apply a view…</option>
              {viewsForRole.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No offers match these filters."
          action={
            <button
              onClick={() => setFilters({ ...EMPTY_FILTERS })}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full whitespace-nowrap text-left">
            <thead className="border-b border-border bg-surface">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2 font-medium text-muted">
                      {header.isPlaceholder ? null : (
                        <button
                          className={`inline-flex items-center gap-1 ${
                            header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: <ChevronUp size={13} />, desc: <ChevronDown size={13} /> }[
                            header.column.getIsSorted() as string
                          ] ?? null}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel dialog */}
      <ConfirmDialog
        open={cancelUid !== null}
        title="Cancel offer"
        description={`Cancel "${cancelOfferRecord?.offerName ?? ''}"? The record is kept and shown as Cancelled.`}
        confirmLabel="Cancel offer"
        cancelLabel="Keep offer"
        destructive
        withInput
        inputLabel="Reason"
        inputRequired
        inputPlaceholder="Why is this offer being cancelled?"
        onConfirm={(reason) => {
          if (cancelUid) {
            cancelOffer(cancelUid, reason);
            push('Offer cancelled.', 'warning');
          }
          setCancelUid(null);
        }}
        onCancel={() => setCancelUid(null)}
      />

      {/* Save view dialog */}
      <ConfirmDialog
        open={saveViewOpen}
        title="Save view"
        description={`Saves the current filters and columns as a personal view for the ${role} role.`}
        confirmLabel="Save view"
        withInput
        inputLabel="View name"
        inputRequired
        inputPlaceholder="e.g. CAN completed"
        onConfirm={(name) => {
          addSavedView({ name, role, state: { filters, columnVisibility: effectiveVisibility } });
          push(`View "${name}" saved.`, 'success');
          setSaveViewOpen(false);
        }}
        onCancel={() => setSaveViewOpen(false)}
      />

      {viewsForRole.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          {viewsForRole.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
              {v.name}
              <button aria-label={`Delete view ${v.name}`} onClick={() => deleteSavedView(v.id)} className="text-muted hover:text-danger">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <HistoryDrawer
        offerUid={historyUid}
        offerName={String(historyOffer?.offerName ?? historyOffer?.offerId ?? '')}
        open={historyUid !== null}
        onOpenChange={(o) => !o && setHistoryUid(null)}
      />
    </div>
  );
}

// --- small helpers ---

function selectColumn(): ColumnDef<OfferRecord> {
  return {
    id: '__select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
  };
}

function MenuItem({
  children,
  onSelect,
  destructive,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 outline-none hover:bg-surface ${
        destructive ? 'text-danger' : 'text-ink'
      }`}
    >
      {destructive && <XCircle size={14} />}
      {!destructive && <HistoryIcon size={14} className="opacity-0" />}
      {children}
    </DropdownMenu.Item>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="rounded-md border border-border px-2 py-1.5 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ColumnsMenu({ table }: { table: ReturnType<typeof useReactTable<OfferRecord>> }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface">
          <Columns3 size={15} /> Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 max-h-96 min-w-[240px] overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {table
            .getAllLeafColumns()
            .filter((c) => !c.id.startsWith('__'))
            .map((col) => {
              const f = fieldsById[col.id];
              return (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                  />
                  {f?.label ?? col.id}
                </label>
              );
            })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
