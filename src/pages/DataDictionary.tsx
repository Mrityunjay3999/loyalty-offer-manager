import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Search, Eye } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { fields, STEP_ORDER } from '@/lib/dataLoaders';

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
];

export function DataDictionary() {
  const dropdowns = useAppStore((s) => s.dropdowns);
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');
  const [draftOnly, setDraftOnly] = useState(false);
  const [feedsOnly, setFeedsOnly] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return fields.filter((f) => {
      if (s && !`${f.label} ${f.id} ${f.excelHeader}`.toLowerCase().includes(s)) return false;
      if (step && f.step !== step) return false;
      if (draftOnly && !f.tooltipSource?.startsWith('DRAFT')) return false;
      if (feedsOnly && !f.datalakeColumn) return false;
      return true;
    });
  }, [q, step, draftOnly, feedsOnly]);

  return (
    <div>
      <PageHeader title="Data dictionary" count={rows.length} />
      <p className="mb-3 text-sm text-muted">
        The business’s checklist for confirming field definitions. 123 fields appear in the form;
        6 are system/hidden.
      </p>

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
              <th className="px-2 py-2 font-medium">Databricks</th>
              <th className="px-2 py-2 font-medium">MA/CM</th>
              <th className="px-2 py-2 font-medium">Datatype</th>
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
                    {retired && <span className="mt-0.5 inline-block rounded bg-surface px-1 text-[11px] text-muted">Retired in product (use Offer ID)</span>}
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
                  <td className="px-2 py-1.5 text-muted">{f.datalakeColumn ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted">{f.metadataType ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted">{f.datatype ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
