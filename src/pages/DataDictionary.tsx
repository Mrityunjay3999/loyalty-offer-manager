import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Search, Eye, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { fields, STEP_ORDER, dataDictionaryOnlyFields, requiredFieldIds, metadataFields } from '@/lib/dataLoaders';
import { routeTable } from '@/lib/feed';
import { can } from '@/lib/permissions';
import { toCsv, downloadCsv } from '@/lib/csv';

const dbTableForField = (fieldId: string): string => {
  const m = metadataFields.find((x) => x.calendarFieldId === fieldId);
  if (!m) return '';
  const t = routeTable(m);
  return t === 'attributes' ? 'Features metadata' : t === 'metrics' ? 'Features metadata metrics' : 'Not loaded';
};

const DATA_FINDINGS: string[] = [
  'Dropdown validation has drifted from its columns. Some Excel dropdown rules now sit on the wrong column (e.g. the multiplier list is attached to the threshold columns). The prototype maps every dropdown to its correct field by meaning.',
  'Status list vs definitions. The Status dropdown has 12 values; 2 of them (Forecast Only, Pending SteerCo Approval) have no written definition.',
  'Checklist completion is low. Offer Audited is filled on about 599 of 1,108 offers; Secondary Audit on none.',
  'Case mismatch in the forecast-needed formula. It checks "Merch", "Services"; the dropdown values are "MERCH", "SERVICES". The prototype implements this case-insensitively.',
  'Soft lock planner table has date errors (e.g. Jan row ends before it starts; some soft lock dates fall after their month). Highlighted on the Reference data page.',
  'Cross-tab links depend on names and running numbers, so renames and cancellations can link the wrong data or show zero. The product uses Offer ID instead.',
  'Offer names: 43 of 1,112 break the naming standard; 7 have a date that differs from the Start Date. The submission form guide shows YYYY_MM_DD_PROMONAME while real names use YYYYMMDD.',
  'Offer Submitted to Kognitiv is labelled "Formula" in the spreadsheet but holds typed values.',
  'LOPD Actuals column is never filled and marked "Remove in 2026".',
  'Loyalty platform naming: status definitions say Capillary; checklist and fields say Kognitiv.',
  'Metadata linkage by running number. The Metadata file links to the Calendar through a running reference number (col CV = max of the numbers above + 1). It renumbers when an offer above is added or changes to/from Cancelled, so Metadata rows can point at the wrong offer. The product uses the Offer ID instead.',
  'Pasted values, not live lookups. Older Metadata rows hold pasted values, so Calendar edits never reach them.',
  'The 7 Metadata columns labelled "Forecast" actually read the Calendar’s own forecast columns (Fcst Date, Activation, Bonus rate, Avg spend Low/High).',
  'In older rows, Metadata "Offer Build Status" copies Metadata "Offer Status" instead of the Calendar build status.',
  'The actual-results redemption rate (Metadata col CP) uses a different rule from the forecast rate (col DX) — see spec 8.6 item 9.',
];

const OPEN_QUESTIONS: string[] = [
  'Final list of fields required for the metadata load, and the exception rules.',
  'Exact Databricks table names for the 2 metadata tables.',
  'Meaning of Dashboard Mo. (reporting).',
  'Final definitions for each status, including Pending SteerCo Approval.',
  'Whether the submission form is in MVP.',
  'Which redemption-rate rule the product keeps for actual results (Results & Forecast vs metadata).',
  'Who can reopen a locked offer.',
  'Final step grouping of the fields.',
  'Who approves offers (existing open question).',
];

