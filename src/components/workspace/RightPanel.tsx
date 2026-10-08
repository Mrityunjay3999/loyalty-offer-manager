import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Info, ListChecks, CheckCircle2, Circle, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ValidationSummary } from '@/components/ValidationSummary';
import { TagPill } from '@/components/TagPill';
import { toCalendarOffers, offersInRange } from '@/lib/calendar';
import {
  fiscalWeek,
  softLockDate,
  computeForecast,
  computeResults,
  startMonth,
} from '@/lib/calculations';
import { checklistProgress } from '@/lib/offers';
import { subCategoriesForCategory } from '@/lib/options';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  parseISO,
} from '@/lib/format';
import * as wbr from '@/lib/wbr';
import type { OfferRecord, OfferSetupCombo } from '@/lib/types';
import type { Issue } from '@/lib/validation';
import { checklistFields } from '@/lib/dataLoaders';

function num(v: number | null, digits = 0): string {
  return v === null ? '—' : formatNumber(v, digits);
}
function cur(v: number | null): string {
  return v === null ? '—' : formatCurrency(v);
}

export function RightPanel({
  offer,
  step,
  errors,
  warnings,
  onJump,
  onApplyCombo,
}: {
  offer: OfferRecord;
  step: string;
  errors: Issue[];
  warnings: Issue[];
  onJump: (fieldId: string) => void;
  onApplyCombo: (combo: OfferSetupCombo) => void;
}) {
  const [tab, setTab] = useState<'context' | 'validation'>('context');

  return (
    <div className="sticky top-4 rounded-lg border border-border bg-white">
      <div className="flex border-b border-border">
        <TabBtn active={tab === 'context'} onClick={() => setTab('context')}>
          Context
        </TabBtn>
        <TabBtn active={tab === 'validation'} onClick={() => setTab('validation')}>
          Validation
          {errors.length > 0 && (
            <span className="ml-1 rounded-full bg-danger px-1.5 text-xs text-white">
              {errors.length}
            </span>
          )}
        </TabBtn>
      </div>
      <div className="p-3">
        {tab === 'validation' ? (
          <ValidationSummary errors={errors} warnings={warnings} onJump={onJump} />
        ) : (
          <StepContext offer={offer} step={step} onApplyCombo={onApplyCombo} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-sm font-medium ${
        active ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function StepContext({
  offer,
  step,
  onApplyCombo,
}: {
  offer: OfferRecord;
  step: string;
  onApplyCombo: (combo: OfferSetupCombo) => void;
}) {
  const tieringDefinitions = useAppStore((s) => s.tieringDefinitions);
  const categorySubCategory = useAppStore((s) => s.categorySubCategory);
  const offerSetupCombos = useAppStore((s) => s.offerSetupCombos);
  const dropdowns = useAppStore((s) => s.dropdowns);
  const allOffers = useAppStore((s) => s.offers);
  const navigate = useNavigate();

  if (step === '1. Request & Timing') {
    const sl = softLockDate(offer);
    const slDate = parseISO(sl);
    let daysUntil: string = '—';
    if (slDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = Math.round((slDate.getTime() - today.getTime()) / 86_400_000);
      daysUntil = d >= 0 ? `${d} days` : `${Math.abs(d)} days ago`;
    }
    const start = parseISO(offer.startDate);
    const end = parseISO(offer.endDate);
    let overlap: { n: number; b: number; t: number } | null = null;
    if (start && end) {
      const others = offersInRange(toCalendarOffers(allOffers), start, end, offer._uid);
      overlap = {
        n: others.length,
        b: others.filter((o) => o.group === 'Broad').length,
        t: others.filter((o) => o.group === 'Targeted').length,
      };
    }
    return (
      <>
        <Card title="Soft lock & fiscal">
          <dl className="space-y-1.5 text-sm">
            <Row label="Planning month" value={startMonth(offer) ?? '—'} />
            <Row label="Fiscal Week" value={fiscalWeek(offer)} />
            <Row label="Soft Lock Date" value={sl} />
            <Row label="Days until soft lock" value={daysUntil} />
          </dl>
        </Card>
        {overlap && (
          <Card title="Calendar overlap">
            <p className="text-xs text-ink">
              {overlap.n} other offer{overlap.n === 1 ? '' : 's'} run during these dates
              {' '}({overlap.b} Broad, {overlap.t} Targeted).
            </p>
            <button
              onClick={() => navigate(`/calendar?offer=${offer._uid ?? ''}`)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CalendarDays size={12} /> View on calendar
            </button>
            <div className="mt-1.5"><TagPill kind="Phase 2" /></div>
            <p className="mt-1 text-[11px] text-muted">Information only. This never blocks saving or submitting.</p>
          </Card>
        )}
      </>
    );
  }

  if (step === '2. Offer Basics') {
    const subs = subCategoriesForCategory(
      offer.category,
      categorySubCategory,
      dropdowns.planningSubCategory ?? [],
    );
    return (
      <>
        <Card title="Offer tiering definitions">
          <ul className="space-y-1.5 text-xs">
            {tieringDefinitions.map((t) => (
              <li key={t.tier}>
                <span className="font-semibold text-ink">{t.tier}</span>{' '}
                <span className="text-muted">{t.description}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Valid sub-categories${offer.category ? ` for ${offer.category}` : ''}`}>
          {offer.category ? (
            <div className="flex flex-wrap gap-1">
              {subs.map((s) => (
                <span key={s} className="rounded border border-border px-1.5 py-0.5 text-xs">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Choose a Category to see its sub-categories.</p>
          )}
        </Card>
      </>
    );
  }

  if (step === '5. Loyalty Platform Setup') {
    const design = offer.offerDesign;
    const combos = offerSetupCombos.filter((c) => c.offerDesign === design);
    return (
      <Card title="Common setups for this Offer Design">
        {!design ? (
          <p className="text-xs text-muted">Choose an Offer Design to see common setups.</p>
        ) : combos.length === 0 ? (
          <p className="text-xs text-muted">No documented setups for {String(design)}.</p>
        ) : (
          <ul className="space-y-2">
            {combos.map((c, i) => (
              <li key={i}>
                <button
                  onClick={() => onApplyCombo(c)}
                  className="w-full rounded-md border border-border p-2 text-left text-xs hover:border-primary hover:bg-surface"
                >
                  <div>
                    <span className="text-muted">Activation:</span> {c.activationSetupType}
                  </div>
                  <div>
                    <span className="text-muted">Setup:</span> {c.offerSetupType}
                  </div>
                  <div>
                    <span className="text-muted">Opt-In:</span> {c.optInMethod}
                  </div>
                  <span className="mt-1 inline-block text-primary">Apply this setup →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  if (step === '7. Forecast') {
    const f = computeForecast(offer);
    const isJbp = offer.offset === 'JBP';
    return (
      <Card title="Forecast summary">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="pb-1 text-left font-medium">Metric</th>
              <th className="pb-1 text-right font-medium">Low</th>
              <th className="pb-1 text-right font-medium">High</th>
              <th className="pb-1 text-right font-medium">Avg</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <FRow label="Activations" lo={num(f.activationLow)} hi={num(f.activationHigh)} avg={num(f.activationAvg)} />
            <FRow label="Bonused members" lo={num(f.bonusedMembersLow)} hi={num(f.bonusedMembersHigh)} avg={num(f.bonusedMembersAvg)} />
            <FRow label="Bonused sales" lo={cur(f.bonusedSalesLow)} hi={cur(f.bonusedSalesHigh)} avg={cur(f.bonusedSalesAvg)} />
            <FRow label="Bonus points" lo={num(f.bonusPointsLow)} hi={num(f.bonusPointsHigh)} avg={num(f.bonusPointsAvg)} />
            <FRow label="Redeemable $ (100%)" lo={cur(f.bonusPointsRedeemableLow)} hi={cur(f.bonusPointsRedeemableHigh)} avg={cur(f.bonusPointsRedeemableAvg)} />
            <FRow label={`Redeemable $ (breakage ${formatPercent(f.redemptionRate, 0)})`} lo={cur(f.bonusRedeemableLow)} hi={cur(f.bonusRedeemableHigh)} avg={cur(f.bonusRedeemableAvg)} />
            {isJbp && <FRow label="JBP total" lo={cur(f.jbpLow)} hi={cur(f.jbpHigh)} avg={cur(f.jbpAvg)} />}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Total offer days: {num(f.totalOfferDays)}</p>
      </Card>
    );
  }

  if (step === '8. Build Checklist') {
    const { done, total } = checklistProgress(offer);
    return (
      <Card title="Checklist progress">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="text-sm tabular-nums text-muted">{done} / {total}</span>
        </div>
        <ul className="space-y-1 text-xs">
          {checklistFields.map((f) => {
            const v = offer[f.id];
            const doneItem = v === 'Yes' || v === 'Partially' || v === 'N/A';
            return (
              <li key={f.id} className="flex items-center gap-1.5">
                {doneItem ? (
                  <CheckCircle2 size={13} className="text-success" />
                ) : (
                  <Circle size={13} className="text-muted" />
                )}
                <span className={doneItem ? 'text-ink' : 'text-muted'}>{f.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex items-start gap-1 text-xs text-muted">
          <ListChecks size={13} className="mt-0.5 shrink-0" />
          Status changes happen from the lifecycle bar; guards check these items.
        </p>
      </Card>
    );
  }

  if (step === '9. Results') {
    const r = computeResults(offer);
    const f = computeForecast(offer);
    const numberOfDays = (() => {
      const s = parseISO(offer.startDate);
      const e = parseISO(offer.endDate);
      return s && e ? Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1 : null;
    })();
    const elapsed = wbr.daysElapsed(offer.startDate, numberOfDays);
    const pct = wbr.percentComplete(elapsed, numberOfDays);
    const prorated = wbr.proratedPoints(typeof offer.bonusPtsIssued === 'number' ? offer.bonusPtsIssued : null, pct);
    return (
      <>
        <Card title="Results summary">
          <dl className="space-y-1.5 text-sm">
            <Row label="Bonus rate" value={r.bonusRate === null ? 'Not available' : formatPercent(r.bonusRate, 1)} />
            <Row label="Activation rate" value={r.activationRate === null ? '—' : formatPercent(r.activationRate, 1)} />
            <Row label="Bonused sales (actual)" value={typeof r.bonusedSalesActual === 'number' ? formatCurrency(r.bonusedSalesActual) : 'TBD'} />
            <Row label="Redeemable $ (w/ breakage)" value={cur(r.bonusRedeemableActualWithBreakage)} />
            <Row label="Spend / bonused member" value={cur(r.spendPerBonusedMember)} />
          </dl>
        </Card>
        <Card title="WBR strings">
          <dl className="space-y-1.5 text-xs">
            <Row label="Actual activations" value={wbr.actualActivations(typeof offer.activations === 'number' ? offer.activations : null) || '—'} />
            <Row label="Actual bonus pts (MDs)" value={wbr.forecastBonusPts(typeof offer.bonusPtsIssued === 'number' ? offer.bonusPtsIssued : null, r.bonusRedeemableActualWithBreakage)} />
            <Row label="% complete by days" value={pct === null ? '—' : formatPercent(pct, 0)} />
            <Row
              label="Colour code"
              value={wbr.colourCode(prorated, f.bonusPointsLow, f.bonusPointsHigh) || '—'}
            />
          </dl>
        </Card>
      </>
    );
  }

  if (step === 'Review') {
    return (
      <Card title="Before you submit">
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0" />
          Submitting runs full validation. All required fields must be valid; the offer then
          becomes Proposed.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Context">
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Calculator size={14} className="mt-0.5 shrink-0" />
        Computed fields update automatically as you fill the form.
      </p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
function FRow({ label, lo, hi, avg }: { label: string; lo: string; hi: string; avg: string }) {
  return (
    <tr className="border-t border-border/60">
      <td className="py-1 pr-2 text-muted">{label}</td>
      <td className="py-1 text-right">{lo}</td>
      <td className="py-1 text-right">{hi}</td>
      <td className="py-1 text-right font-medium">{avg}</td>
    </tr>
  );
}
