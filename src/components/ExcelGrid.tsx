import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronUp, ChevronDown, Columns3, Info, GripVertical, AlertTriangle, LayoutList, X } from 'lucide-react';
import { TagPill, type TagKind } from '@/components/TagPill';
import type { OfferRecord } from '@/lib/types';

export interface ExcelColumn {
  id: string;
  header: string;
  group?: string;
  groupClass?: string; // bg colour class for the header cell
  /** v3: header band label (a band row is drawn above the headers when set). */
  band?: string;
  bandClass?: string;
  tag?: TagKind;
  /** v3: a custom tag (e.g. "Copy of R&F") when the tag is not a TagPill kind. */
  tagNode?: ReactNode;
  tooltip?: ReactNode;
  /** v3: known caveat, shown as an amber info icon. */
  caveat?: string;
  /** v3: small grey text under the header (e.g. the Databricks column name). */
  subHeader?: string;
  excelCol?: string;
  width?: number;
  defaultVisible?: boolean;
  sortValue: (o: OfferRecord) => string | number;
  /** v3: text matched by the per-column filter (defaults to the sort value). */
  filterValue?: (o: OfferRecord) => string;
  cell: (o: OfferRecord) => ReactNode;
}

export interface GridPreset {
  name: string;
  visible: string[];
}

interface Layout {
  visible: string[]; // ordered visible column ids
  sortId?: string;
  sortDir?: 'asc' | 'desc';
  freeze: number;
  density: 'comfortable' | 'compact';
  filters?: Record<string, string>; // per-column "contains" text
  widths?: Record<string, number>; // per-column overridden width (drag-resize)
  preset?: string; // name of the applied view
}

