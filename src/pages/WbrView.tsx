import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { computeForecast, computeResults, numberOfDays } from '@/lib/calculations';
import { planningMonth } from '@/lib/offers';
import { toNumber } from '@/lib/format';
import { toCsv, downloadCsv } from '@/lib/csv';
import * as wbr from '@/lib/wbr';
import type { OfferRecord } from '@/lib/types';

interface WbrRow {
  uid: string;
  name: string;
  period: string;
  fcstActivations: string;
  fcstMembersRate: string;
  fcstSpend: string;
  fcstBonusPts: string;
  actActivations: string;
  actMembersRate: string;
  actSpend: string;
  actBonusPts: string;
  actBonusedSales: string;
  pctComplete: string;
  prorated: string;
  colour: wbr.ColourCode;
}

function n(v: unknown): number | null {
  return toNumber(v);
}

function computeRow(o: OfferRecord): WbrRow {
  const f = computeForecast(o);
  const r = computeResults(o);
  const days = numberOfDays(o);
  const elapsed = wbr.daysElapsed(o.startDate, days);
  const pct = wbr.percentComplete(elapsed, days);
  const bonusPts = n(o.bonusPtsIssued);
  const prorated = wbr.proratedPoints(bonusPts, pct);
  return {
    uid: o._uid!,
    name: String(o.offerName ?? '(unnamed)'),
    period: wbr.offerPeriod(o.startDate, o.endDate),
    fcstActivations: wbr.forecastActivationsK(f.activationAvg),
    fcstMembersRate: wbr.forecastBonusedMemberRate(f.bonusedMembersAvg, f.bonusRateAvg),
    fcstSpend: wbr.forecastSpendPerMember(f.spendPerTxnAvg),
    fcstBonusPts: wbr.forecastBonusPts(f.bonusPointsAvg, f.bonusRedeemableAvg),
    actActivations: wbr.actualActivations(n(o.activations)),
    actMembersRate: wbr.actualBonusedMemberRate(n(o.bonusedMembers), r.bonusRate),
    actSpend: wbr.actualSpendPerMember(r.spendPerBonusedMember),
    actBonusPts: wbr.forecastBonusPts(bonusPts, r.bonusRedeemableActualWithBreakage),
    actBonusedSales: wbr.actualBonusedSales(r.bonusedSalesActual),
    pctComplete: pct === null ? '' : `${Math.round(pct * 100)}%`,
    prorated: prorated === null ? '' : wbr.pointsMD(prorated),
    colour: wbr.colourCode(prorated, f.bonusPointsLow, f.bonusPointsHigh),
  };
}

const COLOUR_CHIP: Record<string, string> = {
  Pink: 'bg-pink-100 text-pink-700',
  'Light Green': 'bg-green-100 text-green-700',
  'Dark Green': 'bg-green-700 text-white',
};

