import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import type { AuditAction, OfferValue } from '@/lib/types';

const ACTION_LABEL: Record<AuditAction, string> = {
  created: 'Created',
  'field changed': 'Field changed',
  'status changed': 'Status changed',
  approved: 'Approved',
  'checklist item': 'Checklist item',
  cancelled: 'Cancelled',
  'copied from': 'Copied',
  imported: 'Imported',
  'reference edited': 'Reference edited',
};

function valueText(v: OfferValue | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function HistoryDrawer({
  offerUid,
  offerName,
  open,
  onOpenChange,
}: {
  offerUid: string | null;
  offerName?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const auditLog = useAppStore((s) => s.auditLog);
  const [filter, setFilter] = useState<'all' | AuditAction>('all');

  const entries = useMemo(() => {
    const list = auditLog.filter((e) => e.offerUid === offerUid);
    return filter === 'all' ? list : list.filter((e) => e.action === filter);
  }, [auditLog, offerUid, filter]);

  const actionTypes = useMemo(() => {
    const set = new Set<AuditAction>();
    auditLog.filter((e) => e.offerUid === offerUid).forEach((e) => set.add(e.action));
    return [...set];
  }, [auditLog, offerUid]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-md flex-col border-l border-border bg-white shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">History</Dialog.Title>
              {offerName && <p className="text-xs text-muted">{offerName}</p>}
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex items-center gap-2 border-b border-border px-5 py-2">
            <label className="text-xs text-muted">Filter:</label>
            <select
              className="rounded-md border border-border px-2 py-1 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | AuditAction)}
            >
              <option value="all">All actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </select>
          </div>

          <ol className="flex-1 space-y-0 overflow-y-auto">
            {entries.length === 0 && (
              <li className="px-5 py-6 text-muted">No history entries.</li>
            )}
            {entries.map((e) => (
              <li key={e.id} className="border-b border-border px-5 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-ink">
                    {ACTION_LABEL[e.action]}
                  </span>
                  <span className="text-xs text-muted">
                    {format(new Date(e.timestamp), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">by {e.user}</p>
                {e.fieldLabel && (
                  <p className="mt-1 text-ink">
                    <span className="font-medium">{e.fieldLabel}:</span>{' '}
                    <span className="text-muted line-through">{valueText(e.oldValue)}</span>{' '}
                    → <span>{valueText(e.newValue)}</span>
                  </p>
                )}
                {e.comment && <p className="mt-1 italic text-ink">“{e.comment}”</p>}
              </li>
            ))}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