export function DataDictionary() {
  const dropdowns = useAppStore((s) => s.dropdowns);
  const role = useAppStore((s) => s.role);
  const fieldDefinitions = useAppStore((s) => s.fieldDefinitions);
  const setFieldDefinition = useAppStore((s) => s.setFieldDefinition);
  const isAdmin = can(role, 'editBusinessDefs');
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');
  const [draftOnly, setDraftOnly] = useState(false);
  const [feedsOnly, setFeedsOnly] = useState(false);
  const [notConfirmed, setNotConfirmed] = useState(false);

  const defStatus = (id: string) => fieldDefinitions[id]?.status ?? 'Draft';
  const defText = (id: string, fallback: string) => fieldDefinitions[id]?.businessDefinition ?? fallback;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return fields.filter((f) => {
      if (s && !`${f.label} ${f.id} ${f.excelHeader}`.toLowerCase().includes(s)) return false;
      if (step && f.step !== step) return false;
      if (draftOnly && !f.tooltipSource?.startsWith('DRAFT')) return false;
      if (feedsOnly && !f.datalakeColumn) return false;
      if (notConfirmed && defStatus(f.id) === 'Confirmed') return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, step, draftOnly, feedsOnly, notConfirmed, fieldDefinitions]);

  function exportGrouping() {
    const headers = ['Field label', 'Excel column', 'Current step', 'Current group', 'Proposed step', 'Proposed group', 'Comment'];
    const data = fields.map((f) => [f.label, f.excelColumn ?? '', f.step, f.group ?? '', '', '', '']);
    downloadCsv('field-grouping', toCsv(headers, data));
  }
  function exportDefinitions() {
    const headers = ['Field', 'Databricks table', 'Databricks column', 'Required for metadata load', 'Business definition', 'Definition status'];
    const data = fields.map((f) => [f.label, dbTableForField(f.id), f.datalakeColumn ?? '', requiredFieldIds.has(f.id) ? 'Yes (provisional)' : 'No', defText(f.id, f.tooltip), defStatus(f.id)]);
    downloadCsv('field-definitions', toCsv(headers, data));
  }

  return (
    <div>
      <PageHeader title="Data dictionary" count={rows.length} />
      <p className="mb-2 text-sm text-muted">
        One place for every field’s business definition. The business reviews and confirms each one.
        123 fields appear in the form (from today’s calendar); 6 are system/hidden — 129 total.
        Offer ID is auto-generated in the product (no typed input).
      </p>
      <p className="mb-3 text-xs text-muted">Step grouping is a first draft. The business will confirm the buckets.</p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input className="rounded-md border border-border py-1.5 pl-7 pr-2 text-sm" placeholder="Search label, id or header" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="rounded-md border border-border px-2 py-1.5 text-sm" value={step} onChange={(e) => setStep(e.target.value)}>
          <option value="">All steps</option>
          {[...STEP_ORDER, 'System (hidden)'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={draftOnly} onChange={(e) => setDraftOnly(e.target.checked)} /> Draft definitions</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={feedsOnly} onChange={(e) => setFeedsOnly(e.target.checked)} /> Feeds Databricks</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={notConfirmed} onChange={(e) => setNotConfirmed(e.target.checked)} /> Definition not confirmed</label>
        <button onClick={exportGrouping} className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"><Download size={13} /> Export grouping (CSV)</button>
        <button onClick={exportDefinitions} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"><Download size={13} /> Export field definitions (CSV)</button>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 border-b border-border bg-surface text-muted">
            <tr>
              <th className="px-2 py-2 font-medium">Label</th>
              <th className="px-2 py-2 font-medium">Step</th>
              <th className="px-2 py-2 font-medium">Excel</th>
              <th className="px-2 py-2 font-medium">Control</th>
              <th className="px-2 py-2 font-medium">Options</th>
              <th className="px-2 py-2 font-medium">Tooltip source</th>
              <th className="px-2 py-2 font-medium">Databricks table</th>
              <th className="px-2 py-2 font-medium">Databricks column</th>
              <th className="px-2 py-2 font-medium">MA/CM</th>
              <th className="px-2 py-2 font-medium">Datatype</th>
              <th className="px-2 py-2 font-medium">Required for metadata load</th>
              <th className="px-2 py-2 font-medium">Business definition</th>
              <th className="px-2 py-2 font-medium">Definition status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const opts = f.optionsKey ? dropdowns[f.optionsKey] ?? [] : [];
              const retired = f.id === 'metadataRefNumber' || f.id === 'resultsForecastRefNumber';
              return (
                <tr key={f.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-ink">{f.label}</div>
                    <div className="text-muted">{f.tooltip}</div>
                    {f.id === 'offerId' && (
                      <span className="mt-0.5 inline-block rounded bg-purple-100 px-1 text-[11px] text-purple-700">Auto-generated in product</span>
                    )}
                    {retired && <span className="mt-0.5 inline-block rounded bg-surface px-1 text-[11px] text-muted">Retired in product. Replaced by Offer ID.</span>}
                  </td>
                  <td className="px-2 py-1.5 text-muted">{f.step}</td>
                  <td className="px-2 py-1.5 text-muted">{f.excelColumn} · {f.excelHeader}</td>
                  <td className="px-2 py-1.5">{f.control}</td>
                  <td className="px-2 py-1.5">
                    {opts.length > 0 ? (
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Eye size={12} /> {opts.length}
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content side="left" className="z-50 max-h-64 w-56 overflow-auto rounded-md border border-border bg-white p-2 text-xs shadow-lg">
                            <div className="mb-1 font-medium">{f.optionsKey} ({opts.length})</div>
                            <ul className="space-y-0.5">{opts.slice(0, 200).map((o) => <li key={o}>{o}</li>)}</ul>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {f.tooltipSource?.startsWith('DRAFT') ? (
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning">Draft</span>
                    ) : (
                      <span className="text-muted">{f.tooltipSource}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-muted">{dbTableForField(f.id) || '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-muted">{f.datalakeColumn ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted">{f.metadataType ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted">{f.datatype ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted">
                    {requiredFieldIds.has(f.id) ? 'Yes (provisional)' : 'No'}
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 200 }}>
                    {isAdmin ? (
                      <textarea className="w-full rounded border border-border px-1 py-0.5 text-xs" rows={2}
                        value={defText(f.id, f.tooltip)} onChange={(e) => setFieldDefinition(f.id, { businessDefinition: e.target.value })} />
                    ) : (
                      <span className="text-muted">{defText(f.id, f.tooltip)}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isAdmin ? (
                      <select className="rounded border border-border px-1 py-0.5 text-xs" value={defStatus(f.id)} onChange={(e) => setFieldDefinition(f.id, { status: e.target.value as 'Draft' | 'Confirmed' })}>
                        <option value="Draft">Draft</option>
                        <option value="Confirmed">Confirmed</option>
                      </select>
                    ) : (
                      <span className={defStatus(f.id) === 'Confirmed' ? 'text-success' : 'text-warning'}>{defStatus(f.id)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-ink">
        Defined in the data dictionary but not in today’s calendar
      </h2>
      <p className="mb-2 text-sm text-muted">
        These 10 fields have a definition in the Excel data dictionary but no column in the live
        Calendar. The business confirmed in the 2 Oct review that the data-dictionary tab is out of
        date (“Offer due date” became Offer Request Date), so none of these are in the MVP form.
      </p>
      <div className="mb-6 overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface text-muted">
            <tr>
              <th className="px-2 py-2 font-medium">DD row</th>
              <th className="px-2 py-2 font-medium">Field</th>
              <th className="px-2 py-2 font-medium">Definition</th>
              <th className="px-2 py-2 font-medium">Linked dropdown list</th>
              <th className="px-2 py-2 font-medium">In form?</th>
            </tr>
          </thead>
          <tbody>
            {dataDictionaryOnlyFields.map((d) => {
              const opts = d.dropdownKeyIfAny ? dropdowns[d.dropdownKeyIfAny] ?? [] : [];
              const inForm = false; // A2: none of these are in the MVP form
              return (
                <tr key={d.ddRow} className="border-b border-border last:border-0 align-top">
                  <td className="px-2 py-1.5 text-muted">{d.ddRow}</td>
                  <td className="px-2 py-1.5 font-medium text-ink">{d.field}</td>
                  <td className="px-2 py-1.5">
                    {d.definition ? (
                      <span className="text-ink">{d.definition}</span>
                    ) : (
                      <span className="italic text-warning">Definition not documented (confirm with business)</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {d.dropdownKeyIfAny ? (
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Eye size={12} /> {d.dropdownKeyIfAny} ({opts.length})
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content side="left" className="z-50 max-h-64 w-56 overflow-auto rounded-md border border-border bg-white p-2 text-xs shadow-lg">
                            <ul className="space-y-0.5">{opts.map((o) => <li key={o}>{o}</li>)}</ul>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {inForm ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">Step 1</span>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-ink">Open questions for the business</h2>
      <ol className="mb-6 space-y-1.5">
        {OPEN_QUESTIONS.map((qn, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/20 text-xs font-semibold text-warning">{i + 1}</span>
            <span className="text-ink">{qn}</span>
          </li>
        ))}
      </ol>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-ink">What we found in today’s spreadsheet</h2>
      <ol className="space-y-2">
        {DATA_FINDINGS.map((f, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{i + 1}</span>
            <span className="text-ink">{f}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
