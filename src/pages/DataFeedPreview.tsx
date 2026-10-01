import { useState } from 'react';
import { format } from 'date-fns';
import { Database, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Table2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { metadataFields } from '@/lib/dataLoaders';
import { includeForMetadata, resolveCalendarFieldValue } from '@/lib/calculations';
import { can } from '@/lib/permissions';

// Databricks-style palette — scoped to this page only (does not touch the app theme).
const DBX = {
  red: '#FF3621',
  navy: '#1B3139',
  navy2: '#11272E',
  ink: '#0E1A1F',
};

export function DataFeedPreview() {
  const offers = useAppStore((s) => s.offers);
  const role = useAppStore((s) => s.role);
  const feedLog = useAppStore((s) => s.feedLog);
  const addFeedLog = useAppStore((s) => s.addFeedLog);
  const push = useToasts((s) => s.push);
  const canRun = can(role, 'runSimulations');

  const [uid, setUid] = useState(offers[0]?._uid ?? '');
  const offer = offers.find((o) => o._uid === uid) ?? offers[0];

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
      {/* Databricks-style header band */}
      <div className="mb-4 overflow-hidden rounded-xl shadow-sm" style={{ background: `linear-gradient(135deg, ${DBX.navy} 0%, ${DBX.navy2} 100%)` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: DBX.red }}>
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Data feed · Databricks</h1>
              <p className="text-xs text-white/60">Loyalty offer metadata written to the lakehouse</p>
            </div>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(255,54,33,0.15)', color: '#FF8A7A', border: '1px solid rgba(255,54,33,0.5)' }}>
            Simulated
          </span>
        </div>
        {/* Toolbar: offer picker */}
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-2.5" style={{ background: 'rgba(0,0,0,0.22)' }}>
          <label className="text-xs font-medium uppercase tracking-wide text-white/60">Offer</label>
          <select
            className="min-w-[280px] rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none"
            style={{ background: DBX.ink, border: '1px solid rgba(255,255,255,0.15)' }}
            value={uid}
            onChange={(e) => setUid(e.target.value)}
          >
            {offers.map((o) => (
              <option key={o._uid} value={o._uid} style={{ color: '#111' }}>
                {String(o.offerName ?? o.offerId ?? o._uid)} — {String(o.buildStatus)}
              </option>
            ))}
          </select>
          <span className="ml-auto font-mono text-xs text-white/40">catalog.loyalty.offer_metadata</span>
        </div>
      </div>

      {/* Exclusion banner */}
      <div
        className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        style={{
          background: excluded ? 'rgba(255,54,33,0.06)' : '#fff',
          border: `1px solid ${excluded ? 'rgba(255,54,33,0.4)' : 'rgba(27,49,57,0.15)'}`,
          color: DBX.navy,
        }}
      >
        <AlertTriangle size={15} style={{ color: DBX.red }} /> Cancelled offers are excluded from the metadata feed.
        {excluded && <span className="ml-1 font-semibold" style={{ color: DBX.red }}>This offer is Cancelled — Include for Metadata = No.</span>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
        {/* Panel A — metadata table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm" style={{ border: '1px solid rgba(27,49,57,0.15)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: DBX.navy }}>
            <div className="flex items-center gap-2 text-white">
              <Table2 size={15} style={{ color: DBX.red }} />
              <span className="font-mono text-sm">loyalty_offer_metadata</span>
            </div>
            <span className="text-xs text-white/55">{metadataFields.length} columns</span>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10" style={{ background: '#F3F5F6' }}>
                <tr className="uppercase tracking-wide" style={{ color: DBX.navy }}>
                  <th className="px-3 py-2 font-semibold">Source column</th>
                  <th className="px-3 py-2 font-semibold">Datalake column</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Include</th>
                  <th className="px-3 py-2 font-semibold">Datatype</th>
                  <th className="px-3 py-2 font-semibold" style={{ borderBottom: `2px solid ${DBX.red}` }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {metadataFields.map((m, i) => {
                  const v = offer ? resolveCalendarFieldValue(m.calendarFieldId, offer) : { text: '', captured: false };
                  return (
                    <tr key={i} style={{ background: i % 2 ? '#FAFBFC' : '#fff' }} className="border-b border-[#1B3139]/5 hover:bg-[#FF3621]/[0.03]">
                      <td className="px-3 py-1.5" style={{ color: DBX.navy }}>{m.sourceColumn}</td>
                      <td className="px-3 py-1.5 font-mono" style={{ color: DBX.red }}>{m.datalakeColumn}</td>
                      <td className="px-3 py-1.5">
                        {m.type ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={
                              m.type === 'CM'
                                ? { background: 'rgba(255,54,33,0.1)', color: DBX.red }
                                : { background: 'rgba(27,49,57,0.1)', color: DBX.navy }
                            }
                          >
                            {m.type}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1 text-muted">
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: m.includeInDatalake === 'Yes' ? '#3D7A4E' : '#B9C0C4' }} />
                          {m.includeInDatalake}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-muted">{m.datatype}</td>
                      <td
                        className={`px-3 py-1.5 ${v.captured ? 'font-medium' : 'italic text-muted'}`}
                        style={v.captured ? { color: DBX.navy, borderLeft: '2px solid rgba(255,54,33,0.25)' } : { borderLeft: '2px solid transparent' }}
                      >
                        {v.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel B — jobs / load log */}
        <div>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm" style={{ border: '1px solid rgba(27,49,57,0.15)' }}>
            <div className="px-4 py-2.5 text-sm font-semibold text-white" style={{ background: DBX.navy }}>
              Load log
            </div>
            <div className="p-3">
              {canRun ? (
                <div className="mb-3 flex flex-col gap-2">
                  <button
                    onClick={simulateDaily}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: DBX.red }}
                  >
                    <PlayCircle size={15} /> Simulate daily load
                  </button>
                  <button
                    onClick={simulateFailed}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                    style={{ border: `1px solid ${DBX.red}`, color: DBX.red }}
                  >
                    <XCircle size={15} /> Simulate failed load
                  </button>
                </div>
              ) : (
                <p className="mb-3 text-xs text-muted">Only Admin can run load simulations.</p>
              )}

              {feedLog.length === 0 ? (
                <p className="rounded-md px-3 py-4 text-sm text-muted" style={{ background: '#F3F5F6' }}>No loads simulated yet.</p>
              ) : (
                <ul className="space-y-2">
                  {feedLog.map((e) => {
                    const okColor = '#3D7A4E';
                    const failColor = DBX.red;
                    const c = e.status === 'Success' ? okColor : failColor;
                    return (
                      <li key={e.id} className="rounded-md p-2.5" style={{ background: '#F7F8F9', borderLeft: `3px solid ${c}` }}>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: c }}>
                            {e.status === 'Success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {e.status}
                          </span>
                          <span className="font-mono text-[11px] text-muted">{format(new Date(e.timestamp), 'MMM d, HH:mm:ss')}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          <span className="font-mono" style={{ color: DBX.navy }}>{e.records}</span> records · {e.message}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
