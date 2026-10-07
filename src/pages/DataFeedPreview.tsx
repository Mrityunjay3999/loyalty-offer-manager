import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import * as Tabs from '@radix-ui/react-tabs';
import { Database, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Download, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { TagPill } from '@/components/TagPill';
import { metadataFields } from '@/lib/dataLoaders';
import { includeForMetadata } from '@/lib/calculations';
import { can } from '@/lib/permissions';
import { fiscalYearOf } from '@/lib/offers';
import { toCsv, downloadCsv } from '@/lib/csv';
import {
  routeTable, attributeColumns, metricColumns, notLoadedColumns,
  includedOffers, allExceptions, columnValue, formatByDatatype,
} from '@/lib/feed';
import type { MetadataField, OfferRecord } from '@/lib/types';

const DBX = { red: '#FF3621', navy: '#1B3139', navy2: '#11272E', ink: '#0E1A1F' };

export function DataFeedPreview() {
  const navigate = useNavigate();
  const offers = useAppStore((s) => s.offers);
  const role = useAppStore((s) => s.role);
  const feedLog = useAppStore((s) => s.feedLog);
  const addFeedLog = useAppStore((s) => s.addFeedLog);
  const simulateNightlyLoad = useAppStore((s) => s.simulateNightlyLoad);
  const tableNames = useAppStore((s) => s.databricksTableNames);
  const csc = useAppStore((s) => s.categorySubCategory);
  const push = useToasts((s) => s.push);
  const canRun = can(role, 'runSimulations');

  const included = useMemo(() => includedOffers(offers), [offers]);
  const exceptions = useMemo(() => allExceptions(offers, csc), [offers, csc]);
  const attrName = tableNames.attributes ?? 'Features metadata';
  const metricName = tableNames.metrics ?? 'Features metadata metrics';

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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: DBX.red }}><Database size={18} className="text-white" /></div>
            <div>
              <h1 className="text-lg font-semibold text-white">Data feed · Databricks</h1>
              <p className="text-xs text-white/60">Loyalty offer metadata written to the lakehouse</p>
            </div>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(255,54,33,0.15)', color: '#FF8A7A', border: '1px solid rgba(255,54,33,0.5)' }}>Simulated</span>
        </div>
      </div>

      {/* Who is included where (C3) + one-store info (A12) */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-white p-3 text-xs">
          <div className="mb-1 font-semibold">Who is included where</div>
          <table className="w-full text-left">
            <thead className="text-muted"><tr><th className="py-0.5"></th><th>Offer View</th><th>Results &amp; Forecast</th><th>Databricks feed</th></tr></thead>
            <tbody>
              {[['Draft', 'No', 'No', 'No'], ['Cancelled', 'No', 'No', 'No'], ['IMP only', 'Yes', 'No', 'Yes'], ['All other statuses', 'Yes', 'Yes', 'Yes']].map((r) => (
                <tr key={r[0]} className="border-t border-border/50"><td className="py-0.5 font-medium">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-white p-3 text-xs text-muted">
          <div className="mb-1 font-semibold text-ink">One store for all years</div>
          Today the Calendar keeps current and future offers and the Metadata file keeps all history.
          Past years are moved by hand once a year. In the product there is 1 store, so nothing is
          moved or pasted.
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted">
        <AlertTriangle size={15} className="text-warning" /> Included: status is set and not Cancelled. Drafts and Cancelled are excluded. {included.length} offers currently included.
      </div>

      <Tabs.Root defaultValue="preview">
        <Tabs.List className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {[['preview', 'Record preview'], ['table', 'Table view'], ['mapping', 'Column mapping'], ['exceptions', `Exceptions (${exceptions.length})`], ['log', 'Load log']].map(([v, l]) => (
            <Tabs.Trigger key={v} value={v} className="border-b-2 border-transparent px-3 py-2 text-sm text-muted data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-primary">{l}</Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="preview"><RecordPreview offers={offers} attrName={attrName} metricName={metricName} /></Tabs.Content>
        <Tabs.Content value="table"><TableView included={included} attrName={attrName} metricName={metricName} push={push} /></Tabs.Content>
        <Tabs.Content value="mapping"><ColumnMapping attrName={attrName} metricName={metricName} push={push} /></Tabs.Content>
        <Tabs.Content value="exceptions"><Exceptions exceptions={exceptions} navigate={navigate} /></Tabs.Content>
        <Tabs.Content value="log">
          <LoadLog feedLog={feedLog} canRun={canRun} onNightly={() => { simulateNightlyLoad(); push('Nightly load simulated.', 'success'); }} onFailed={simulateFailed} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function sectionRows(cols: MetadataField[], offer: OfferRecord) {
  return cols.map((m) => {
    const v = columnValue(m, offer);
    const state = !v.captured ? 'Not captured' : v.text === 'Not entered' ? 'Missing' : 'OK';
    return { m, v, state };
  });
}

function RecordPreview({ offers, attrName, metricName }: { offers: OfferRecord[]; attrName: string; metricName: string }) {
  const [uid, setUid] = useState(offers[0]?._uid ?? '');
  const [filter, setFilter] = useState<'all' | 'form' | 'calc' | 'notcap' | 'issue'>('all');
  const [q, setQ] = useState('');
  const offer = offers.find((o) => o._uid === uid) ?? offers[0];
  const excluded = offer ? includeForMetadata(offer) === 'No' : false;

  const sections: Array<[string, MetadataField[]]> = [
    [`${attrName} (${attributeColumns.length} columns)`, attributeColumns],
    [`${metricName} (${metricColumns.length} columns)`, metricColumns],
    [`Not loaded (${notLoadedColumns.length} columns)`, notLoadedColumns],
  ];

  function show(m: MetadataField, v: { captured: boolean; source: string; text: string }) {
    if (q && !`${m.sourceColumn} ${m.datalakeColumn}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'form') return v.source.startsWith('Offer form');
    if (filter === 'calc') return v.source.startsWith('Calculated');
    if (filter === 'notcap') return !v.captured;
    if (filter === 'issue') return v.captured && v.text === 'Not entered';
    return true;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted">Offer:</label>
        <select className="min-w-[260px] rounded-md border border-border px-2 py-1.5 text-sm" value={uid} onChange={(e) => setUid(e.target.value)}>
          {offers.map((o) => <option key={o._uid} value={o._uid}>{String(o.offerName ?? o.offerId)} — {String(o.buildStatus)}</option>)}
        </select>
        <input className="rounded-md border border-border px-2 py-1.5 text-sm" placeholder="Search columns" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1">
          {([['all', 'All'], ['form', 'From form'], ['calc', 'Calculated'], ['notcap', 'Not captured'], ['issue', 'Has issue']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-2 py-0.5 text-xs ${filter === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink hover:bg-surface'}`}>{l}</button>
          ))}
        </div>
        {excluded && <span className="text-xs font-medium text-danger">This offer is excluded (Draft/Cancelled).</span>}
      </div>
      {offer && sections.map(([title, cols]) => {
        const rows = sectionRows(cols, offer).filter((r) => show(r.m, r.v));
        return (
          <details key={title} open className="mb-3 overflow-hidden rounded-lg border border-border bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold" style={{ background: '#F3F5F6', color: DBX.navy }}>{title} · {rows.length} shown</summary>
            <div className="max-h-[48vh] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface text-muted"><tr>
                  <th className="px-2 py-1.5">Databricks column</th><th className="px-2 py-1.5">Metadata column</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Datatype</th><th className="px-2 py-1.5">Source in product</th><th className="px-2 py-1.5">Value</th><th className="px-2 py-1.5">State</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-2 py-1 font-mono" style={{ color: DBX.red }}>{r.m.datalakeColumn}</td>
                      <td className="px-2 py-1 text-ink">{r.m.sourceColumn}</td>
                      <td className="px-2 py-1 text-muted">{r.m.type ?? '—'}</td>
                      <td className="px-2 py-1 text-muted">{r.m.datatype}</td>
                      <td className="px-2 py-1 text-muted">{r.v.source}</td>
                      <td className={`px-2 py-1 ${r.v.captured ? '' : 'italic text-muted'}`}>{formatByDatatype(r.m.datatype, r.v.text, r.v.captured)}</td>
                      <td className="px-2 py-1"><span className={r.state === 'OK' ? 'text-success' : r.state === 'Missing' ? 'text-warning' : 'text-muted'}>{r.state}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function TableView({ included, attrName, metricName, push }: { included: OfferRecord[]; attrName: string; metricName: string; push: (m: string, k?: 'success') => void }) {
  const [tbl, setTbl] = useState<'attributes' | 'metrics'>('attributes');
  const cols = tbl === 'attributes' ? attributeColumns : metricColumns;
  const [fy, setFy] = useState('');
  const rows = useMemo(() => included.filter((o) => !fy || fiscalYearOf(o) === fy), [included, fy]);
  const fyOpts = [...new Set(included.map(fiscalYearOf).filter(Boolean))].sort();

  function exportCsv() {
    const headers = ['offer_id', ...cols.map((m) => m.datalakeColumn)];
    const data = rows.map((o) => [String(o.offerId ?? ''), ...cols.map((m) => { const v = columnValue(m, o); return formatByDatatype(m.datatype, v.text, v.captured); })]);
    downloadCsv(`databricks_${tbl}`, toCsv(headers, data));
    push(`Exported ${rows.length} rows.`, 'success');
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded border border-border text-xs">
          {(['attributes', 'metrics'] as const).map((t) => (
            <button key={t} onClick={() => setTbl(t)} className={`px-2 py-1 ${tbl === t ? 'bg-primary text-white' : 'bg-white'}`}>{t === 'attributes' ? attrName : metricName}</button>
          ))}
        </div>
        <select className="rounded border border-border px-2 py-1 text-xs" value={fy} onChange={(e) => setFy(e.target.value)}><option value="">Fiscal year: All</option>{fyOpts.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <span className="text-xs text-muted">{rows.length} offers × {cols.length + 1} columns</span>
        <button onClick={exportCsv} className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"><Download size={13} /> Export CSV</button>
      </div>
      <div className="max-h-[62vh] overflow-auto rounded-lg border border-border bg-white">
        <table className="text-left text-xs">
          <thead className="sticky top-0 z-10" style={{ background: '#F3F5F6' }}>
            <tr>
              <th className="sticky left-0 z-20 border-r border-border px-2 py-1.5 font-mono" style={{ background: '#F3F5F6', color: DBX.navy }}>offer_id</th>
              {cols.map((m) => <th key={m.datalakeColumn} className="whitespace-nowrap border-r border-border/50 px-2 py-1.5 font-mono" style={{ color: DBX.red }}>{m.datalakeColumn}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o._uid} className="border-b border-border/40">
                <td className="sticky left-0 z-10 border-r border-border bg-white px-2 py-1 font-mono tabular-nums">{String(o.offerId ?? '')}</td>
                {cols.map((m) => { const v = columnValue(m, o); return <td key={m.datalakeColumn} className="whitespace-nowrap border-r border-border/30 px-2 py-1">{formatByDatatype(m.datatype, v.text, v.captured)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnMapping({ attrName, metricName, push }: { attrName: string; metricName: string; push: (m: string, k?: 'success') => void }) {
  const [q, setQ] = useState('');
  const [tbl, setTbl] = useState('');
  const rows = useMemo(() => metadataFields.filter((m) => {
    const t = routeTable(m);
    if (tbl && t !== tbl) return false;
    if (q && !`${m.sourceColumn} ${m.datalakeColumn} ${m.calendarFieldId ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, tbl]);
  const tblLabel = (t: string) => (t === 'attributes' ? attrName : t === 'metrics' ? metricName : 'Not loaded');

  function exportCsv() {
    const headers = ['Metadata column', 'Databricks column', 'Table', 'Type', 'Datatype', 'Calendar field / calc', 'Business definition'];
    const data = metadataFields.map((m) => [m.sourceColumn, m.datalakeColumn, tblLabel(routeTable(m)), m.type ?? '', m.datatype, m.calendarFieldId ?? '', m.description ?? '']);
    downloadCsv('databricks_column_mapping', toCsv(headers, data));
    push('Exported column mapping.', 'success');
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <input className="rounded border border-border px-2 py-1 text-sm" placeholder="Search columns" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded border border-border px-2 py-1 text-xs" value={tbl} onChange={(e) => setTbl(e.target.value)}><option value="">All tables</option><option value="attributes">{attrName}</option><option value="metrics">{metricName}</option><option value="notLoaded">Not loaded</option></select>
        <span className="text-xs text-muted">{rows.length} of 169</span>
        <button onClick={exportCsv} className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-surface"><Download size={13} /> Export CSV</button>
      </div>
      <div className="max-h-[62vh] overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface text-muted"><tr>
            <th className="px-2 py-1.5">Metadata column</th><th className="px-2 py-1.5">Databricks column</th><th className="px-2 py-1.5">Table</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Datatype</th><th className="px-2 py-1.5">Calendar field / calc</th><th className="px-2 py-1.5">Business definition</th>
          </tr></thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i} className="border-b border-border/40 align-top">
                <td className="px-2 py-1 text-ink">{m.sourceColumn}</td>
                <td className="px-2 py-1 font-mono" style={{ color: DBX.red }}>{m.datalakeColumn}</td>
                <td className="px-2 py-1 text-muted">{tblLabel(routeTable(m))}</td>
                <td className="px-2 py-1 text-muted">{m.type ?? '—'}</td>
                <td className="px-2 py-1 text-muted">{m.datatype}</td>
                <td className="px-2 py-1 text-muted">{m.calendarFieldId ?? '—'}</td>
                <td className="px-2 py-1 text-muted">{m.description ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Exceptions({ exceptions, navigate }: { exceptions: ReturnType<typeof allExceptions>; navigate: (p: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-1.5 text-sm text-warning">
        Offers listed here are skipped by the load until fixed. Final exception rules to be provided by the business. <TagPill kind="Provisional" />
      </div>
      {exceptions.length === 0 ? (
        <div className="rounded-lg border border-border bg-white px-4 py-8 text-center text-muted">No exceptions. Every included offer passes the load rules.</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-muted"><tr><th className="px-2 py-1.5">Offer ID</th><th className="px-2 py-1.5">Offer Name</th><th className="px-2 py-1.5">Status</th><th className="px-2 py-1.5">Field</th><th className="px-2 py-1.5">Rule broken</th><th className="px-2 py-1.5"></th></tr></thead>
            <tbody>
              {exceptions.map((e, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="px-2 py-1 tabular-nums">{e.offerId}</td>
                  <td className="px-2 py-1">{e.offerName}</td>
                  <td className="px-2 py-1">{e.status}</td>
                  <td className="px-2 py-1 text-muted">{e.fieldId}</td>
                  <td className="px-2 py-1">{e.rule}</td>
                  <td className="px-2 py-1"><button onClick={() => navigate(`/offers/${e.offerUid}`)} className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink size={12} /> Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoadLog({ feedLog, canRun, onNightly, onFailed }: { feedLog: ReturnType<typeof useAppStore.getState>['feedLog']; canRun: boolean; onNightly: () => void; onFailed: () => void }) {
  return (
    <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4">
      <div>
        {canRun ? (
          <div className="flex flex-col gap-2">
            <button onClick={onNightly} className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white hover:opacity-90" style={{ background: DBX.red }} title="Today the Metadata file is ingested once a night. This simulates that load."><PlayCircle size={15} /> Simulate nightly load</button>
            <button onClick={onFailed} className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium" style={{ border: `1px solid ${DBX.red}`, color: DBX.red }}><XCircle size={15} /> Simulate failed load</button>
          </div>
        ) : <p className="text-xs text-muted">Only Admin can run load simulations.</p>}
        <p className="mt-3 text-xs text-muted">In the product this is a direct write to the existing loyalty tables in Databricks. This page simulates it.</p>
      </div>
      <div className="rounded-lg border border-border bg-white">
        {feedLog.length === 0 ? <p className="px-3 py-4 text-sm text-muted">No loads simulated yet.</p> : (
          <ul className="divide-y divide-border text-sm">
            {feedLog.map((e) => (
              <li key={e.id} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 font-medium ${e.status === 'Success' ? 'text-success' : 'text-danger'}`}>{e.status === 'Success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {e.status}</span>
                  <span className="text-xs text-muted">{format(new Date(e.timestamp), 'MMM d, HH:mm:ss')}</span>
                </div>
                <div className="text-xs text-muted">{e.records} records · {e.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
