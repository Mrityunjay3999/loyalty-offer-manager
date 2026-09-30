import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { can } from '@/lib/permissions';
import type { OfferValue } from '@/lib/types';

const COLS: Array<[string, string]> = [
  ['Promotion Name', 'Promotion Name'],
  ['Status', 'Status'],
  ['Promotion Description', 'Description'],
  ['Member Descriptor', 'Member Descriptor'],
  ['Activation Descriptor (External Refernce ID)', 'Activation Descriptor'],
  ['Start Date', 'Start'],
  ['End Date', 'End'],
  ['ACTIVATION', 'Activation'],
  ['DISCLAIMER', 'Disclaimer'],
];

export function EvergreenOffers() {
  const rows = useAppStore((s) => s.evergreenOffers);
  const editReference = useAppStore((s) => s.editReference);
  const role = useAppStore((s) => s.role);
  const push = useToasts((s) => s.push);
  const canEdit = can(role, 'createEditCopy') || can(role, 'editReference');
  const [draft, setDraft] = useState<Array<Record<string, OfferValue>>>(() =>
    rows.map((r) => ({ ...r })),
  );

  const input =
    'w-full rounded border border-border px-2 py-1 text-xs focus:border-primary focus:outline-none disabled:bg-surface';

  return (
    <div>
      <PageHeader title="Evergreen offers" count={draft.length} />
      <div className="mb-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-muted">
        Always-on offers tracked separately today.
      </div>

      {canEdit && (
        <div className="mb-2 flex gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface"
            onClick={() => setDraft((d) => [...d, Object.fromEntries(COLS.map(([k]) => [k, ''])) as Record<string, OfferValue>])}
          >
            <Plus size={14} /> Add offer
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
            onClick={() => { editReference({ evergreenOffers: draft }, 'Edited evergreen offers'); push('Evergreen offers saved.', 'success'); }}
          >
            <Save size={14} /> Save changes
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead className="border-b border-border bg-surface text-muted">
            <tr>{COLS.map(([, l]) => <th key={l} className="px-2 py-2 font-medium">{l}</th>)}{canEdit && <th />}</tr>
          </thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {COLS.map(([k]) => (
                  <td key={k} className="px-2 py-1">
                    <input
                      className={input}
                      style={{ minWidth: k.includes('Description') || k === 'DISCLAIMER' ? 200 : 110 }}
                      disabled={!canEdit}
                      value={String(r[k] ?? '')}
                      onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                    />
                  </td>
                ))}
                {canEdit && (
                  <td className="px-2 py-1 text-right">
                    <button className="text-muted hover:text-danger" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Status options today: “Active”, “Ends &lt;date&gt;” or “Decommissioned”.</p>
    </div>
  );
}
