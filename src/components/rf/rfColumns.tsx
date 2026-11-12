// v3 C3: build ExcelGrid columns from the column registry.
import type { ReactNode } from 'react';
import { StatusPill } from '@/components/StatusPill';
import type { ExcelColumn } from '@/components/ExcelGrid';
import type { TagKind } from '@/components/TagPill';
import { isErr, type XVal } from '@/lib/excel';
import { formatXVal } from '@/lib/excelFormat';
import type { Band, RegistryEntry } from '@/lib/forecastColumnRegistry';
import { gridValue, NOT_IN_SHARED_FILES } from '@/lib/rfGrid';
import { statusOf } from '@/lib/lifecycle';
import { fiscalLookup } from '@/lib/calculations';
import type { ImportMeta, OfferRecord } from '@/lib/types';

export const BAND_STYLE: Record<Band, { label: string; header: string; band: string; legend: string }> = {
  basics: { label: 'Offer basics', header: 'bg-surface', band: 'bg-surface', legend: 'bg-white ring-1 ring-border' },
  RESULTS: { label: 'RESULTS', header: 'bg-green-50', band: 'bg-green-100 text-green-800', legend: 'bg-green-50 ring-1 ring-green-200' },
  FORECAST: { label: 'FORECAST', header: 'bg-blue-50', band: 'bg-blue-100 text-blue-800', legend: 'bg-blue-50 ring-1 ring-blue-200' },
  WBR: { label: 'WBR', header: 'bg-amber-50', band: 'bg-amber-100 text-amber-800', legend: 'bg-amber-50 ring-1 ring-amber-200' },
  CALENDAR: { label: 'CALENDAR (offer form)', header: 'bg-slate-50', band: 'bg-slate-200 text-slate-700', legend: 'bg-slate-100 ring-1 ring-slate-300' },
  MD_BASICS: { label: 'BASICS', header: 'bg-surface', band: 'bg-surface', legend: 'bg-white ring-1 ring-border' },
  MD_RESULTS: { label: 'RESULTS', header: 'bg-green-50', band: 'bg-green-100 text-green-800', legend: 'bg-green-50 ring-1 ring-green-200' },
  MD_FORECAST: { label: 'FORECAST', header: 'bg-blue-50', band: 'bg-blue-100 text-blue-800', legend: 'bg-blue-50 ring-1 ring-blue-200' },
  MD_OTHER: { label: 'OTHER IN THIS RANGE', header: 'bg-slate-50', band: 'bg-slate-200 text-slate-700', legend: 'bg-slate-100 ring-1 ring-slate-300' },
  MD_MULTI: { label: 'MULTIPLE DIVISIONS', header: 'bg-purple-50', band: 'bg-purple-100 text-purple-800', legend: 'bg-purple-50 ring-1 ring-purple-200' },
  MD_PRORATED: { label: 'PRORATED', header: 'bg-amber-50', band: 'bg-amber-100 text-amber-800', legend: 'bg-amber-50 ring-1 ring-amber-200' },
};

export const COLOUR_CHIP: Record<string, string> = {
  Pink: 'bg-pink-100 text-pink-700',
  'Light green': 'bg-green-100 text-green-700',
  'Dark Green': 'bg-green-700 text-white',
};

const TAG_KINDS = new Set<TagKind>([
  'Typed', 'Dropdown', 'Calculated', 'Fixed number', 'Auto-generated', 'Locked', 'Confirm with business',
  'Provisional', 'Phase 2', 'MVP scope to confirm',
]);

/** A small chip for tags that are not TagPill kinds (e.g. "Copy of R&F"). */
export function ExtraTag({ label, title }: { label: string; title?: string }) {
  return (
    <span title={title} className="inline-flex cursor-help items-center whitespace-nowrap rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
      {label}
    </span>
  );
}

/** Excel's own text outputs show grey italic; "null" shows "Not available". */
export function XCell({ v, text }: { v: XVal; text: string }) {
  if (text === 'null') return <span className="italic text-muted" title="Excel shows 'null' here.">Not available</span>;
  if (text === 'TBD' || text === 'N/A') return <span className="italic text-muted">{text}</span>;
  if (isErr(v)) return <span className="text-danger" title="Excel would show this error too.">{text}</span>;
  return <>{text}</>;
}

