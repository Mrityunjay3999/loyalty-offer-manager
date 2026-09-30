import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { PhaseBadge } from '@/components/PhaseBadge';
import { statusPillClass, statusOf } from '@/lib/lifecycle';
import { parseISO } from '@/lib/format';

export function Phase2Calendar() {
  const offers = useAppStore((s) => s.offers);
  const navigate = useNavigate();
  const [showOverlap, setShowOverlap] = useState(false);

  // Default to the month of the earliest offer start.
  const initial = useMemo(() => {
    const dates = offers.map((o) => parseISO(o.startDate)).filter(Boolean) as Date[];
    const min = dates.sort((a, b) => a.getTime() - b.getTime())[0];
    return min ? startOfMonth(min) : startOfMonth(new Date());
  }, [offers]);
  const [month, setMonth] = useState<Date>(initial);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const active = useMemo(() => {
    return offers
      .map((o) => ({ o, s: parseISO(o.startDate), e: parseISO(o.endDate) }))
      .filter((x) => x.s && x.e && x.s <= monthEnd && x.e >= monthStart)
      .sort((a, b) => (a.s!.getTime() - b.s!.getTime()));
  }, [offers, monthStart, monthEnd]);

  function overlaps(a: { s: Date | null; e: Date | null }, b: { s: Date | null; e: Date | null }) {
    if (!a.s || !a.e || !b.s || !b.e) return false;
    return a.s <= b.e && b.s <= a.e;
  }
  const overlapUids = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++)
        if (overlaps(active[i], active[j])) {
          set.add(active[i].o._uid!);
          set.add(active[j].o._uid!);
        }
    return set;
  }, [active]);

  const shown = showOverlap ? active.filter((x) => overlapUids.has(x.o._uid!)) : active;

  function barStyle(s: Date, e: Date) {
    const total = days.length;
    const startIdx = Math.max(0, Math.round((Math.max(s.getTime(), monthStart.getTime()) - monthStart.getTime()) / 86_400_000));
    const endIdx = Math.min(total - 1, Math.round((Math.min(e.getTime(), monthEnd.getTime()) - monthStart.getTime()) / 86_400_000));
    return {
      marginLeft: `${(startIdx / total) * 100}%`,
      width: `${((endIdx - startIdx + 1) / total) * 100}%`,
    };
  }

  return (
    <div>
      <PageHeader title="Calendar view">
        <PhaseBadge />
      </PageHeader>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-md border border-border p-1.5 hover:bg-surface"><ChevronLeft size={15} /></button>
          <span className="min-w-[140px] text-center font-medium">{format(month, 'MMMM yyyy')}</span>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-md border border-border p-1.5 hover:bg-surface"><ChevronRight size={15} /></button>
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={showOverlap} onChange={(e) => setShowOverlap(e.target.checked)} />
          Show overlapping offers for the same members
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        {/* Day header */}
        <div className="flex border-b border-border bg-surface text-[10px] text-muted">
          <div className="w-56 shrink-0 border-r border-border px-2 py-1 font-medium">Offer</div>
          <div className="flex flex-1">
            {days.map((d) => (
              <div key={d.toISOString()} className="flex-1 border-r border-border/50 py-1 text-center last:border-0">
                {format(d, 'd')}
              </div>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">No offers active in {format(month, 'MMMM yyyy')}.</div>
        ) : (
          shown.map(({ o, s, e }) => (
            <div key={o._uid} className="flex items-center border-b border-border last:border-0 hover:bg-surface/50">
              <button onClick={() => navigate(`/offers/${o._uid}`)} className="w-56 shrink-0 truncate border-r border-border px-2 py-1.5 text-left text-xs text-primary hover:underline" title={String(o.offerName)}>
                {String(o.offerName ?? o.offerId)}
              </button>
              <div className="relative flex-1 py-1.5">
                <div
                  className={`h-4 rounded ${statusPillClass(statusOf(o))} ${showOverlap && overlapUids.has(o._uid!) ? 'ring-2 ring-danger' : ''}`}
                  style={barStyle(s!, e!)}
                  title={`${statusOf(o)} · ${o.startDate} → ${o.endDate}`}
                />
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Bars are coloured by status. This month grid is a Phase 2 preview.</p>
    </div>
  );
}