export function WbrView() {
  const offers = useAppStore((s) => s.offers);
  const push = useToasts((s) => s.push);
  const [pm, setPm] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('');

  // Excluded: Cancelled and Offer Design = IMP only (today's Include for Results and Forecast).
  const included = useMemo(
    () =>
      offers.filter(
        (o) => o.buildStatus !== 'Cancelled' && o.offerDesign !== 'IMP only',
      ),
    [offers],
  );

  const opts = useMemo(() => {
    const d = (fn: (o: OfferRecord) => string) => [...new Set(included.map(fn).filter(Boolean))].sort();
    return {
      pm: [...new Set(included.map(planningMonth).filter(Boolean))],
      status: d((o) => String(o.buildStatus ?? '')),
      category: d((o) => String(o.category ?? '')),
      tier: d((o) => String(o.offerTiering ?? '')),
    };
  }, [included]);

  const filtered = useMemo(
    () =>
      included.filter(
        (o) =>
          (!pm || planningMonth(o) === pm) &&
          (!status || o.buildStatus === status) &&
          (!category || o.category === category) &&
          (!tier || o.offerTiering === tier),
      ),
    [included, pm, status, category, tier],
  );

  const rows = useMemo(() => filtered.map(computeRow), [filtered]);

  function exportCsv() {
    const headers = [
      'Offer Name', 'Offer Period', 'Fcst Activations', 'Fcst Bonused Members (Rate)', 'Fcst Spend/Member',
      'Fcst Bonus Pts (MDs)', 'Actual Activations', 'Actual Bonused Members (Rate)', 'Actual Spend/Member',
      'Actual Bonus Pts (MDs)', 'Actual Bonused Sales', '% Complete', 'Prorated Pts', 'Colour Code',
    ];
    const data = rows.map((r) => [
      r.name, r.period, r.fcstActivations, r.fcstMembersRate, r.fcstSpend, r.fcstBonusPts,
      r.actActivations, r.actMembersRate, r.actSpend, r.actBonusPts, r.actBonusedSales,
      r.pctComplete, r.prorated, r.colour,
    ]);
    downloadCsv('wbr', toCsv(headers, data));
    push(`Exported ${rows.length} rows to CSV.`, 'success');
  }

  return (
    <div>
      <PageHeader
        title="Weekly business review"
        count={rows.length}
        right={
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface">
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Sel label="Planning month" value={pm} options={opts.pm} onChange={setPm} />
        <Sel label="Status" value={status} options={opts.status} onChange={setStatus} />
        <Sel label="Category" value={category} options={opts.category} onChange={setCategory} />
        <Sel label="Tier" value={tier} options={opts.tier} onChange={setTier} />
        <span className="text-xs text-muted">Excludes Cancelled and Offer Design = IMP only.</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No offers match these filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead className="border-b border-border bg-surface text-muted">
              <tr>
                <th className="px-2 py-2 font-medium">Offer Name</th>
                <th className="px-2 py-2 font-medium">Period</th>
                <th className="px-2 py-2 text-right font-medium">Fcst Activations</th>
                <th className="px-2 py-2 text-right font-medium">Fcst Members (Rate)</th>
                <th className="px-2 py-2 text-right font-medium">Fcst Spend/Mbr</th>
                <th className="px-2 py-2 text-right font-medium">Fcst Bonus Pts ($)</th>
                <th className="px-2 py-2 text-right font-medium">Act Activations</th>
                <th className="px-2 py-2 text-right font-medium">Act Members (Rate)</th>
                <th className="px-2 py-2 text-right font-medium">Act Spend/Mbr</th>
                <th className="px-2 py-2 text-right font-medium">Act Bonus Pts ($)</th>
                <th className="px-2 py-2 text-right font-medium">Act Bonused Sales</th>
                <th className="px-2 py-2 text-right font-medium">% Complete</th>
                <th className="px-2 py-2 text-right font-medium">Prorated</th>
                <th className="px-2 py-2 font-medium">Colour</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.uid} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-2 py-1.5 font-medium text-ink">{r.name}</td>
                  <td className="px-2 py-1.5">{r.period}</td>
                  <td className="px-2 py-1.5 text-right">{r.fcstActivations || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{r.fcstMembersRate || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{r.fcstSpend}</td>
                  <td className="px-2 py-1.5 text-right">{r.fcstBonusPts}</td>
                  <td className="px-2 py-1.5 text-right">{r.actActivations || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{r.actMembersRate || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{r.actSpend}</td>
                  <td className="px-2 py-1.5 text-right">{r.actBonusPts}</td>
                  <td className="px-2 py-1.5 text-right">{r.actBonusedSales}</td>
                  <td className="px-2 py-1.5 text-right">{r.pctComplete || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{r.prorated || '—'}</td>
                  <td className="px-2 py-1.5">
                    {r.colour ? (
                      <span className={`rounded-full px-2 py-0.5 ${COLOUR_CHIP[r.colour]}`}>{r.colour}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select className="rounded-md border border-border px-2 py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
