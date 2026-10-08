import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, addWeeks,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { PhaseBadge } from '@/components/PhaseBadge';
import { StatusPill } from '@/components/StatusPill';
import { OfferDetailDrawer } from '@/components/OfferDetailDrawer';
import { EmptyState } from '@/components/EmptyState';
import {
  toCalendarOffers, offersMissingDates, applyFilters, countForDay, offersOnDay,
  periodSummary, legendFor, groupKey, colourFor, fiscalWeekOf, fiscalYearOfDate,
  runLengthDays, EMPTY_FILTERS, type CalendarFilters, type CalendarOffer, type ColourBy,
} from '@/lib/calendar';

type View = 'month' | 'week' | 'timeline';

interface CalendarPrefs extends CalendarFilters {
  view: View;
  colourBy: ColourBy;
  includeEarly: boolean;
}
const DEFAULT_PREFS: CalendarPrefs = { ...EMPTY_FILTERS, view: 'month', colourBy: 'group', includeEarly: false };

function loadPrefs(key: string): CalendarPrefs | null {
  try { const raw = localStorage.getItem(key); return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : null; } catch { return null; }
}
function savePrefs(key: string, p: CalendarPrefs) {
  try { localStorage.setItem(key, JSON.stringify(p)); } catch { /* ignore */ }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Phase2Calendar() {
  const offers = useAppStore((s) => s.offers);
  const dropdowns = useAppStore((s) => s.dropdowns);
  const userId = useAppStore((s) => s.currentUserId);
  const prefsKey = `lom-calendar-${userId}`;
  const [params, setParams] = useSearchParams();

  const [prefs, setPrefs] = useState<CalendarPrefs>(() => loadPrefs(prefsKey) ?? DEFAULT_PREFS);
  function patch(next: Partial<CalendarPrefs>) {
    setPrefs((p) => { const m = { ...p, ...next }; savePrefs(prefsKey, m); return m; });
  }
  const { view, colourBy, includeEarly } = prefs;
  const filters: CalendarFilters = prefs;

  const [anchor, setAnchor] = useState<Date>(startOfMonth(new Date()));
  const [dayOpen, setDayOpen] = useState<Date | null>(null);
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [highlightUid, setHighlightUid] = useState<string | null>(null);

  // All drawable offers (filters applied). The calendar owns no data — this is a
  // live projection of the store, so any create/edit/cancel shows up at once.
  const allCos = useMemo(() => toCalendarOffers(offers), [offers]);
  const cos = useMemo(() => applyFilters(allCos, filters), [allCos, filters]);
  const missing = useMemo(() => offersMissingDates(offers), [offers]);

  // "View on calendar": jump to the offer's start month and highlight it.
  useEffect(() => {
    const target = params.get('offer');
    if (!target) return;
    const co = allCos.find((c) => c.o._uid === target);
    if (co) {
      setAnchor(startOfMonth(co.start));
      setHighlightUid(target);
    }
    params.delete('offer');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const days = useMemo(() => {
    if (view === 'week') {
      return eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn: 0 }), end: endOfWeek(anchor, { weekStartsOn: 0 }) });
    }
    const s = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const e = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: s, end: e });
  }, [anchor, view]);

  // Days that belong to the visible period proper (month cells dim the rest).
  const periodDays = useMemo(() => {
    if (view === 'week') return days;
    return days.filter((d) => isSameMonth(d, anchor));
  }, [days, view, anchor]);

  const legend = useMemo(() => legendFor(cos, colourBy), [cos, colourBy]);
  const summary = useMemo(() => periodSummary(cos, periodDays, includeEarly), [cos, periodDays, includeEarly]);
  const maxCount = useMemo(
    () => Math.max(1, ...periodDays.map((d) => countForDay(cos, d, includeEarly).total)),
    [cos, periodDays, includeEarly],
  );

  const detail = offers.find((o) => o._uid === detailUid);
  const stepPrev = () => setAnchor((a) => (view === 'week' ? addWeeks(a, -1) : addMonths(a, -1)));
  const stepNext = () => setAnchor((a) => (view === 'week' ? addWeeks(a, 1) : addMonths(a, 1)));

  const activeFilterCount = [
    filters.country, filters.offerTiering, filters.offerDesign, filters.category,
    filters.subCategory, filters.broadVsTargeted, filters.channel, filters.fiscalYear,
  ].filter(Boolean).length + (filters.status.length ? 1 : 0);

  const opt = (key: string) => (dropdowns[key] ?? []) as string[];
  const fyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCos) { const fy = fiscalYearOfDate(c.start); if (fy) set.add(String(fy)); }
    return [...set].sort();
  }, [allCos]);

  return (
    <div>
      <PageHeader title="Calendar view"><PhaseBadge /></PageHeader>
      <p className="-mt-1 mb-3 text-sm text-muted">
        See how many offers run on the same day or week. Replaces the “Pts by day by FW” tab used today.
      </p>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded border border-border text-xs">
          {(['month', 'week', 'timeline'] as View[]).map((m) => (
            <button key={m} onClick={() => patch({ view: m })} className={`px-2.5 py-1 capitalize ${view === m ? 'bg-primary text-white' : 'bg-white text-ink'}`}>{m}</button>
          ))}
        </div>
        <button onClick={stepPrev} className="rounded border border-border p-1 hover:bg-surface" aria-label="Previous"><ChevronLeft size={15} /></button>
        <button onClick={() => setAnchor(startOfMonth(new Date()))} className="rounded border border-border px-2 py-1 text-xs hover:bg-surface">Today</button>
        <button onClick={stepNext} className="rounded border border-border p-1 hover:bg-surface" aria-label="Next"><ChevronRight size={15} /></button>
        <input
          type="month"
          className="rounded border border-border px-2 py-1 text-xs"
          value={format(anchor, 'yyyy-MM')}
          onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); if (y && m) setAnchor(new Date(y, m - 1, 1)); }}
        />
        <span className="min-w-[150px] text-sm font-medium">
          {view === 'week'
            ? `Week of ${format(startOfWeek(anchor, { weekStartsOn: 0 }), 'MMM d, yyyy')}`
            : format(anchor, 'MMMM yyyy')}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            Colour by
            <select value={colourBy} onChange={(e) => patch({ colourBy: e.target.value as ColourBy })} className="rounded border border-border px-1.5 py-1 text-xs">
              <option value="group">Broad vs Targeted</option>
              <option value="status">Status</option>
            </select>
          </label>
          <Tooltip.Provider delayDuration={150}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <label className="flex cursor-help items-center gap-1 text-xs text-muted">
                  <input type="checkbox" checked={includeEarly} onChange={(e) => patch({ includeEarly: e.target.checked })} />
                  Include early activation days
                  <Info size={12} />
                </label>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="bottom" className="z-50 max-w-[260px] rounded border border-border bg-white p-2 text-[11px] shadow-md">
                  Some offers let members activate before the start date.
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2">
        <Sel label="Country" value={filters.country} options={opt('country')} onChange={(v) => patch({ country: v })} />
        <Sel label="Tiering" value={filters.offerTiering} options={opt('offerTiering')} onChange={(v) => patch({ offerTiering: v })} />
        <Sel label="Offer Design" value={filters.offerDesign} options={opt('offerDesign')} onChange={(v) => patch({ offerDesign: v })} />
        <Sel label="Category" value={filters.category} options={opt('planningCategory')} onChange={(v) => patch({ category: v })} />
        <Sel label="Sub-Category" value={filters.subCategory} options={opt('planningSubCategory')} onChange={(v) => patch({ subCategory: v })} />
        <Sel label="Broad/Targeted" value={filters.broadVsTargeted} options={opt('broadVsTargeted')} onChange={(v) => patch({ broadVsTargeted: v })} />
        <Sel label="Channel" value={filters.channel} options={opt('channel')} onChange={(v) => patch({ channel: v })} />
        <Sel label="Fiscal year" value={filters.fiscalYear} options={fyOptions} onChange={(v) => patch({ fiscalYear: v })} />
        <StatusMulti options={opt('status')} value={filters.status} onChange={(v) => patch({ status: v })} />
        {activeFilterCount > 0 && (
          <button onClick={() => patch({ ...EMPTY_FILTERS })} className="rounded border border-border px-2 py-1 text-xs hover:bg-surface">Clear filters ({activeFilterCount})</button>
        )}
        <span className="ml-auto text-[11px] text-muted">Filters are personal to you.</span>
      </div>

      {/* Summary strip */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Offers in period" value={String(summary.offersInPeriod)} />
        <Stat label="Busiest day" value={summary.busiestDay ? `${format(summary.busiestDay.date, 'MMM d')} · ${summary.busiestDay.count}` : 'None'} />
        <Stat label="Avg offers / day" value={summary.avgPerDay ? summary.avgPerDay.toFixed(1) : '0'} />
        <Stat label="Broad / Targeted" value={`${summary.Broad} / ${summary.Targeted}`} />
      </div>

      {/* Legend */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        {legend.length === 0 ? <span className="text-muted">No offers in this period.</span> : legend.map((g) => (
          <span key={g.label} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded" style={{ background: g.colour }} /> {g.label} ({g.count})
          </span>
        ))}
        {view === 'month' && (
          <span className="ml-auto flex items-center gap-1 text-muted">
            Fewer
            {[0.12, 0.28, 0.5, 0.75, 1].map((a) => <span key={a} className="inline-block h-3 w-3 rounded" style={{ background: `rgba(44,110,118,${a})` }} />)}
            More
          </span>
        )}
      </div>

      {missing.length > 0 && (
        <p className="mb-2 text-xs text-muted">
          {missing.length} offer(s) not shown because a start or end date is missing.{' '}
          <button onClick={() => setDayOpen(null)} className="text-primary underline" title={missing.map((m) => m.offerName).join(', ')}>
            {missing.map((m) => String(m.offerName ?? m.offerId)).join(', ')}
          </button>
        </p>
      )}

      {cos.length === 0 ? (
        <EmptyState title="No offers run in this period with these filters." />
      ) : view === 'timeline' ? (
        <TimelineView cos={cos} days={days} colourBy={colourBy} includeEarly={includeEarly} highlightUid={highlightUid} onOpen={setDetailUid} />
      ) : (
        <MonthWeekGrid
          view={view} days={days} anchor={anchor} cos={cos} colourBy={colourBy}
          includeEarly={includeEarly} maxCount={maxCount} highlightUid={highlightUid}
          onDayClick={setDayOpen} onOpen={setDetailUid}
        />
      )}

      <p className="mt-2 text-xs text-muted">Read-only for every role. Excludes Draft and Cancelled. Phase 2 for delivery.</p>

      <DayPanel day={dayOpen} cos={cos} includeEarly={includeEarly} colourBy={colourBy} onClose={() => setDayOpen(null)} onOpen={(uid) => { setDayOpen(null); setDetailUid(uid); }} />
      <OfferDetailDrawer offer={detail} open={detailUid !== null} onClose={() => setDetailUid(null)} showCalendarLink={false} />
    </div>
  );
}

