import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { fields, STEP_ORDER } from '@/lib/dataLoaders';
import { computedFieldValue } from '@/lib/calculations';
import { isNoValue, formatDate, formatCurrency, formatPercent } from '@/lib/format';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { OfferRecord, FieldDef } from '@/lib/types';

function display(f: FieldDef, o: OfferRecord): string {
  if (f.control === 'computed') { const v = computedFieldValue(f.id, o); return v == null ? '' : String(v); }
  const v = o[f.id];
  if (isNoValue(v)) return v === 'N/A' ? 'N/A' : '';
  if (f.control === 'date' || f.control === 'dateOrNA') return formatDate(v);
  if (f.control === 'currency') return formatCurrency(v);
  if (f.control === 'percent') return formatPercent(v, 1);
  return String(v);
}

/** A9: choose any fields, reorder, export CSV. Remembers the last selection per role. */
export function ColumnPickerExportDialog({
  offers,
  open,
  onClose,
}: {
  offers: OfferRecord[];
  open: boolean;
  onClose: () => void;
}) {
  const userId = useAppStore((s) => s.currentUserId);
  const push = useToasts((s) => s.push);
  const storageKey = `lom-colpick-${userId}`;
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>(() => {
    try { const raw = localStorage.getItem(storageKey); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return ['offerId', 'offerName', 'buildStatus', 'startDate', 'endDate'];
  });

  const grouped = useMemo(() => {
    const m = new Map<string, FieldDef[]>();
    for (const f of fields) { if (f.control === 'hidden') continue; const g = f.step; if (!m.has(g)) m.set(g, []); m.get(g)!.push(f); }
    return m;
  }, []);

  function toggle(id: string, on: boolean) { setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id))); }
  function move(id: string, dir: -1 | 1) {
    setSelected((s) => { const i = s.indexOf(id); const j = i + dir; if (j < 0 || j >= s.length) return s; const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }

  function doExport() {
    try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* ignore */ }
    const cols = selected.map((id) => fields.find((f) => f.id === id)!).filter(Boolean);
    const headers = cols.map((f) => f.label);
    const data = offers.map((o) => cols.map((f) => display(f, o)));
    downloadCsv('offers-export', toCsv(headers, data));
    push(`Exported ${offers.length} offers × ${cols.length} columns.`, 'success');
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="text-base font-semibold text-ink">Export selected columns</Dialog.Title>
            <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-0 overflow-hidden">
            <div className="flex flex-col overflow-hidden border-r border-border">
              <div className="flex items-center gap-1 border-b border-border px-3 py-2"><Search size={14} className="text-muted" /><input className="w-full text-sm focus:outline-none" placeholder="Search fields" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div className="flex-1 overflow-auto p-2">
                {[...grouped.entries()].map(([step, fs]) => {
                  const shown = fs.filter((f) => !q || f.label.toLowerCase().includes(q.toLowerCase()));
                  if (!shown.length) return null;
                  return (
                    <div key={step} className="mb-2">
                      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{STEP_ORDER.includes(step) ? step : step}</div>
                      {shown.map((f) => (
                        <label key={f.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-xs hover:bg-surface">
                          <input type="checkbox" checked={selected.includes(f.id)} onChange={(e) => toggle(f.id, e.target.checked)} /> {f.label}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted">Selected ({selected.length}) — order of CSV columns</div>
              <div className="flex-1 overflow-auto p-2">
                {selected.map((id) => { const f = fields.find((x) => x.id === id); return (
                  <div key={id} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-surface">
                    <span className="truncate">{f?.label ?? id}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button onClick={() => move(id, -1)} className="text-muted hover:text-ink"><ChevronUp size={13} /></button>
                      <button onClick={() => move(id, 1)} className="text-muted hover:text-ink"><ChevronDown size={13} /></button>
                      <button onClick={() => toggle(id, false)} className="text-muted hover:text-danger"><X size={12} /></button>
                    </span>
                  </div>
                ); })}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-xs text-muted">{offers.length} offers will be exported.</span>
            <button onClick={doExport} disabled={selected.length === 0} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40"><Download size={15} /> Export CSV</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
