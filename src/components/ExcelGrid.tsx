import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronUp, ChevronDown, Columns3, Info } from 'lucide-react';
import { TagPill, type TagKind } from '@/components/TagPill';
import type { OfferRecord } from '@/lib/types';

export interface ExcelColumn {
  id: string;
  header: string;
  group?: string;
  groupClass?: string; // bg colour class for the group header band
  tag?: TagKind;
  tooltip?: string;
  excelCol?: string;
  width?: number;
  defaultVisible?: boolean;
  sortValue: (o: OfferRecord) => string | number;
  cell: (o: OfferRecord) => ReactNode;
}

interface Layout {
  visible: string[]; // ordered visible column ids
  sortId?: string;
  sortDir?: 'asc' | 'desc';
  freeze: number;
  density: 'comfortable' | 'compact';
}

function loadLayout(key: string): Layout | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Layout) : null;
  } catch {
    return null;
  }
}
function saveLayout(key: string, l: Layout) {
  try {
    localStorage.setItem(key, JSON.stringify(l));
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
}: {
  rows: OfferRecord[];
  columns: ExcelColumn[];
  storageKey: string;
  getRowId: (o: OfferRecord) => string;
  onRowClick?: (o: OfferRecord) => void;
  freezeDefault?: number;
  toolbarRight?: ReactNode;
}) {
  const colById = useMemo(() => Object.fromEntries(columns.map((c) => [c.id, c])), [columns]);
  const defaultVisible = useMemo(
    () => columns.filter((c) => c.defaultVisible !== false).map((c) => c.id),
    [columns],
  );

  const [layout, setLayout] = useState<Layout>(() => {
    const saved = loadLayout(storageKey);
    return (
      saved ?? {
        visible: defaultVisible,
        freeze: freezeDefault,
        density: 'compact',
      }
    );
  });
  function update(next: Partial<Layout>) {
    setLayout((l) => {
      const merged = { ...l, ...next };
      saveLayout(storageKey, merged);
      return merged;
    });
  }

  const visibleCols = layout.visible.map((id) => colById[id]).filter(Boolean) as ExcelColumn[];
  const rowH = layout.density === 'compact' ? 30 : 40;

  const sorted = useMemo(() => {
    if (!layout.sortId) return rows;
    const col = colById[layout.sortId];
    if (!col) return rows;
    const dir = layout.sortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, layout.sortId, layout.sortDir, colById]);

  // Frozen-column left offsets.
  const lefts: number[] = [];
  let acc = 0;
  visibleCols.forEach((c, i) => {
    lefts[i] = acc;
    if (i < layout.freeze) acc += c.width ?? 150;
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

  const totalWidth = visibleCols.reduce((w, c) => w + (c.width ?? 150), 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ColumnsMenu columns={columns} visible={layout.visible} onChange={(v) => update({ visible: v })} />
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
          onClick={() => update({ visible: defaultVisible, freeze: freezeDefault, density: 'compact', sortId: undefined, sortDir: undefined })}
          className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"
        >
          Reset my view
        </button>
        <span className="text-xs text-muted">{sorted.length.toLocaleString()} rows</span>
        <div className="ml-auto flex items-center gap-2">{toolbarRight}</div>
      </div>

      <div ref={scrollRef} className="relative max-h-[62vh] overflow-auto rounded-lg border border-border bg-white">
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-surface text-xs font-medium text-muted">
            {visibleCols.map((c, i) => {
              const frozen = i < layout.freeze;
              return (
                <div
                  key={c.id}
                  className={`shrink-0 border-r border-border/60 px-2 py-1.5 ${c.groupClass ?? ''} ${frozen ? 'sticky z-10 bg-surface' : ''}`}
                  style={{ width: c.width ?? 150, left: frozen ? lefts[i] : undefined }}
                >
                  <button className="flex w-full items-center gap-1 text-left" onClick={() => toggleSort(c.id)}>
                    <span className="truncate">{c.header}</span>
                    {c.excelCol && <span className="text-[9px] text-muted/70">{c.excelCol}</span>}
                    {layout.sortId === c.id && (layout.sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
                  </button>
                  <div className="mt-0.5 flex items-center gap-1">
                    {c.tag && <TagPill kind={c.tag} />}
                    {c.tooltip && (
                      <Tooltip.Provider delayDuration={150}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button className="text-muted hover:text-primary"><Info size={11} /></button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content side="bottom" className="z-50 max-w-[320px] rounded border border-border bg-white p-2 text-[11px] text-ink shadow-md">
                              {c.tooltip}
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    )}
                  </div>
                </div>
              );
            })}
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
                        style={{ width: c.width ?? 150, left: frozen ? lefts[i] : undefined }}
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
      const g = c.group ?? 'Fields';
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
        <DropdownMenu.Content align="start" className="z-50 max-h-96 min-w-[240px] overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {[...byGroup.entries()].map(([g, cols]) => (
            <div key={g}>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</div>
              {cols.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-surface">
                  <input type="checkbox" checked={visible.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
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
