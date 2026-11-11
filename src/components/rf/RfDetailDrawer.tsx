import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useNavigate } from 'react-router-dom';
import { X, Sigma, Pencil, Check, CircleAlert, ExternalLink } from 'lucide-react';
import { useAppStore, isChangedSinceImport } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { importMetaOf } from '@/store/importedBase';
import { StatusPill } from '@/components/StatusPill';
import { FieldRenderer } from '@/components/fields/FieldRenderer';
import { fieldsByStep } from '@/lib/dataLoaders';
import { statusOf } from '@/lib/lifecycle';
import { computeRfCells, RF_COLUMNS, type RfCells } from '@/lib/rfEngine';
import { compareCell, formatXVal, displayXVal } from '@/lib/excelFormat';
import { RF_BY_LETTER } from '@/lib/forecastColumnRegistry';
import { optionsForField } from '@/lib/options';
import { useImportReport, useRfSnapshot, snapshotIndex } from '@/lib/importData';
import { COLOUR_CHIP } from './rfColumns';
import type { OfferRecord, OfferValue } from '@/lib/types';

const RF_SET = new Set<string>(RF_COLUMNS);

/** Replace cell references in an Excel formula with this offer's displayed values. */
export function fillFormula(excel: string, cells: RfCells): string {
  return excel
    .split(/("[^"]*")/)
    .map((part) =>
      part.startsWith('"')
        ? part
        : part.replace(/\b([A-Z]{1,2})\b(?!\()/g, (m) => {
            if (!RF_SET.has(m) || !RF_BY_LETTER[m]) return m;
            const t = formatXVal(cells[m as keyof RfCells], RF_BY_LETTER[m].format);
            return t === '' ? '""' : t;
          }),
    )
    .join('');
}

const FORECAST_ROWS: Array<[string, string, string, string]> = [
  ['Activation', 'AF', 'AG', 'AL'],
  ['Bonus rate', 'AH', 'AI', 'AM'],
  ['Bonused members', 'AN', 'AO', 'AP'],
  ['Avg spend / txn', 'AJ', 'AK', 'AQ'],
  ['Bonused sales', 'AR', 'AS', 'AT'],
  ['Base points', 'AU', 'AV', 'AW'],
  ['Bonus points', 'AX', 'AY', 'AZ'],
  ['Base pts redeemable $', 'BA', 'BB', ''],
  ['Bonus pts redeemable $', 'BC', 'BD', 'BE'],
  ['With breakage', 'BG', 'BH', 'BI'],
  ['JBP base + bonus $', 'BJ', 'BK', 'BL'],
];
const ACTUAL_LETTERS = ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE'];
const WBR_LETTERS = ['BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY'];

export function RfDetailDrawer({
  offer,
  asOf,
  canForecast,
  canResults,
  onClose,
}: {
  offer: OfferRecord | undefined;
  asOf: Date;
  canForecast: boolean;
  canResults: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const offerDiffs = useAppStore((s) => s.offerDiffs);
  const [panel, setPanel] = useState<null | 'forecast' | 'results'>(null);
  const report = useImportReport();
  const snap = useRfSnapshot();
  const snapIdx = useMemo(() => snapshotIndex(snap), [snap]);

  const open = !!offer;
  const cells = offer ? computeRfCells(offer, asOf) : null;
  const meta = importMetaOf(offer?._uid);
  const changed = isChangedSinceImport(offer?._uid, offerDiffs);
  const excelRow = offer && typeof offer.offerId === 'number' && meta?.inExcelRfTab && !changed ? snapIdx.get(offer.offerId) : undefined;
  const locked = offer ? ['Completed - Data Final', 'Cancelled'].includes(statusOf(offer)) : false;
  const issues = (report?.issues ?? []).filter(
    (i) => i.severity === 'issue' && offer && (i.offerId === offer.offerId || i.offerIds?.includes(offer.offerId as number)),
  );

  const Val = ({ L }: { L: string }) => {
    if (!cells || !L) return <span className="text-muted">—</span>;
    const e = RF_BY_LETTER[L];
    const v = cells[L as keyof RfCells];
    const shown = displayXVal(v, e.format);
    const ex = excelRow?.byLetter[L];
    const cmp = ex !== undefined ? compareCell(ex, v, e.format) : null;
    return (
      <span className="flex flex-col items-end">
        <span className="flex items-center gap-1">
          {L === 'BZ' && shown ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${COLOUR_CHIP[shown] ?? ''}`}>{shown}</span> : <span className="font-medium text-ink">{shown || '—'}</span>}
          {e.excel && (
            <Tooltip.Provider delayDuration={100}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild><button className="text-primary" aria-label={`How ${L} is calculated`}><Sigma size={11} /></button></Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="left" className="z-50 max-w-[420px] space-y-1 rounded border border-border bg-white p-2 text-[11px] text-ink shadow-md">
                    <div className="font-semibold">{L}: {e.header}</div>
                    {e.words && <div className="text-muted">{e.words}</div>}
                    <div className="break-all font-mono text-[10px]">{e.excel}</div>
                    <div className="break-all font-mono text-[10px] text-primary">{fillFormula(e.excel, cells)} → {shown || '""'}</div>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </span>
        {cmp && (
          <span className={`flex items-center gap-0.5 text-[10px] ${cmp.match ? 'text-success' : 'text-warning'}`}>
            {cmp.match ? <Check size={10} /> : <CircleAlert size={10} />} Excel: {!ex ? '(blank)' : ex.trim()}
          </span>
        )}
      </span>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && (onClose(), setPanel(null))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[94vw] max-w-4xl flex-col border-l border-border bg-white shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
            <Dialog.Title className="flex min-w-0 items-center gap-2 text-base font-semibold text-ink">
              <span className="truncate">{String(offer?.offerName ?? '')}</span>
              {offer && <StatusPill status={statusOf(offer)} />}
              <span className="text-xs font-normal text-muted">Offer ID {String(offer?.offerId ?? '')}</span>
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => { onClose(); navigate(`/offers/${offer?._uid}?step=7. Forecast`); }} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"><ExternalLink size={12} /> Open offer (Step 7)</button>
              <button onClick={() => { onClose(); navigate(`/offers/${offer?._uid}?step=9. Results`); }} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"><ExternalLink size={12} /> Step 9</button>
              <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
            </div>
          </div>
          {offer && cells && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                As of {asOf.toLocaleDateString('en-US')}.
                {meta ? (excelRow ? ' Each number shows the Excel value from the 11/11/2026 export.' : changed ? ' Changed since import: not compared with Excel.' : ' Not in the Excel R&F tab, so there is no Excel value to compare.') : ' Created in the prototype.'}
              </div>
              {(canForecast || canResults) && (
                <div className="mb-4 flex gap-2">
                  {canForecast && <button disabled={locked} title={locked ? 'This offer is locked.' : ''} onClick={() => setPanel('forecast')} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"><Pencil size={14} /> Enter forecast</button>}
                  {canResults && <button disabled={locked} title={locked ? 'This offer is locked.' : ''} onClick={() => setPanel('results')} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"><Pencil size={14} /> Enter results</button>}
                </div>
              )}
              {panel && <InlineEditor offer={offer} kind={panel} onClose={() => setPanel(null)} />}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-blue-50 p-3">
                  <h4 className="mb-2 font-semibold text-ink">Forecast</h4>
                  <table className="w-full text-xs">
                    <thead className="text-muted"><tr><th className="text-left font-medium" /><th className="text-right font-medium">Low</th><th className="text-right font-medium">High</th><th className="text-right font-medium">Average</th></tr></thead>
                    <tbody>
                      {FORECAST_ROWS.map(([label, lo, hi, av]) => (
                        <tr key={label} className="border-t border-border/40 align-top">
                          <td className="py-1 text-muted">{label}</td>
                          <td className="py-1 text-right"><Val L={lo} /></td>
                          <td className="py-1 text-right"><Val L={hi} /></td>
                          <td className="py-1 text-right">{av ? <Val L={av} /> : ''}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border/40"><td className="py-1 text-muted">Redemption rate</td><td colSpan={3} className="py-1 text-right"><Val L="BF" /></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-border bg-green-50 p-3">
                  <h4 className="mb-2 font-semibold text-ink">Actuals</h4>
                  <dl className="text-xs">
                    {ACTUAL_LETTERS.map((L) => (
                      <div key={L} className="flex items-start justify-between gap-2 border-t border-border/40 py-1">
                        <dt className="text-muted"><span className="mr-1 text-[10px] text-muted/70">{L}</span>{RF_BY_LETTER[L].header}</dt>
                        <dd className="text-right"><Val L={L} /></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-amber-50 p-3">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-ink">WBR <Val L="BZ" /></h4>
                <dl className="grid grid-cols-1 gap-x-6 text-xs md:grid-cols-2">
                  {WBR_LETTERS.map((L) => (
                    <div key={L} className="flex items-start justify-between gap-2 border-t border-border/40 py-1">
                      <dt className="text-muted"><span className="mr-1 text-[10px] text-muted/70">{L}</span>{RF_BY_LETTER[L].header}</dt>
                      <dd className="text-right"><Val L={L} /></dd>
                    </div>
                  ))}
                </dl>
              </div>
              {issues.length > 0 && (
                <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
                  <h4 className="mb-1 font-semibold text-ink">Data issues from the import</h4>
                  <ul className="list-disc space-y-1 pl-4">
                    {issues.map((i) => <li key={i.id}>{i.message} <span className="text-muted">({i.file}, row {i.row ?? 'n/a'}, column {i.column})</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InlineEditor({ offer, kind, onClose }: { offer: OfferRecord; kind: 'forecast' | 'results'; onClose: () => void }) {
  const updateOffer = useAppStore((s) => s.updateOffer);
  const addAudit = useAppStore((s) => s.addAudit);
  const role = useAppStore((s) => s.role);
  const dropdowns = useAppStore((s) => s.dropdowns);
  const categorySubCategory = useAppStore((s) => s.categorySubCategory);
  const push = useToasts((s) => s.push);
  const [work, setWork] = useState<OfferRecord>(offer);

  const stepFields = (fieldsByStep[kind === 'forecast' ? '7. Forecast' : '9. Results'] ?? []).filter(
    (f) => f.control !== 'computed' && f.control !== 'hidden' && f.phase !== 'Phase 2' && !f.readOnlyInForm,
  );

  function saveIt() {
    for (const f of stepFields) {
      if (String(offer[f.id] ?? '') !== String(work[f.id] ?? '')) {
        addAudit({ offerId: String(offer.offerId ?? ''), offerUid: offer._uid, user: role, action: 'field changed', fieldLabel: f.label, oldValue: (offer[f.id] as OfferValue) ?? null, newValue: (work[f.id] as OfferValue) ?? null });
      }
    }
    updateOffer(offer._uid!, work);
    push(`${kind === 'forecast' ? 'Forecast' : 'Results'} saved.`, 'success');
    onClose();
  }

  return (
    <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-semibold">{kind === 'forecast' ? 'Enter forecast (Step 7)' : 'Enter results (Step 9)'}</h4>
        <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close editor"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stepFields.map((f) => (
          <FieldRenderer key={f.id} field={f} value={work[f.id]} onChange={(v) => setWork((w) => ({ ...w, [f.id]: v }))}
            options={optionsForField(f.id, f.optionsKey, dropdowns, categorySubCategory, work.category)} />
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">Cancel</button>
        <button onClick={saveIt} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">Save</button>
      </div>
    </div>
  );
}
