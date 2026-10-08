import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { TagPill } from '@/components/TagPill';
import { reference } from '@/lib/dataLoaders';
import { resolveCalendarFieldValue } from '@/lib/calculations';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { OfferRecord } from '@/lib/types';

/** A9: working Inspire submission form — one CSV per offer, never combined. */
export function SubmissionFormDialog({
  offers,
  open,
  onClose,
}: {
  offers: OfferRecord[];
  open: boolean;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<'MFP' | 'RA'>('MFP');
  const addAudit = useAppStore((s) => s.addAudit);
  const role = useAppStore((s) => s.role);
  const push = useToasts((s) => s.push);

  const def = reference.inspireSubmissionForms[template] as { rows?: unknown[][] } | undefined;
  const rows = def?.rows ?? [];
  const preview = offers[0];

  function download() {
    for (const o of offers) {
      const headers = ['PetSmart Loyalty Offer Calendar Fields', 'Kognitiv Fields', 'Offer Setup Details', 'Guide'];
      const data = rows.map((r) => {
        const calendarFieldId = (r[5] as string | null) ?? null;
        const v = resolveCalendarFieldValue(calendarFieldId, o);
        return [String(r[0] ?? ''), String(r[1] ?? ''), v.captured ? v.text : '', String(r[3] ?? '')];
      });
      const name = `${String(o.offerName ?? o.offerId ?? 'offer')}_SubmissionForm_${template}`;
      downloadCsv(name, toCsv(headers, data));
      addAudit({ offerId: String(o.offerId ?? ''), offerUid: o._uid, user: role, action: 'field changed', fieldLabel: 'Submission form', comment: `Submission form generated (${template})` });
    }
    push(`${offers.length} form${offers.length === 1 ? '' : 's'} downloaded, 1 per offer.`, 'success');
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-ink">
              Generate Inspire submission form <TagPill kind="MVP scope to confirm" />
            </Dialog.Title>
            <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
          </div>
          <div className="flex items-center gap-3 border-b border-border px-5 py-2">
            <label className="text-sm text-muted">Template:</label>
            {(['MFP', 'RA'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1 text-sm"><input type="radio" checked={template === t} onChange={() => setTemplate(t)} /> {t}</label>
            ))}
            <span className="text-xs text-muted">MFP and RA are the 2 team members’ versions of the same form (Mark Phillips, Rick Atkinson).</span>
            <span className="ml-auto text-xs text-muted">{offers.length} offer{offers.length === 1 ? '' : 's'} selected</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <p className="mb-2 text-xs text-muted">Preview for <span className="font-medium text-ink">{String(preview?.offerName ?? '')}</span> (one file is produced per offer):</p>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface text-muted"><tr><th className="px-2 py-2">Calendar field</th><th className="px-2 py-2">Kognitiv field</th><th className="px-2 py-2">Offer Setup Details</th><th className="px-2 py-2">Guide</th></tr></thead>
              <tbody>
                {preview && rows.map((r, i) => {
                  const v = resolveCalendarFieldValue((r[5] as string | null) ?? null, preview);
                  const val = v.captured ? v.text : '';
                  return (
                    <tr key={i} className="border-b border-border/40 align-top">
                      <td className="px-2 py-1.5 text-ink">{String(r[0] ?? '')}</td>
                      <td className="px-2 py-1.5 text-muted">{String(r[1] ?? '')}</td>
                      <td className={`px-2 py-1.5 ${val ? 'font-medium text-ink' : 'text-warning'}`}>{val || 'Not entered'}</td>
                      <td className="px-2 py-1.5 text-muted">{String(r[3] ?? '')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-5 py-3">
            <button onClick={download} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"><Download size={15} /> Download ({offers.length} file{offers.length === 1 ? '' : 's'})</button>
            <p className="mt-2 text-xs text-muted">Today each offer is emailed separately with its SKU list attached. Attach the SKU list when you send this form.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
