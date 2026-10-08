import * as Dialog from '@radix-ui/react-dialog';
import { X, CalendarDays, PencilLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusPill } from '@/components/StatusPill';
import { fieldsByStep, STEP_ORDER } from '@/lib/dataLoaders';
import { statusOf } from '@/lib/lifecycle';
import { isFieldVisible } from '@/lib/visibility';
import { displayField } from '@/lib/displayField';
import { useAppStore } from '@/store/useAppStore';
import { can } from '@/lib/permissions';
import type { OfferRecord } from '@/lib/types';

/**
 * The read-only offer detail panel shared by Offer View and the Calendar. Shows
 * every visible field grouped by step. Optional quick links to the calendar and
 * (for users who can open the edit area) the edit workspace.
 */
export function OfferDetailDrawer({
  offer,
  open,
  onClose,
  showCalendarLink = true,
}: {
  offer: OfferRecord | null | undefined;
  open: boolean;
  onClose: () => void;
  showCalendarLink?: boolean;
}) {
  const navigate = useNavigate();
  const role = useAppStore((s) => s.role);
  const canEdit = can(role, 'openEditArea');

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-2xl flex-col border-l border-border bg-white shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
            <Dialog.Title className="flex min-w-0 items-center gap-2 text-base font-semibold text-ink">
              <span className="truncate">{String(offer?.offerName ?? offer?.offerId ?? '')}</span>
              {offer && <StatusPill status={statusOf(offer)} />}
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-1.5">
              {offer && showCalendarLink && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/calendar?offer=${offer._uid ?? ''}`);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                >
                  <CalendarDays size={13} /> View on calendar
                </button>
              )}
              {offer && canEdit && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/offers/${offer._uid ?? ''}`);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                >
                  <PencilLine size={13} /> Open in edit area
                </button>
              )}
              <Dialog.Close asChild>
                <button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button>
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {offer && STEP_ORDER.map((step) => {
              const stepFields = (fieldsByStep[step] ?? []).filter(
                (f) => f.control !== 'hidden' && isFieldVisible(f.id, offer),
              );
              if (stepFields.length === 0) return null;
              return (
                <div key={step} className="mb-5">
                  <h3 className="mb-2 font-semibold text-ink">{step}</h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border p-3 text-sm">
                    {stepFields.map((f) => (
                      <div key={f.id} className="flex justify-between gap-3 border-b border-border/50 py-1">
                        <dt className="text-muted">{f.label}</dt>
                        <dd className="text-right text-ink">{displayField(f, offer) || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
