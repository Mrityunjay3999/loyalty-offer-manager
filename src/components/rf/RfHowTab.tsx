import { useMemo, useState } from 'react';
import { Check, X as XIcon } from 'lucide-react';
import { TagPill } from '@/components/TagPill';
import { computeRfCells, type RfCells } from '@/lib/rfEngine';
import { displayXVal } from '@/lib/excelFormat';
import { REGISTRY, RF_REGISTRY, type RegistryEntry } from '@/lib/forecastColumnRegistry';
import { useImportReport } from '@/lib/importData';
import { fillFormula } from './RfDetailDrawer';
import type { OfferRecord } from '@/lib/types';

const DEFAULT_EXAMPLE = '20260330_CATLRGBGS_10X';

/** C3b coverage targets. */
const COVERAGE: Array<{ source: string; columns: string; target: number; shownIn: string; count: () => number }> = [
  {
    source: 'Excel Calendar file, "LIVE - Results and Forecast" tab',
    columns: 'A to BZ, all of them (A shown as Offer ID)',
    target: 78,
    shownIn: 'Grid tab',
    count: () => REGISTRY.filter((e) => e.source === 'R&F tab').length,
  },
  {
    source: 'Excel Calendar file, main tab "LIVE - Treats Rewards Calendar", forecast and results columns',
    columns: '11 shown through their R&F twin, 18 in the CALENDAR band',
    target: 29,
    shownIn: 'Grid tab',
    count: () => REGISTRY.filter((e) => e.source === 'Calendar main tab').length,
  },
  {
    source: 'Excel Metadata file, Master Sheet',
    columns: 'BW to FC, all of them',
    target: 85,
    shownIn: 'Metadata view',
    count: () => REGISTRY.filter((e) => e.source === 'Metadata' && e.band !== 'MD_BASICS').length,
  },
  {
    source: 'Excel Metadata file, Master Sheet, inputs used by those formulas',
    columns: 'B, D, E, F, G, H, I, J, K, L, M, O, Q, AD, AE, AF, AT, AU',
    target: 18,
    shownIn: 'Metadata view, BASICS band',
    count: () => REGISTRY.filter((e) => e.source === 'Metadata' && e.band === 'MD_BASICS').length,
  },
];

const L = (s: string) => RF_REGISTRY.find((e) => e.letter === s)!;
const range = (a: string, b: string) => {
  const all = RF_REGISTRY.map((e) => e.letter);
  return all.slice(all.indexOf(a), all.indexOf(b) + 1);
};
/** Every one of the 78 columns, in one of the 4 cards, in Excel order. */
export const HOW_CARDS: Array<{ title: string; letters: string[] }> = [
  { title: 'Inputs', letters: [...range('A', 'R'), 'V', 'X', ...range('AH', 'AK')] },
  { title: 'Results formulas', letters: range('S', 'AE').filter((x) => x !== 'V' && x !== 'X') },
  { title: 'Forecast formulas', letters: ['AF', 'AG', ...range('AL', 'BL')] },
  { title: 'WBR text rules', letters: range('BM', 'BZ') },
];

