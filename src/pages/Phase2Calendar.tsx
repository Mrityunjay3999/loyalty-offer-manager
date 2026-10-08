import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, addWeeks,
  startOfWeek, endOfWeek, isSameMonth,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { PhaseBadge } from '@/components/PhaseBadge';
import { StatusPill } from '@/components/StatusPill';
import { statusOf } from '@/lib/lifecycle';
import { parseISO } from '@/lib/format';
import type { OfferRecord } from '@/lib/types';

const BROAD = '#2C6E76';
const TARGETED = '#B5651D';
const OTHER = '#B9C0C4';

function bucket(o: OfferRecord): 'Broad' | 'Targeted' | 'Other' {
  if (o.broadVsTargeted === 'Broad') return 'Broad';
  if (o.broadVsTargeted === 'Targeted') return 'Targeted';
  return 'Other';
}

export function Phase2Calendar() {
  const offers = useAppStore((s) => s.offers);
  const navigate = useNavigate();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [country, setCountry] = useState('');
  const [tier, setTier] = useState('');
  const [design, setDesign] = useState('');
  const [category, setCategory] = useState('');
  const [dayOpen, setDayOpen] = useState<Date | null>(null);

  const active = useMemo(
    () => offers
      .filter((o) => statusOf(o) !== 'Draft' && statusOf(o) !== 'Cancelled')
      .filter((o) => !country || o.country === country)
      .filter((o) => !tier || o.offerTiering === tier)
      .filter((o) => !design || o.offerDesign === design)
      .filter((o) => !category || o.category === category)
      .map((o) => ({ o, s: parseISO(o.startDate), e: parseISO(o.endDate) }))
      .filter((x) => x.s && x.e),
    [offers, country, tier, design, category],
  );

  const opts = useMemo(() => {
    const base = offers.filter((o) => statusOf(o) !== 'Draft' && statusOf(o) !== 'Cancelled');
    const d = (fn: (o: OfferRecord) => string) => [...new Set(base.map(fn).filter(Boolean))].sort();
    return { country: d((o) => String(o.country ?? '')), tier: d((o) => String(o.offerTiering ?? '')), design: d((o) => String(o.offerDesign ?? '')), category: d((o) => String(o.category ?? '')) };
  }, [offers]);

  const initial = useMemo(() => {
    const dates = active.map((x) => x.s!).sort((a, b) => +a - +b);
    return dates[0] ? startOfMonth(dates[0]) : startOfMonth(new Date());
  }, [active]);
  const [anchor, setAnchor] = useState<Date>(initial);

  const days = useMemo(() => {
    if (mode === 'week') {
      const s = startOfWeek(anchor, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: s, end: endOfWeek(anchor, { weekStartsOn: 0 }) });
    }
    const s = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const e = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: s, end: e });
  }, [anchor, mode]);

  function offersOn(day: Date) {
    const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
    return active.filter((x) => x.s! <= d0 && d0 <= x.e!);
  }

  const totals = useMemo(() => {
    let b = 0, t = 0, o = 0;
    active.forEach((x) => { const k = bucket(x.o); if (k === 'Broad') b++; else if (k === 'Targeted') t++; else o++; });
    return { b, t, o };
  }, [active]);

  const dayOffers = dayOpen ? offersOn(dayOpen) : [];

  return (
    <div>
      <PageHeader title="Calendar view"><PhaseBadge /></PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded border border-border text-xs">
          {(['month', 'week'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-2 py-1 ${mode === m ? 'bg-primary text-white' : 'bg-white'}`}>{m === 'month' ? 'Month' : 'Week'}</button>
          ))}
        </div>
        <button onClick={() => setAnchor((a) => (mode === 'month' ? addMonths(a, -1) : addWeeks(a, -1)))} className="rounded border border-border p-1 hover:bg-surface"><ChevronLeft size={15} /></button>
        <span className="min-w-[140px] text-center font-medium">{mode === 'month' ? format(anchor, 'MMMM yyyy') : `Week of ${format(startOfWeek(anchor), 'MMM d')}`}</span>
        <button onClick={() => setAnchor((a) => (mode === 'month' ? addMonths(a, 1) : addWeeks(a, 1)))} className="rounded border border-border p-1 hover:bg-surface"><ChevronRight size={15} /></button>
        <Sel label="Country" value={country} options={opts.country} onChange={setCountry} />
        <Sel label="Tier" value={tier} options={opts.tier} onChange={setTier} />
        <Sel label="Offer Design" value={design} options={opts.design} onChange={setDesign} />
        <Sel label="Category" value={category} options={opts.category} onChange={setCategory} />
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded" style={{ background: BROAD }} /> Broad ({totals.b})</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded" style={{ background: TARGETED }} /> Targeted ({totals.t})</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded" style={{ background: OTHER }} /> N/A ({totals.o})</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-2">
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const on = offersOn(day);
            let b = 0, t = 0, o = 0;
            on.forEach((x) => { const k = bucket(x.o); if (k === 'Broad') b++; else if (k === 'Targeted') t++; else o++; });
            const total = on.length;
            const dim = mode === 'month' && !isSameMonth(day, anchor);
            return (
              <button key={day.toISOString()} onClick={() => total && setDayOpen(day)}
                title={`${total} offers running: ${b} Broad, ${t} Targeted`}
                className={`flex h-20 flex-col rounded border border-border p-1 text-left ${dim ? 'opacity-40' : ''} ${total ? 'hover:border-primary' : ''}`}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={dim ? 'text-muted' : 'text-ink'}>{format(day, 'd')}</span>
                  {total > 0 && <span className="rounded-full bg-primary/10 px-1 font-medium text-primary">{total}</span>}
                </div>
                {total > 0 && (
                  <div className="mt-auto flex h-8 items-end gap-0.5">
                    {b > 0 && <div style={{ background: BROAD, height: `${(b / total) * 100}%` }} className="flex-1 rounded-sm" />}
                    {t > 0 && <div style={{ background: TARGETED, height: `${(t / total) * 100}%` }} className="flex-1 rounded-sm" />}
                    {o > 0 && <div style={{ background: OTHER, height: `${(o / total) * 100}%` }} className="flex-1 rounded-sm" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Replaces the “Pts by day by FW” tab used today to see offer stacking. Excludes Draft and Cancelled. Phase 2.</p>

      <Dialog.Root open={dayOpen !== null} onOpenChange={(o) => !o && setDayOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <Dialog.Title className="font-semibold">{dayOpen && format(dayOpen, 'EEEE, MMM d, yyyy')} — {dayOffers.length} offers</Dialog.Title>
              <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
            </div>
            <ul className="max-h-[50vh] divide-y divide-border overflow-auto text-sm">
              {dayOffers.map((x) => (
                <li key={x.o._uid} className="flex items-center justify-between gap-2 py-1.5">
                  <button onClick={() => navigate(`/offers/${x.o._uid}`)} className="truncate text-left text-primary hover:underline">{String(x.o.offerName)}</button>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ background: bucket(x.o) === 'Broad' ? BROAD : bucket(x.o) === 'Targeted' ? TARGETED : OTHER }}>{bucket(x.o)}</span>
                    <StatusPill status={statusOf(x.o)} withTooltip={false} />
                  </span>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
