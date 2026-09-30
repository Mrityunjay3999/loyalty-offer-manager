import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Database, PlayCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { metadataFields, fieldsById } from '@/lib/dataLoaders';
import {
  computeForecast,
  computeResults,
  computedFieldValue,
  fiscalMonth,
  fiscalYear,
  includeForMetadata,
} from '@/lib/calculations';
import { isNoValue } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { OfferRecord } from '@/lib/types';

function fmt(v: unknown): string {
  if (isNoValue(v)) return v === 'N/A' ? 'N/A' : 'Not entered';
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(v);
}

function buildCalcMap(o: OfferRecord): Record<string, unknown> {
  const f = computeForecast(o);
  const r = computeResults(o);
  return {
    ...f,
    fiscalMonth: fiscalMonth(o),
    fiscalYear: fiscalYear(o),
    bonusRate: r.bonusRate,
    activationRate: r.activationRate,
    bonusedSalesActual: r.bonusedSalesActual,
    basePointsActual: r.basePointsActual,
    basePointsRedeemableActual: r.basePointsRedeemableActual,
    bonusPointsRedeemableActual: r.bonusPointsRedeemableActual,
    bonusRedeemableActualWithBreakage: r.bonusRedeemableActualWithBreakage,
    spendPerBonusedMember: r.spendPerBonusedMember,
    ltbpOutstanding: r.ltbpOutstanding,
    ltbpRemoved: r.ltbpRemoved,
  };
}

function metadataValue(
  calendarFieldId: string | null,
  o: OfferRecord,
  calcMap: Record<string, unknown>,
): { text: string; captured: boolean } {
  if (!calendarFieldId) return { text: 'Not captured in the calendar form', captured: false };
  if (calendarFieldId.startsWith('calc.')) {
    return { text: fmt(calcMap[calendarFieldId.slice(5)]), captured: true };
  }
  const f = fieldsById[calendarFieldId];
  if (f && f.control === 'computed') return { text: fmt(computedFieldValue(calendarFieldId, o)), captured: true };
  return { text: fmt(o[calendarFieldId]), captured: true };
}

export function DataFeedPreview() {
  const offers = useAppStore((s) => s.offers);
  const role = useAppStore((s) => s.role);
  const feedLog = useAppStore((s) => s.feedLog);
  const addFeedLog = useAppStore((s) => s.addFeedLog);
  const push = useToasts((s) => s.push);
  const canRun = can(role, 'runSimulations');

  const [uid, setUid] = useState(offers[0]?._uid ?? '');
  const offer = offers.find((o) => o._uid === uid) ?? offers[0];
  const calcMap = useMemo(() => (offer ? buildCalcMap(offer) : {}), [offer]);

  const includeCount = offers.filter((o) => includeForMetadata(o) === 'Yes').length;
  const excluded = offer ? includeForMetadata(offer) === 'No' : false;

  function simulateDaily() {
    addFeedLog({ records: includeCount, status: 'Success', message: `Loaded ${includeCount} records to the loyalty table.` });
    push(`Daily load simulated: ${includeCount} records.`, 'success');
  }
  function simulateFailed() {
    addFeedLog({ records: 0, status: 'Failed', message: 'Load failed: existing table data unchanged. No blank rows written.' });
    push('Failed load simulated — existing data is unchanged.', 'warning');
  }

  return (
    <div>
      <PageHeader title="Data feed (Databricks)" />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">Offer:</label>
        <select className="min-w-[280px] rounded-md border border-border px-2 py-1.5 text-sm" value={uid} onChange={(e) => setUid(e.target.value)}>
          {offers.map((o) => (
            <option key={o._uid} value={o._uid}>
              {String(o.offerName ?? o.offerId ?? o._uid)} — {String(o.buildStatus)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted">
        <AlertTriangle size={15} className="text-warning" /> Cancelled offers are excluded from the metadata feed.
        {excluded && <span className="ml-1 font-medium text-danger">This offer is Cancelled — Include for Metadata = No.</span>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* Panel A */}
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><Database size={16} className="text-primary" /> Loyalty metadata record <span className="text-sm font-normal text-muted">({metadataFields.length} columns)</span></h2>
          <div className="max-h-[62vh] overflow-auto rounded-lg border border-border bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-border bg-surface text-muted">
                <tr>
                  <th className="px-2 py-2 font-medium">Source column</th>
                  <th className="px-2 py-2 font-medium">Datalake column</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Include</th>
                  <th className="px-2 py-2 font-medium">Datatype</th>
                  <th className="px-2 py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {metadataFields.map((m, i) => {
                  const v = offer ? metadataValue(m.calendarFieldId, offer, calcMap) : { text: '', captured: false };
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-2 py-1 text-ink">{m.sourceColumn}</td>
                      <td className="px-2 py-1 text-muted">{m.datalakeColumn}</td>
                      <td className="px-2 py-1 text-muted">{m.type ?? '—'}</td>
                      <td className="px-2 py-1 text-muted">{m.includeInDatalake}</td>
                      <td className="px-2 py-1 text-muted">{m.datatype}</td>
                      <td className={`px-2 py-1 ${v.captured ? 'text-ink' : 'italic text-muted'}`}>{v.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel B */}
        <div>
          <h2 className="mb-2 font-semibold">Load log</h2>
          {canRun ? (
            <div className="mb-3 flex flex-col gap-2">
              <button onClick={simulateDaily} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
                <PlayCircle size={15} /> Simulate daily load
              </button>
              <button onClick={simulateFailed} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/5">
                <XCircle size={15} /> Simulate failed load
              </button>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted">Only Admin can run load simulations.</p>
          )}
          <div className="rounded-lg border border-border bg-white">
            {feedLog.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">No loads simulated yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {feedLog.map((e) => (
                  <li key={e.id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 font-medium ${e.status === 'Success' ? 'text-success' : 'text-danger'}`}>
                        {e.status === 'Success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {e.status}
                      </span>
                      <span className="text-xs text-muted">{format(new Date(e.timestamp), 'MMM d, HH:mm:ss')}</span>
                    </div>
                    <div className="text-xs text-muted">{e.records} records · {e.message}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            In the product this is a direct write to the existing loyalty table in Databricks. This
            page simulates it.
          </p>
        </div>
      </div>
    </div>
  );
}