/* ---------------------------- Month / Week grid ---------------------------- */
function MonthWeekGrid({
  view, days, anchor, cos, colourBy, includeEarly, maxCount, highlightUid, onDayClick, onOpen,
}: {
  view: View; days: Date[]; anchor: Date; cos: CalendarOffer[]; colourBy: ColourBy;
  includeEarly: boolean; maxCount: number; highlightUid: string | null;
  onDayClick: (d: Date) => void; onOpen: (uid: string) => void;
}) {
  // Group the visible days into weeks (rows) so we can label the fiscal week.
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white p-2">
      <div className="mb-1 grid grid-cols-[52px_repeat(7,minmax(0,1fr))] text-center text-[11px] font-medium text-muted">
        <div />
        {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="mb-1 grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1">
          <div className="flex items-center justify-center rounded bg-surface text-[10px] font-medium text-muted">{fiscalWeekOf(week[0]) || '—'}</div>
          {week.map((day) => {
            const c = countForDay(cos, day, includeEarly);
            const dim = view === 'month' && !isSameMonth(day, anchor);
            const shade = c.total > 0 ? Math.min(1, 0.12 + (c.total / maxCount) * 0.88) : 0;
            const dayCos = offersOnDay(cos, day, includeEarly);
            const highlighted = highlightUid && dayCos.some((x) => x.o._uid === highlightUid);
            // breakdown by colour-by bucket for the stacked bar
            const buckets = new Map<string, { colour: string; n: number }>();
            for (const co of dayCos) {
              const k = groupKey(co, colourBy);
              const e = buckets.get(k) ?? { colour: colourFor(co, colourBy), n: 0 };
              e.n += 1; buckets.set(k, e);
            }
            return (
              <button
                key={day.toISOString()}
                onClick={() => c.total && onDayClick(day)}
                title={`${c.total} offers running: ${c.Broad} Broad, ${c.Targeted} Targeted, ${c.Other} N/A`}
                className={`flex ${view === 'week' ? 'h-40' : 'h-24'} flex-col rounded border p-1 text-left ${dim ? 'opacity-40' : ''} ${c.total ? 'hover:border-primary' : 'border-border'} ${isToday(day) ? 'border-primary ring-1 ring-primary' : 'border-border'} ${highlighted ? 'ring-2 ring-accent' : ''}`}
                style={{ background: shade ? `rgba(44,110,118,${shade * 0.18})` : undefined }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className={dim ? 'text-muted' : 'text-ink'}>{format(day, 'd')}</span>
                  {c.total > 0 && <span className="rounded-full bg-primary/10 px-1.5 font-semibold text-primary">{c.total}</span>}
                </div>
                {c.total > 0 && (
                  <div className="mt-1 flex h-2 w-full overflow-hidden rounded-sm">
                    {[...buckets.values()].map((b, i) => <div key={i} style={{ background: b.colour, width: `${(b.n / c.total) * 100}%` }} />)}
                  </div>
                )}
                {view === 'week' && (
                  <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
                    {dayCos.slice(0, 12).map((co) => (
                      <span
                        key={co.o._uid}
                        onClick={(e) => { e.stopPropagation(); onOpen(co.o._uid!); }}
                        className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                        style={{ background: colourFor(co, colourBy) }}
                        title={String(co.o.offerName)}
                      >
                        {String(co.o.offerName)}
                      </span>
                    ))}
                    {dayCos.length > 12 && <span className="text-[10px] text-muted">+{dayCos.length - 12} more</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Timeline view ------------------------------ */
function TimelineView({
  cos, days, colourBy, includeEarly, highlightUid, onOpen,
}: {
  cos: CalendarOffer[]; days: Date[]; colourBy: ColourBy; includeEarly: boolean;
  highlightUid: string | null; onOpen: (uid: string) => void;
}) {
  // Only offers that run on at least one visible day, sorted by start.
  const rows = useMemo(
    () => cos.filter((co) => days.some((d) => {
      const dd = new Date(d); dd.setHours(0, 0, 0, 0);
      return (dd >= co.start && dd <= co.end) || (includeEarly && co.early && dd >= co.early && dd < co.start);
    })).sort((a, b) => +a.start - +b.start),
    [cos, days, includeEarly],
  );
  const dayCounts = days.map((d) => countForDay(cos, d, includeEarly).total);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 30, overscan: 10 });
  const LEFT = 260; // frozen Offer ID + Name
  const colW = 22;
  const gridW = days.length * colW;

  const idx = (d: Date) => days.findIndex((x) => isSameDay(x, d));

  return (
    <div ref={scrollRef} className="max-h-[62vh] overflow-auto rounded-lg border border-border bg-white">
      <div style={{ width: LEFT + gridW }}>
        {/* Header: day numbers + per-day stack counts */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-surface">
          <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-surface px-2 py-1 text-[11px] font-medium text-muted" style={{ width: LEFT }}>
            <span className="w-16">Offer ID</span><span>Offer Name</span>
          </div>
          <div className="flex">
            {days.map((d, i) => (
              <div key={i} className="shrink-0 border-l border-border/40 text-center text-[9px] text-muted" style={{ width: colW }}>
                <div className={isToday(d) ? 'font-bold text-primary' : ''}>{format(d, 'd')}</div>
                <div className="text-[9px] font-semibold text-ink">{dayCounts[i] || ''}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Virtualised offer rows */}
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {virt.getVirtualItems().map((vi) => {
            const co = rows[vi.index];
            const sI = Math.max(0, idx(co.start < days[0] ? days[0] : co.start));
            const eI = co.end > days[days.length - 1] ? days.length - 1 : idx(co.end);
            const earlyI = includeEarly && co.early ? idx(co.early < days[0] ? days[0] : co.early) : -1;
            const hl = highlightUid === co.o._uid;
            return (
              <div key={co.o._uid} className={`absolute left-0 flex w-full items-center border-b border-border/40 ${hl ? 'bg-accent/10' : ''}`} style={{ top: vi.start, height: 30 }}>
                <button onClick={() => onOpen(co.o._uid!)} className="sticky left-0 z-10 flex h-full shrink-0 items-center gap-2 bg-white px-2 text-left text-xs hover:bg-surface" style={{ width: LEFT }}>
                  <span className="w-16 shrink-0 tabular-nums text-muted">{String(co.o.offerId ?? '—')}</span>
                  <span className="truncate text-primary">{String(co.o.offerName)}</span>
                </button>
                <div className="relative h-full" style={{ width: gridW }}>
                  {earlyI >= 0 && earlyI < sI && (
                    <div className="absolute top-1.5 h-5 rounded" style={{ left: earlyI * colW, width: (sI - earlyI) * colW, background: `repeating-linear-gradient(45deg, ${colourFor(co, colourBy)}, ${colourFor(co, colourBy)} 3px, transparent 3px, transparent 6px)`, opacity: 0.6 }} />
                  )}
                  {sI >= 0 && eI >= sI && (
                    <Tooltip.Provider delayDuration={150}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            onClick={() => onOpen(co.o._uid!)}
                            className="absolute top-1.5 h-5 rounded"
                            style={{ left: sI * colW, width: Math.max(colW, (eI - sI + 1) * colW), background: colourFor(co, colourBy) }}
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content side="top" className="z-50 max-w-[300px] rounded border border-border bg-white p-2 text-[11px] shadow-md">
                            <div className="font-medium">{String(co.o.offerName)}</div>
                            <div className="text-muted">{format(co.start, 'MMM d')} – {format(co.end, 'MMM d, yyyy')} · {runLengthDays(co)} days</div>
                            <div className="text-muted">{String(co.o.country ?? '—')} · {String(co.o.offerTiering ?? '—')} · {String(co.o.offerDesign ?? '—')} · {groupKey(co, 'group')}</div>
                            <div className="mt-1"><StatusPill status={co.status} withTooltip={false} /></div>
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
      </div>
    </div>
  );
}

/* ------------------------------- Day panel -------------------------------- */
function DayPanel({
  day, cos, includeEarly, colourBy, onClose, onOpen,
}: {
  day: Date | null; cos: CalendarOffer[]; includeEarly: boolean; colourBy: ColourBy;
  onClose: () => void; onOpen: (uid: string) => void;
}) {
  const list = day ? offersOnDay(cos, day, includeEarly) : [];
  return (
    <Dialog.Root open={day !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-md flex-col border-l border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="font-semibold">Offers running on {day && format(day, 'EEE, MMM d, yyyy')} ({list.length})</Dialog.Title>
            <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] text-muted">
                <th className="py-1">Offer</th><th>Dates</th><th>Country</th><th>Tier</th><th>Design</th>
              </tr></thead>
              <tbody>
                {list.map((co) => (
                  <tr key={co.o._uid} className="border-b border-border/50">
                    <td className="py-1.5">
                      <button onClick={() => onOpen(co.o._uid!)} className="flex items-center gap-1.5 text-left text-primary hover:underline">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded" style={{ background: colourFor(co, colourBy) }} />
                        <span className="truncate">{String(co.o.offerName)}</span>
                      </button>
                      <div className="mt-0.5"><StatusPill status={co.status} withTooltip={false} /></div>
                    </td>
                    <td className="text-[11px] text-muted">{format(co.start, 'MMM d')}–{format(co.end, 'MMM d')}</td>
                    <td className="text-[11px]">{String(co.o.country ?? '—')}</td>
                    <td className="text-[11px]">{String(co.o.offerTiering ?? '—')}</td>
                    <td className="text-[11px]">{String(co.o.offerDesign ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* -------------------------------- Widgets --------------------------------- */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
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

function StatusMulti({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded border border-border px-2 py-1 text-xs hover:bg-surface">
        Status{value.length ? ` (${value.length})` : ': All'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 max-h-60 w-56 overflow-y-auto rounded border border-border bg-white p-1 shadow-lg">
            {options.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-surface">
                <input
                  type="checkbox"
                  checked={value.includes(s)}
                  onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))}
                />
                {s}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