export function columnTooltip(e: RegistryEntry, extra?: ReactNode): ReactNode {
  return (
    <div className="space-y-1">
      <div className="font-semibold">
        {e.source === 'Metadata' ? 'Metadata' : e.source === 'Calendar main tab' ? 'Calendar' : 'R&F'} column {e.letter}: {e.header}
      </div>
      <div>{e.meaning}</div>
      {e.words && <div className="text-muted">{e.words}</div>}
      {e.excel && <div className="break-all rounded bg-surface px-1 py-0.5 font-mono text-[10px]">{e.excel}</div>}
      {e.inputSource && <div className="text-muted">{e.inputSource}</div>}
      {extra}
    </div>
  );
}

export interface RfColumnCtx {
  asOf: Date;
  metaOf: (uid: string | undefined) => ImportMeta | undefined;
  /** Badges shown next to the Offer Name. */
  badges?: (o: OfferRecord) => ReactNode;
}

function widthFor(e: RegistryEntry): number {
  if (e.letter === 'J' && e.source === 'R&F tab') return 240;
  if (e.letter === 'A' && e.source === 'R&F tab') return 90;
  if (e.band === 'WBR' && e.format === 'text') return 130;
  if (e.header.length > 40) return 170;
  return 125;
}

/** Build one ExcelGrid column for a registry entry. */
export function rfColumn(e: RegistryEntry, ctx: RfColumnCtx): ExcelColumn {
  const style = BAND_STYLE[e.band];
  const value = (o: OfferRecord) => gridValue(e, o, ctx.asOf, ctx.metaOf(o._uid));
  const text = (o: OfferRecord) => formatXVal(value(o), e.format);
  const tagIsKind = TAG_KINDS.has(e.tag as TagKind);
  const twinNote =
    e.source === 'R&F tab' && ['B', 'O', 'P', 'Q', 'R', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK'].includes(e.letter) ? (
      <div className="text-muted">Also the Calendar main tab column {TWIN_LETTER[e.letter]} (shown here through this column).</div>
    ) : null;
  return {
    id: e.key,
    header: e.source === 'R&F tab' && e.letter === 'A' ? 'Offer ID' : e.header,
    excelCol: e.letter,
    band: style.label,
    bandClass: style.band,
    groupClass: style.header,
    tag: tagIsKind ? (e.tag as TagKind) : undefined,
    tagNode: tagIsKind
      ? undefined
      : (
          <ExtraTag
            label={e.tag}
            title={
              e.tag === 'Copy of R&F'
                ? `The Calendar pulls this value back from the Results and Forecast tab (column ${e.twinOf?.slice(3)}).`
                : 'Typed in the Metadata file today. The offer form does not capture it yet.'
            }
          />
        ),
    tooltip: columnTooltip(e, twinNote),
    caveat: e.caveat,
    subHeader: e.databricks,
    width: widthFor(e),
    sortValue: (o) => {
      const v = value(o);
      return typeof v === 'number' ? v : isErr(v) ? v.error : v;
    },
    filterValue: text,
    cell: (o) => {
      const v = value(o);
      if (e.source === 'R&F tab' && e.letter === 'C') return <StatusPill status={statusOf(o)} withTooltip={false} />;
      if (e.source === 'R&F tab' && e.letter === 'J') {
        return (
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{String(o.offerName ?? '')}</span>
            {ctx.badges?.(o)}
          </span>
        );
      }
      const t = formatXVal(v, e.format);
      if (e.letter === 'BZ' && e.source === 'R&F tab') {
        return t ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${COLOUR_CHIP[t] ?? ''}`}>{t}</span> : '';
      }
      if (e.source === 'Metadata') {
        // FC has no IFERROR in Excel (#VALUE! in 374 rows): show "Not available".
        if (isErr(v)) return <span className="italic text-muted" title={`Excel shows ${v.error} here.`}>Not available</span>;
        if (['D', 'E', 'F'].includes(e.letter) && t !== '' && !fiscalLookup(o)) {
          return (
            <span className="flex items-center gap-1">
              {t}
              <span className="rounded-full border border-slate-300 px-1 text-[9px] text-slate-500" title="The fiscal calendar has no row for this date; the value comes from the Metadata file.">From Metadata</span>
            </span>
          );
        }
      }
      if (t === '' && NOT_IN_SHARED_FILES.has(e.key) && ctx.metaOf(o._uid)) {
        return (
          <span className="italic text-muted" title="The Excel exports shared for this prototype do not include this Calendar column. Enter it on the offer (Step 7 or Step 9).">
            Not in shared files
          </span>
        );
      }
      return <XCell v={v} text={t} />;
    },
  };
}

const TWIN_LETTER: Record<string, string> = {
  B: 'CP', O: 'DD', P: 'DE', Q: 'DF', R: 'DG', AF: 'DM', AG: 'DN', AH: 'DO', AI: 'DP', AJ: 'DQ', AK: 'DR',
};