interface SavedGridView {
  name: string;
  visible: string[];
  freeze: number;
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function ExcelGrid({
  rows,
  columns,
  storageKey,
  getRowId,
  onRowClick,
  freezeDefault = 2,
  toolbarRight,
  presets,
  defaultPreset,
  onView,
}: {
  rows: OfferRecord[];
  columns: ExcelColumn[];
  storageKey: string;
  getRowId: (o: OfferRecord) => string;
  onRowClick?: (o: OfferRecord) => void;
  freezeDefault?: number;
  toolbarRight?: ReactNode;
  /** v3: built-in views shown in the Views menu (users can also save their own). */
  presets?: GridPreset[];
  defaultPreset?: string;
  /** v3: called with the visible column ids and the filtered + sorted rows (for exports). */
  onView?: (v: { visible: string[]; rows: OfferRecord[] }) => void;
}) {
  const colById = useMemo(() => Object.fromEntries(columns.map((c) => [c.id, c])), [columns]);
  const startPreset = presets?.find((p) => p.name === defaultPreset) ?? presets?.[0];
  const defaultVisible = useMemo(
    () => startPreset?.visible ?? columns.filter((c) => c.defaultVisible !== false).map((c) => c.id),
    [columns, startPreset],
  );
  const defaultLayout = (): Layout => ({
    visible: defaultVisible,
    freeze: freezeDefault,
    density: 'compact',
    preset: startPreset?.name,
  });

  const [layout, setLayout] = useState<Layout>(() => {
    const saved = load<Layout>(storageKey);
    // Ignore a saved layout whose columns no longer exist (e.g. older column ids).
    if (saved && saved.visible?.some((id) => colById[id])) return saved;
    return defaultLayout();
  });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  function update(next: Partial<Layout>) {
    setLayout((l) => {
      const merged = { ...l, ...next };
      save(storageKey, merged);
      return merged;
    });
  }

  // v3: personal saved views (per storage key, so per user and per grid).
  const viewsKey = `${storageKey}::views`;
  const [savedViews, setSavedViews] = useState<SavedGridView[]>(() => load<SavedGridView[]>(viewsKey) ?? []);
  const [naming, setNaming] = useState<string | null>(null);
  function saveCurrentView(name: string) {
    const v = { name, visible: layout.visible, freeze: layout.freeze };
    const next = [...savedViews.filter((x) => x.name !== name), v];
    setSavedViews(next);
    save(viewsKey, next);
    update({ preset: name });
  }
  function deleteView(name: string) {
    const next = savedViews.filter((x) => x.name !== name);
    setSavedViews(next);
    save(viewsKey, next);
  }

  const visibleCols = layout.visible.map((id) => colById[id]).filter(Boolean) as ExcelColumn[];
  const rowH = layout.density === 'compact' ? 30 : 40;

  // Effective width for a column: a drag-resized override, else its natural width.
  const colWidth = (c: ExcelColumn) => layout.widths?.[c.id] ?? c.width ?? 150;

  // --- Drag to resize a column (pointer drag on the right edge of a header) ---
  const resizeRef = useRef<{ id: string; startX: number; startW: number } | null>(null);
  function onResizeDown(e: React.PointerEvent, c: ExcelColumn) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { id: c.id, startX: e.clientX, startW: colWidth(c) };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const w = Math.max(60, Math.round(r.startW + (ev.clientX - r.startX)));
      update({ widths: { ...(layoutRef.current.widths ?? {}), [r.id]: w } });
    };
    const up = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // --- Drag to reorder columns (native HTML5 drag on the header label) ---
  const [dragId, setDragId] = useState<string | null>(null);
  function onReorderDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const order = [...layout.visible];
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    update({ visible: order });
    setDragId(null);
  }

  const sorted = useMemo(() => {
    // per-column "contains" filters first
    const active = Object.entries(layout.filters ?? {}).filter(([, v]) => v.trim() !== '');
    let out = rows;
    if (active.length) {
      out = rows.filter((o) =>
        active.every(([id, q]) => {
          const col = colById[id];
          if (!col) return true;
          const text = col.filterValue ? col.filterValue(o) : String(col.sortValue(o));
          return text.toLowerCase().includes(q.trim().toLowerCase());
        }),
      );
    }
    if (!layout.sortId) return out;
    const col = colById[layout.sortId];
    if (!col) return out;
    const dir = layout.sortDir === 'desc' ? -1 : 1;
    return [...out].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      // numbers before text, like Excel
      if (typeof av !== typeof bv) return (typeof av === 'number' ? -1 : 1) * dir;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, layout.sortId, layout.sortDir, layout.filters, colById]);

  // v3: report the current view so the page can export exactly what is shown.
  useEffect(() => {
    onView?.({ visible: visibleCols.map((c) => c.id), rows: sorted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, layout.visible, onView]);

  // Frozen-column left offsets.
  const lefts: number[] = [];
  let acc = 0;
  visibleCols.forEach((c, i) => {
    lefts[i] = acc;
    if (i < layout.freeze) acc += colWidth(c);
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 12,
  });

  function toggleSort(id: string) {
    update(
      layout.sortId === id
        ? { sortDir: layout.sortDir === 'asc' ? 'desc' : 'asc' }
        : { sortId: id, sortDir: 'asc' },
    );
  }

  const totalWidth = visibleCols.reduce((w, c) => w + colWidth(c), 0);
  const hasBands = visibleCols.some((c) => c.band);
  const allViews: Array<{ name: string; visible: string[]; freeze?: number; saved?: boolean }> = [
    ...(presets ?? []),
    ...savedViews.map((v) => ({ ...v, saved: true })),
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ColumnsMenu columns={columns} visible={layout.visible} onChange={(v) => update({ visible: v })} />
        {presets && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface">
                <LayoutList size={13} /> View: {layout.preset ?? 'Custom'}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" className="z-50 max-h-96 min-w-[240px] overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Views</div>
                {allViews.map((v) => (
                  <DropdownMenu.Item
                    key={`${v.saved ? 's' : 'p'}-${v.name}`}
                    onSelect={() => update({ visible: v.visible, freeze: v.freeze ?? layout.freeze, preset: v.name })}
                    className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1 text-xs outline-none hover:bg-surface data-[highlighted]:bg-surface"
                  >
                    <span>
                      {v.name}
                      {v.saved && <span className="ml-1 text-muted">(mine)</span>}
                    </span>
                    {v.saved && (
                      <button
                        aria-label={`Delete view ${v.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteView(v.name);
                        }}
                        className="text-muted hover:text-danger"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={() => setNaming('')}
                  className="cursor-pointer px-3 py-1 text-xs text-primary outline-none hover:bg-surface data-[highlighted]:bg-surface"
                >
                  Save current view…
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        {naming !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (naming.trim()) saveCurrentView(naming.trim());
              setNaming(null);
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              placeholder="View name"
              className="rounded border border-border px-1.5 py-0.5 text-xs"
            />
            <button type="submit" className="rounded bg-primary px-2 py-0.5 text-xs text-white">Save</button>
            <button type="button" onClick={() => setNaming(null)} className="text-xs text-muted">Cancel</button>
          </form>
        )}
        <label className="flex items-center gap-1 text-xs text-muted">
          Freeze
          <select
            className="rounded border border-border px-1 py-0.5 text-xs"
            value={layout.freeze}
            onChange={(e) => update({ freeze: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="inline-flex overflow-hidden rounded border border-border text-xs">
          {(['compact', 'comfortable'] as const).map((d) => (
            <button
              key={d}
              onClick={() => update({ density: d })}
              className={`px-2 py-0.5 ${layout.density === d ? 'bg-primary text-white' : 'bg-white text-ink'}`}
            >
              {d === 'compact' ? 'Compact' : 'Comfortable'}
            </button>
          ))}
        </div>
        <button
          onClick={() => update({ ...defaultLayout(), sortId: undefined, sortDir: undefined, filters: {}, widths: {} })}
          className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"
        >
          Reset my view
        </button>
        <span className="text-xs text-muted">{sorted.length.toLocaleString()} rows</span>
        <div className="ml-auto flex items-center gap-2">{toolbarRight}</div>
      </div>

      <div ref={scrollRef} className="relative max-h-[62vh] overflow-auto rounded-lg border border-border bg-white">
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          <div className="sticky top-0 z-20">
            {/* Band row (v3): labels each run of columns that share a band. */}
            {hasBands && (
              <div className="flex border-b border-border/60 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {visibleCols.map((c, i) => {
                  const frozen = i < layout.freeze;
                  const first = i === 0 || visibleCols[i - 1].band !== c.band || i === layout.freeze;
                  return (
                    <div
                      key={c.id}
                      className={`shrink-0 px-2 py-0.5 ${c.bandClass ?? 'bg-surface'} ${frozen ? 'sticky z-10' : ''}`}
                      style={{ width: colWidth(c), left: frozen ? lefts[i] : undefined }}
                    >
                      {first ? c.band ?? '' : ''}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Header */}
            <div className="flex border-b border-border bg-surface text-xs font-medium text-muted">
              {visibleCols.map((c, i) => {
                const frozen = i < layout.freeze;
                return (
                  <div
                    key={c.id}
                    onDragOver={(e) => dragId && e.preventDefault()}
                    onDrop={() => onReorderDrop(c.id)}
                    className={`group/col relative shrink-0 border-r border-border/60 px-2 py-1.5 ${c.groupClass ?? 'bg-surface'} ${frozen ? 'sticky z-10' : ''} ${dragId === c.id ? 'opacity-50' : ''}`}
                    style={{ width: colWidth(c), left: frozen ? lefts[i] : undefined }}
                  >
                    <div className="flex w-full items-center gap-1">
                      <span
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => setDragId(null)}
                        title="Drag to reorder"
                        className="shrink-0 cursor-grab text-muted/40 opacity-0 hover:text-primary group-hover/col:opacity-100 active:cursor-grabbing"
                      >
                        <GripVertical size={11} />
                      </span>
                      <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => toggleSort(c.id)} title={c.header}>
                        <span className="truncate">{c.header}</span>
                        {c.excelCol && <span className="shrink-0 text-[9px] text-muted/70">{c.excelCol}</span>}
                        {layout.sortId === c.id && (layout.sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
                      </button>
                    </div>
                    {c.subHeader && <div className="truncate font-mono text-[9px] font-normal text-muted/80" title={c.subHeader}>{c.subHeader}</div>}
                    {/* Drag-resize handle on the right edge; double-click clears the override. */}
                    <div
                      onPointerDown={(e) => onResizeDown(e, c)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const next = { ...(layout.widths ?? {}) };
                        delete next[c.id];
                        update({ widths: next });
                      }}
                      title="Drag to resize · double-click to reset"
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none hover:bg-primary/40"
                    />
                    <input
                      value={layout.filters?.[c.id] ?? ''}
                      onChange={(e) => update({ filters: { ...(layout.filters ?? {}), [c.id]: e.target.value } })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Filter…"
                      className="mt-0.5 w-full rounded border border-border px-1 py-0.5 text-[10px] font-normal focus:border-primary focus:outline-none"
                    />
                    <div className="mt-0.5 flex items-center gap-1">
                      {c.tag && <TagPill kind={c.tag} />}
                      {c.tagNode}
                      {c.tooltip && <TipIcon content={c.tooltip} />}
                      {c.caveat && <TipIcon content={c.caveat} caveat />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Virtualized rows */}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const o = sorted[vi.index];
              return (
                <div
                  key={getRowId(o)}
                  onClick={() => onRowClick?.(o)}
                  className={`absolute left-0 flex border-b border-border/50 text-xs hover:bg-surface/60 ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{ top: vi.start, height: rowH, width: totalWidth, minWidth: '100%' }}
                >
                  {visibleCols.map((c, i) => {
                    const frozen = i < layout.freeze;
                    return (
                      <div
                        key={c.id}
                        className={`flex shrink-0 items-center overflow-hidden border-r border-border/40 px-2 ${frozen ? 'sticky z-10 bg-white' : 'bg-white'}`}
                        style={{ width: colWidth(c), left: frozen ? lefts[i] : undefined }}
                      >
                        <span className="truncate">{c.cell(o)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TipIcon({ content, caveat }: { content: ReactNode; caveat?: boolean }) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button className={caveat ? 'text-warning hover:text-warning/80' : 'text-muted hover:text-primary'} aria-label={caveat ? 'Known caveat' : 'About this column'}>
            {caveat ? <AlertTriangle size={11} /> : <Info size={11} />}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="bottom" className="z-50 max-w-[380px] rounded border border-border bg-white p-2 text-[11px] text-ink shadow-md">
            {content}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function ColumnsMenu({
  columns,
  visible,
  onChange,
}: {
  columns: ExcelColumn[];
  visible: string[];
  onChange: (v: string[]) => void;
}) {
  const byGroup = useMemo(() => {
    const m = new Map<string, ExcelColumn[]>();
    for (const c of columns) {
      const g = c.band ?? c.group ?? 'Fields';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return m;
  }, [columns]);

  function toggle(id: string, on: boolean) {
    if (on) {
      // keep the original column order when re-adding
      const order = columns.map((c) => c.id);
      onChange([...visible, id].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    } else {
      onChange(visible.filter((x) => x !== id));
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface">
          <Columns3 size={13} /> Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" className="z-50 max-h-96 min-w-[260px] overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {[...byGroup.entries()].map(([g, cols]) => (
            <div key={g}>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</div>
              {cols.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-surface">
                  <input type="checkbox" checked={visible.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                  {c.excelCol && <span className="w-6 shrink-0 text-[10px] text-muted">{c.excelCol}</span>}
                  {c.header}
                </label>
              ))}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
