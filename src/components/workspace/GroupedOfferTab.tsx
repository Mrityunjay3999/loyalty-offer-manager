import { useMemo } from 'react';
import { Plus, CalendarRange, Trash2, AlertCircle } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { parseISO, formatPercent, toNumber } from '@/lib/format';
import type { OfferRecord, ChildPromotion } from '@/lib/types';

let childSeq = 0;
function newChildId() {
  childSeq += 1;
  return `child-${Date.now()}-${childSeq}`;
}

function blankChild(parent: OfferRecord): ChildPromotion {
  return {
    id: newChildId(),
    offerName: '',
    startDate: '',
    endDate: '',
    numberOfDays: '',
    transactionExternalRefId: '',
    activationDescriptor: String(parent.activationDescriptor ?? ''),
    activations: '',
    bonusedMembers: '',
    bonusPtsIssued: '',
  };
}

function bonusRate(activations: unknown, bonusedMembers: unknown): number | null {
  const a = toNumber(activations);
  const b = toNumber(bonusedMembers);
  if (a === null || b === null || a === 0) return null;
  return b / a;
}

export function GroupedOfferTab({
  offer,
  readOnly,
}: {
  offer: OfferRecord;
  readOnly: boolean;
}) {
  const uid = offer._uid!;
  const all = useAppStore((s) => s.groupedChildren);
  const setChildren = useAppStore((s) => s.setGroupedChildren);
  const push = useToasts((s) => s.push);
  const children = all[uid] ?? [];

  const dupIds = useMemo(() => {
    const seen = new Map<string, number>();
    children.forEach((c) => {
      const k = c.transactionExternalRefId.trim().toLowerCase();
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    return new Set(
      children
        .filter((c) => {
          const k = c.transactionExternalRefId.trim().toLowerCase();
          return k && (seen.get(k) ?? 0) > 1;
        })
        .map((c) => c.id),
    );
  }, [children]);

  const totals = useMemo(() => {
    let a = 0,
      b = 0,
      p = 0;
    children.forEach((c) => {
      a += toNumber(c.activations) ?? 0;
      b += toNumber(c.bonusedMembers) ?? 0;
      p += toNumber(c.bonusPtsIssued) ?? 0;
    });
    return { activations: a, bonusedMembers: b, bonusPtsIssued: p, rate: a ? b / a : null };
  }, [children]);

  function update(id: string, patch: Partial<ChildPromotion>) {
    setChildren(
      uid,
      children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }
  function addChild() {
    setChildren(uid, [...children, blankChild(offer)]);
  }
  function removeChild(id: string) {
    setChildren(
      uid,
      children.filter((c) => c.id !== id),
    );
  }
  function generateDaily() {
    const s = parseISO(offer.startDate);
    const e = parseISO(offer.endDate);
    if (!s || !e || e < s) {
      push('Set valid Start and End dates on the offer first.', 'warning');
      return;
    }
    const days = eachDayOfInterval({ start: s, end: e });
    const rows: ChildPromotion[] = days.map((d) => ({
      id: newChildId(),
      offerName: `${offer.offerName ?? 'Offer'} - ${format(d, 'M/d')}`,
      startDate: format(d, 'yyyy-MM-dd'),
      endDate: format(d, 'yyyy-MM-dd'),
      numberOfDays: 1,
      transactionExternalRefId: '',
      activationDescriptor: String(offer.activationDescriptor ?? ''),
      activations: '',
      bonusedMembers: '',
      bonusPtsIssued: '',
    }));
    setChildren(uid, rows);
    push(`Generated ${rows.length} daily child promotions.`, 'success');
  }

  const cellCls = 'w-full rounded border border-border px-1.5 py-1 text-xs focus:border-primary focus:outline-none disabled:bg-surface';

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Child promotions</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            One member-facing offer run as several promotions, often one per day. Members activate
            once; each child has its own Transaction External Ref ID and results.
          </p>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 gap-2">
            <button onClick={addChild} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface">
              <Plus size={14} /> Add child
            </button>
            <button onClick={generateDaily} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface">
              <CalendarRange size={14} /> Generate daily children
            </button>
          </div>
        )}
      </div>

      {dupIds.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-1.5 text-sm text-danger">
          <AlertCircle size={15} /> Child IDs must be unique.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead className="border-b border-border bg-surface text-muted">
            <tr>
              <th className="px-2 py-2 font-medium">Offer Name (child)</th>
              <th className="px-2 py-2 font-medium">Start</th>
              <th className="px-2 py-2 font-medium">End</th>
              <th className="px-2 py-2 font-medium"># Days</th>
              <th className="px-2 py-2 font-medium">Txn External Ref ID</th>
              <th className="px-2 py-2 font-medium">Activation Descriptor</th>
              <th className="px-2 py-2 text-right font-medium">Activations</th>
              <th className="px-2 py-2 text-right font-medium">Bonused Members</th>
              <th className="px-2 py-2 text-right font-medium">Bonus Pts Issued</th>
              <th className="px-2 py-2 text-right font-medium">Bonus Rate</th>
              {!readOnly && <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {children.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 10 : 11} className="px-3 py-6 text-center text-muted">
                  No child promotions yet. Add one or generate daily children.
                </td>
              </tr>
            )}
            {children.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-2 py-1">
                  <input className={cellCls} style={{ minWidth: 160 }} disabled={readOnly} value={c.offerName} onChange={(e) => update(c.id, { offerName: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <input type="date" className={cellCls} disabled={readOnly} value={c.startDate} onChange={(e) => update(c.id, { startDate: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <input type="date" className={cellCls} disabled={readOnly} value={c.endDate} onChange={(e) => update(c.id, { endDate: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className={`${cellCls} text-right`} style={{ width: 60 }} disabled={readOnly} value={c.numberOfDays} onChange={(e) => update(c.id, { numberOfDays: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={`${cellCls} ${dupIds.has(c.id) ? 'border-danger' : ''}`}
                    style={{ minWidth: 140 }}
                    disabled={readOnly}
                    value={c.transactionExternalRefId}
                    onChange={(e) => update(c.id, { transactionExternalRefId: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1 text-muted" style={{ minWidth: 130 }} title="Defaults to the parent's Activation Descriptor">
                  {c.activationDescriptor || '—'}
                </td>
                <td className="px-2 py-1">
                  <input type="number" className={`${cellCls} text-right`} style={{ width: 90 }} disabled={readOnly} value={c.activations} onChange={(e) => update(c.id, { activations: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className={`${cellCls} text-right`} style={{ width: 90 }} disabled={readOnly} value={c.bonusedMembers} onChange={(e) => update(c.id, { bonusedMembers: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className={`${cellCls} text-right`} style={{ width: 100 }} disabled={readOnly} value={c.bonusPtsIssued} onChange={(e) => update(c.id, { bonusPtsIssued: e.target.value })} />
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {(() => {
                    const r = bonusRate(c.activations, c.bonusedMembers);
                    return r === null ? '—' : formatPercent(r, 1);
                  })()}
                </td>
                {!readOnly && (
                  <td className="px-2 py-1 text-right">
                    <button aria-label="Remove child" onClick={() => removeChild(c.id)} className="text-muted hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {children.length > 0 && (
            <tfoot className="border-t border-border bg-surface font-medium tabular-nums">
              <tr>
                <td className="px-2 py-2" colSpan={6}>
                  Totals ({children.length} children)
                </td>
                <td className="px-2 py-2 text-right">{totals.activations.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{totals.bonusedMembers.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{totals.bonusPtsIssued.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">
                  {totals.rate === null ? '—' : formatPercent(totals.rate, 1)}
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
