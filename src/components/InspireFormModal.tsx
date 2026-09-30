import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { reference } from '@/lib/dataLoaders';
import { resolveCalendarFieldValue } from '@/lib/calculations';
import { PhaseBadge } from '@/components/PhaseBadge';
import type { OfferRecord } from '@/lib/types';

/**
 * Phase 2 preview of the Inspire submission form (MFP or RA), populated from the
 * offer via each row's calendarFieldId. Read-only; no download.
 * Row shape: [calendarField, kognitivField, exampleValue, guide, example, calendarFieldId]
 */
export function InspireFormModal({
  offer,
  form,
  onClose,
}: {
  offer: OfferRecord | null;
  form: 'MFP' | 'RA' | null;
  onClose: () => void;
}) {
  const open = offer !== null && form !== null;
  const def = form ? reference.inspireSubmissionForms[form] : null;
  const rows = (def as { rows?: unknown[][] } | null)?.rows ?? [];
  const title = (def as { title?: string } | null)?.title ?? '';

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white shadow-lg">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-ink">
                Inspire submission form — {form} <PhaseBadge note="Phase 2 preview. No download." />
              </Dialog.Title>
              <p className="mt-1 whitespace-pre-line text-xs text-muted">{title}</p>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-auto p-4">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface text-muted">
                <tr>
                  <th className="px-2 py-2 font-medium">Calendar field</th>
                  <th className="px-2 py-2 font-medium">Kognitiv field</th>
                  <th className="px-2 py-2 font-medium">Value from this offer</th>
                  <th className="px-2 py-2 font-medium">Guide</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const calendarField = String(r[0] ?? '');
                  const kognitivField = String(r[1] ?? '');
                  const guide = String(r[3] ?? '');
                  const calendarFieldId = (r[5] as string | null) ?? null;
                  const v = offer ? resolveCalendarFieldValue(calendarFieldId, offer) : { text: '', captured: false };
                  return (
                    <tr key={i} className="border-b border-border last:border-0 align-top">
                      <td className="px-2 py-1.5 text-ink">{calendarField}</td>
                      <td className="px-2 py-1.5 text-muted">{kognitivField}</td>
                      <td className={`px-2 py-1.5 ${v.captured ? 'font-medium text-ink' : 'italic text-muted'}`}>{v.text}</td>
                      <td className="px-2 py-1.5 text-muted">{guide}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