export function RfHowTab({ offers, asOf }: { offers: OfferRecord[]; asOf: Date }) {
  const report = useImportReport();
  const [pick, setPick] = useState(DEFAULT_EXAMPLE);
  const example = useMemo(
    () => offers.find((o) => o.offerName === pick) ?? offers.find((o) => o.offerName === DEFAULT_EXAMPLE) ?? offers[0],
    [offers, pick],
  );
  const cells = example ? computeRfCells(example, asOf) : null;
  const note = report?.excelHeaderNote;

  return (
    <div className="space-y-4 text-sm">
      {/* Coverage */}
      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-2 font-semibold">Coverage: nothing is missed</h3>
        <p className="mb-2 text-xs text-muted">Every column below has exactly 1 entry in the column registry. The Grid tab, the Metadata view, the exports and the Check tab all read it.</p>
        <table className="w-full text-left text-xs">
          <thead className="text-muted"><tr><th className="py-1">Source</th><th>Columns</th><th className="text-right">In registry</th><th>Shown in</th><th /></tr></thead>
          <tbody>
            {COVERAGE.map((c) => {
              const n = c.count();
              const ok = n === c.target;
              return (
                <tr key={c.source} className="border-t border-border/50 align-top">
                  <td className="py-1 pr-2">{c.source}</td>
                  <td className="pr-2 text-muted">{c.columns}</td>
                  <td className="text-right tabular-nums">{n} / {c.target}</td>
                  <td className="pl-2">{c.shownIn}</td>
                  <td className="pl-2">{ok ? <Check size={14} className="text-success" aria-label="Complete" /> : <XIcon size={14} className="text-danger" aria-label="Incomplete" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Flow strip */}
      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-1 font-semibold">Flow</h3>
        <p className="text-muted">
          Offer form (Step 2, 3, 5, 7, 9) → Results &amp; Forecast → back to Step 7 (6 totals, Forecast needed) → WBR.
          Separately: Offer form → Metadata results and forecast (own formulas) → Databricks feed.
        </p>
      </div>

      {/* Worked example picker */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-3 text-xs">
        <label htmlFor="how-offer" className="font-medium">Worked example offer</label>
        <input
          id="how-offer"
          list="how-offers"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="min-w-[320px] rounded border border-border px-2 py-1"
        />
        <datalist id="how-offers">
          {offers.slice(0, 2500).map((o) => <option key={o._uid} value={String(o.offerName ?? '')} />)}
        </datalist>
        <span className="text-muted">
          {example ? `Offer ID ${String(example.offerId)}, ${String(example.offerDesign ?? '')}, as of ${asOf.toLocaleDateString('en-US')}. Every example below recalculates.` : 'Pick an offer.'}
        </span>
      </div>

      {HOW_CARDS.map((card) => (
        <div key={card.title} className="rounded-lg border border-border bg-white p-4">
          <h3 className="mb-2 font-semibold">{card.title}</h3>
          <div className="divide-y divide-border/60">
            {card.letters.map((x) => (
              <ColumnRow key={x} e={L(x)} cells={cells} />
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-1 font-semibold">Note in the Excel header</h3>
        <p className="mb-1 font-medium">
          {note ? `${note.Y1} ${note.Z1} (${note.AA1})` : 'Overall program redemption 85% (11/1/2024)'}
        </p>
        <p className="text-muted">The Excel tab shows this note above columns Y to AA. No formula uses it. Today's rule is in column AC.</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-1 font-semibold">Points economics</h3>
        <p className="text-muted">
          1,000 points = $2 and 10 base points per $1 for offers from April 2024. 648 older offers in the Metadata file use $2.50 and 8 points, and the calculations use each offer's own values (columns V and X).
        </p>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">Same measure, 2 rules <TagPill kind="Confirm with business" /></h3>
        <p className="mb-2 text-xs text-muted">Which rule the product keeps is a business decision.</p>
        <table className="w-full text-left text-xs">
          <thead className="text-muted"><tr><th className="py-1">Measure</th><th className="py-1">Results and Forecast rule</th><th className="py-1">Metadata rule</th></tr></thead>
          <tbody className="align-top">
            <tr className="border-t border-border/50"><td className="py-1">Assumed redemption rate (actuals)</td><td className="py-1">100% for Points donations, Extra entries and Limited Time Bonus Offer; 88% from 10/1/2025; else 85% (AC)</td><td className="py-1">100% for Limited Time Bonus Offer or REDEMPTION; 88% from 10/1/2025; 85% from 11/1/2024; else 80% (CP)</td></tr>
            <tr className="border-t border-border/50"><td className="py-1">Forecast bonus points Low / High</td><td className="py-1">0 when Cancelled (AX, AY)</td><td className="py-1">No Cancelled check (DP, DQ)</td></tr>
            <tr className="border-t border-border/50"><td className="py-1">Limited Time Bonus points removed</td><td className="py-1">Build status exactly "Completed" (T)</td><td className="py-1">Date-based Offer Status "Completed" (on or after End Date) (CE)</td></tr>
            <tr className="border-t border-border/50"><td className="py-1">Days elapsed (prorated)</td><td className="py-1">From Start Date, capped at Promo Days (BW)</td><td className="py-1">From Early Activation Date when there is one, capped at early activation days (EZ)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnRow({ e, cells }: { e: RegistryEntry; cells: RfCells | null }) {
  const v = cells ? cells[e.letter as keyof RfCells] : '';
  const shown = cells ? displayXVal(v, e.format) : '';
  return (
    <div className="grid grid-cols-1 gap-1 py-2 text-xs md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <div className="font-medium text-ink">
          <span className="mr-1 inline-block w-7 text-muted">{e.letter}</span>
          {e.letter === 'A' ? 'Ref Number (shown as Offer ID)' : e.header}
          {e.caveat && <span className="ml-1 text-warning" title={e.caveat}>(note)</span>}
        </div>
        <div className="pl-8 text-muted">{e.meaning}</div>
      </div>
      <div className="space-y-0.5">
        {e.words && <div className="text-ink">{e.words}</div>}
        {e.inputSource && <div className="text-muted">{e.inputSource}</div>}
        {e.excel && <div className="break-all font-mono text-[10px] text-muted">{e.excel}</div>}
        {cells && (
          <div className="break-all font-mono text-[10px] text-primary">
            {e.excel ? `${fillFormula(e.excel, cells)} → ` : 'Example: '}
            <span className="font-semibold">{shown === '' ? '(blank)' : shown}</span>
          </div>
        )}
      </div>
    </div>
  );
}
