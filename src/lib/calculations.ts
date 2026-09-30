// Every formula from spec section 8, implemented exactly.
// Constants come from reference.constants. "N/A", "", null count as no value.
// Never return NaN/Infinity/#N/A — callers render "Not entered" / "Not available".
import { format as fmtDate } from 'date-fns';
import { reference } from './dataLoaders';
import { isNoValue, toNumber, parseISO } from './format';
import type { OfferRecord, OfferValue } from './types';

const C = reference.constants;
export const BASE_POINTS_PER_DOLLAR = C.basePointsPerDollar; // 10
export const DOLLARS_PER_THOUSAND = C.dollarsPerThousandPoints; // 2
export const POINTS_UNIT = C.pointsUnit; // 1000

type Val = OfferValue | undefined;

/** Average of two numbers, ignoring missing values (Excel AVERAGE semantics). */
function avg(a: number | null, b: number | null): number | null {
  const xs = [a, b].filter((x): x is number => x !== null);
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function num(v: Val): number | null {
  return toNumber(v);
}

function daysBetweenInclusive(startISO: string, endISO: string): number | null {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e) return null;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// 8.1 Calendar computed fields
// ---------------------------------------------------------------------------

export function startMonth(o: OfferRecord): string | null {
  const d = parseISO(o.startDate);
  return d ? fmtDate(d, 'MMM yyyy') : null;
}

export function fiscalLookup(o: OfferRecord) {
  const key = typeof o.startDate === 'string' ? o.startDate.slice(0, 10) : '';
  return reference.fiscalCalendar[key] ?? null;
}

export function fiscalWeek(o: OfferRecord): string {
  return fiscalLookup(o)?.fw ?? 'Not available';
}
export function fiscalMonth(o: OfferRecord): string {
  return fiscalLookup(o)?.fm ?? 'Not available';
}
export function fiscalYear(o: OfferRecord): number | string {
  return fiscalLookup(o)?.fy ?? 'Not available';
}

export function softLockDate(o: OfferRecord): string {
  const key = typeof o.startDate === 'string' ? o.startDate.slice(0, 10) : '';
  return reference.softLockByStartDate[key] ?? 'Not in soft lock table';
}

export function numberOfDays(o: OfferRecord): number | null {
  if (isNoValue(o.startDate) || isNoValue(o.endDate)) return null;
  return daysBetweenInclusive(String(o.startDate), String(o.endDate));
}

export function dueDates(o: OfferRecord): string | null {
  const d = parseISO(o.startDate);
  return d ? `${fmtDate(d, 'MMM')}${fmtDate(d, 'yyyy')}` : null;
}

export function categoryConcat(o: OfferRecord): string | null {
  if (isNoValue(o.category) || isNoValue(o.subCategory)) return null;
  return `${o.category} - ${o.subCategory}`;
}

export function activationDescriptorLength(o: OfferRecord): number {
  return isNoValue(o.activationDescriptor) ? 0 : String(o.activationDescriptor).length;
}
export function canActivationDescriptorLength(o: OfferRecord): number {
  return isNoValue(o.canActivationDescriptor)
    ? 0
    : String(o.canActivationDescriptor).length;
}

export function includeForMetadata(o: OfferRecord): 'Yes' | 'No' {
  return o.buildStatus === 'Cancelled' ? 'No' : 'Yes';
}

export function includeForResultsForecast(o: OfferRecord): 'Yes' | 'No' {
  return o.buildStatus === 'Cancelled' || o.offerDesign === 'IMP only' ? 'No' : 'Yes';
}

export function startMonthNumber(o: OfferRecord): number | null {
  const d = parseISO(o.startDate);
  return d ? d.getMonth() + 1 : null;
}
export function startYear(o: OfferRecord): number | null {
  const d = parseISO(o.startDate);
  return d ? d.getFullYear() : null;
}

// ---------------------------------------------------------------------------
// 8.2 Forecast inputs to totals
// ---------------------------------------------------------------------------

export function totalOfferDays(o: OfferRecord): number | null {
  if (isNoValue(o.startDate) || isNoValue(o.endDate)) return null;
  if (isNoValue(o.earlyActivationDate)) {
    return daysBetweenInclusive(String(o.startDate), String(o.endDate));
  }
  return daysBetweenInclusive(String(o.earlyActivationDate), String(o.endDate));
}

export function activationLow(o: OfferRecord): number | null {
  const byDay = num(o.activationByDayLow);
  const days = totalOfferDays(o);
  return byDay === null || days === null ? null : byDay * days;
}
export function activationHigh(o: OfferRecord): number | null {
  const byDay = num(o.activationByDayHigh);
  const days = totalOfferDays(o);
  return byDay === null || days === null ? null : byDay * days;
}

const FORECAST_CATEGORIES = ['merch', 'services', 'loyalty', 'digital', 'redemption'];

export function forecastNeeded(o: OfferRecord): 'Yes' | 'No' {
  if (o.offerDesign === 'Activation Only - Internal Reward') return 'No';
  const cat = String(o.category ?? '').toLowerCase();
  // NOTE: Excel compares "Merch"/"Services" case-sensitively vs UPPER-case
  // dropdown values; per spec 8.2/15.4 we implement case-insensitive.
  const catMatch =
    FORECAST_CATEGORIES.includes(cat) ||
    (cat === 'benefit' && String(o.subCategory ?? '').toLowerCase() === 'birthday');
  const f = computeForecast(o);
  const redeemableLow = f.bonusRedeemableLow ?? 0;
  if (catMatch && redeemableLow === 0 && o.buildStatus !== 'Cancelled') return 'Yes';
  return 'No';
}

// ---------------------------------------------------------------------------
// 8.3 Forecast calculations
// ---------------------------------------------------------------------------

/** W = bonus point calculation factor. */
export function bonusPointFactor(o: OfferRecord): number | null {
  if (o.offerDesign === 'Multiplier') {
    if (isNoValue(o.multiplier)) return null;
    const m = parseInt(String(o.multiplier), 10);
    return Number.isFinite(m) ? m - 1 : null;
  }
  return num(o.fixedPoints);
}

export function redemptionRate(o: OfferRecord): number {
  const design = String(o.offerDesign ?? '');
  if (['Points donations', 'Extra entries', 'Limited Time Bonus Offer'].includes(design)) {
    return 1; // 100%
  }
  const d = parseISO(o.startDate);
  if (d && d >= new Date('2025-10-01T00:00:00')) return 0.88;
  return 0.85;
}

export interface ForecastResult {
  totalOfferDays: number | null;
  activationLow: number | null;
  activationHigh: number | null;
  activationAvg: number | null;
  bonusRateAvg: number | null;
  bonusedMembersLow: number | null;
  bonusedMembersHigh: number | null;
  bonusedMembersAvg: number | null;
  spendPerTxnAvg: number | null;
  bonusedSalesLow: number | null;
  bonusedSalesHigh: number | null;
  bonusedSalesAvg: number | null;
  basePointsLow: number | null;
  basePointsHigh: number | null;
  basePointsAvg: number | null;
  bonusPointsLow: number | null;
  bonusPointsHigh: number | null;
  bonusPointsAvg: number | null;
  basePointsRedeemableLow: number | null;
  basePointsRedeemableHigh: number | null;
  bonusPointsRedeemableLow: number | null;
  bonusPointsRedeemableHigh: number | null;
  bonusPointsRedeemableAvg: number | null;
  redemptionRate: number;
  bonusRedeemableLow: number | null;
  bonusRedeemableHigh: number | null;
  bonusRedeemableAvg: number | null;
  jbpLow: number | null;
  jbpHigh: number | null;
  jbpAvg: number | null;
  W: number | null;
}

function mul(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a * b;
}
function redeemable(points: number | null): number | null {
  return points === null ? null : (points / POINTS_UNIT) * DOLLARS_PER_THOUSAND;
}

export function computeForecast(o: OfferRecord): ForecastResult {
  const cancelled = o.buildStatus === 'Cancelled';
  const isMultiplier = o.offerDesign === 'Multiplier';
  const W = bonusPointFactor(o);

  const actLow = activationLow(o);
  const actHigh = activationHigh(o);
  const brLow = num(o.bonusRateLow);
  const brHigh = num(o.bonusRateHigh);

  const bmLow = mul(actLow, brLow);
  const bmHigh = mul(actHigh, brHigh);

  const spLow = num(o.avgSpendPerTxnLow);
  const spHigh = num(o.avgSpendPerTxnHigh);

  const bsLow = mul(spLow, bmLow);
  const bsHigh = mul(spHigh, bmHigh);

  const bpBaseLow = bsLow === null ? null : bsLow * BASE_POINTS_PER_DOLLAR;
  const bpBaseHigh = bsHigh === null ? null : bsHigh * BASE_POINTS_PER_DOLLAR;

  function bonusPoints(baseVal: number | null, membersVal: number | null): number | null {
    if (cancelled) return 0;
    if (W === null) return null;
    return isMultiplier ? mul(baseVal, W) : mul(membersVal, W);
  }
  const bonusPointsLow = bonusPoints(bpBaseLow, bmLow);
  const bonusPointsHigh = bonusPoints(bpBaseHigh, bmHigh);

  const basePointsRedeemableLow = redeemable(bpBaseLow);
  const basePointsRedeemableHigh = redeemable(bpBaseHigh);
  const bonusPointsRedeemableLow = redeemable(bonusPointsLow);
  const bonusPointsRedeemableHigh = redeemable(bonusPointsHigh);

  const rate = redemptionRate(o);
  const bonusRedeemableLow =
    bonusPointsRedeemableLow === null ? null : bonusPointsRedeemableLow * rate;
  const bonusRedeemableHigh =
    bonusPointsRedeemableHigh === null ? null : bonusPointsRedeemableHigh * rate;

  const jbpLow =
    basePointsRedeemableLow === null && bonusPointsRedeemableLow === null
      ? null
      : (basePointsRedeemableLow ?? 0) + (bonusPointsRedeemableLow ?? 0);
  const jbpHigh =
    basePointsRedeemableHigh === null && bonusPointsRedeemableHigh === null
      ? null
      : (basePointsRedeemableHigh ?? 0) + (bonusPointsRedeemableHigh ?? 0);

  return {
    totalOfferDays: totalOfferDays(o),
    activationLow: actLow,
    activationHigh: actHigh,
    activationAvg: avg(actLow, actHigh),
    bonusRateAvg: avg(brLow, brHigh),
    bonusedMembersLow: bmLow,
    bonusedMembersHigh: bmHigh,
    bonusedMembersAvg: avg(bmLow, bmHigh),
    spendPerTxnAvg: avg(spLow, spHigh),
    bonusedSalesLow: bsLow,
    bonusedSalesHigh: bsHigh,
    bonusedSalesAvg: avg(bsLow, bsHigh),
    basePointsLow: bpBaseLow,
    basePointsHigh: bpBaseHigh,
    basePointsAvg: avg(bpBaseLow, bpBaseHigh),
    bonusPointsLow,
    bonusPointsHigh,
    bonusPointsAvg: avg(bonusPointsLow, bonusPointsHigh),
    basePointsRedeemableLow,
    basePointsRedeemableHigh,
    bonusPointsRedeemableLow,
    bonusPointsRedeemableHigh,
    bonusPointsRedeemableAvg: avg(bonusPointsRedeemableLow, bonusPointsRedeemableHigh),
    redemptionRate: rate,
    bonusRedeemableLow,
    bonusRedeemableHigh,
    bonusRedeemableAvg: avg(bonusRedeemableLow, bonusRedeemableHigh),
    jbpLow,
    jbpHigh,
    jbpAvg: avg(jbpLow, jbpHigh),
    W,
  };
}

// ---------------------------------------------------------------------------
// 8.4 Results calculations
// ---------------------------------------------------------------------------

export interface ResultsResult {
  bonusRate: number | null; // null => "Not available"
  activationRate: number | null;
  bonusedSalesActual: number | 'TBD' | null;
  basePointsActual: number | null;
  basePointsRedeemableActual: number | null;
  bonusPointsRedeemableActual: number | null;
  bonusRedeemableActualWithBreakage: number | null;
  spendPerBonusedMember: number | null;
  ltbpOutstanding: number | null;
  ltbpRemoved: number | null;
}

export function computeResults(o: OfferRecord): ResultsResult {
  const activations = num(o.activations);
  const bonusedMembers = num(o.bonusedMembers);
  const audienceSize = num(o.audienceSize);
  const bonusPts = num(o.bonusPtsIssued);
  const isMultiplier = o.offerDesign === 'Multiplier';
  const isLTBO = o.offerDesign === 'Limited Time Bonus Offer';
  const W = bonusPointFactor(o);
  const rate = redemptionRate(o);
  const fixed = num(o.fixedPoints);

  const bonusRate =
    activations !== null && activations !== 0 && bonusedMembers !== null
      ? bonusedMembers / activations
      : null;

  const activationRate =
    activations !== null && audienceSize !== null && audienceSize !== 0
      ? activations / audienceSize
      : null;

  let bonusedSalesActual: number | 'TBD' | null;
  if (isMultiplier) {
    bonusedSalesActual =
      bonusPts !== null && W !== null && W !== 0
        ? bonusPts / W / BASE_POINTS_PER_DOLLAR
        : null;
  } else {
    bonusedSalesActual = 'TBD';
  }

  const bsActualNum = typeof bonusedSalesActual === 'number' ? bonusedSalesActual : null;
  const basePointsActual = bsActualNum === null ? null : BASE_POINTS_PER_DOLLAR * bsActualNum;
  const basePointsRedeemableActual = redeemable(basePointsActual);
  const bonusPointsRedeemableActual = redeemable(bonusPts);
  const bonusRedeemableActualWithBreakage =
    bonusPointsRedeemableActual === null ? null : rate * bonusPointsRedeemableActual;

  const spendPerBonusedMember =
    bsActualNum !== null && bonusedMembers !== null && bonusedMembers !== 0
      ? bsActualNum / bonusedMembers
      : null;

  const ltbpOutstanding =
    isLTBO && fixed !== null && activations !== null ? fixed * activations : null;
  const ltbpRemoved =
    isLTBO && o.buildStatus === 'Completed' && ltbpOutstanding !== null && bonusPts !== null
      ? ltbpOutstanding - bonusPts
      : null;

  return {
    bonusRate,
    activationRate,
    bonusedSalesActual,
    basePointsActual,
    basePointsRedeemableActual,
    bonusPointsRedeemableActual,
    bonusRedeemableActualWithBreakage,
    spendPerBonusedMember,
    ltbpOutstanding,
    ltbpRemoved,
  };
}

/** Helper: Bonus Pts Issued from fixed points (Fixed Point offers; user confirms). */
export function bonusPtsFromFixed(o: OfferRecord): number | null {
  const bm = num(o.bonusedMembers);
  const fixed = num(o.fixedPoints);
  return bm === null || fixed === null ? null : bm * fixed;
}

// ---------------------------------------------------------------------------
// Dispatcher: value for any computed field id (for FieldRenderer / dictionary)
// ---------------------------------------------------------------------------

export function computedFieldValue(fieldId: string, o: OfferRecord): OfferValue | null {
  const f = () => computeForecast(o);
  switch (fieldId) {
    case 'startMonth':
      return startMonth(o);
    case 'fiscalWeek':
      return fiscalWeek(o);
    case 'softLockDate':
      return softLockDate(o);
    case 'numberOfDays':
      return numberOfDays(o);
    case 'dueDates':
      return dueDates(o);
    case 'categoryConcat':
      return categoryConcat(o);
    case 'activationDescriptorLength':
      return activationDescriptorLength(o);
    case 'canActivationDescriptorLength':
      return canActivationDescriptorLength(o);
    case 'includeForMetadata':
      return includeForMetadata(o);
    case 'includeForResultsForecast':
      return includeForResultsForecast(o);
    case 'startMonthNumber':
      return startMonthNumber(o);
    case 'startYear':
      return startYear(o);
    case 'forecastNeeded':
      return forecastNeeded(o);
    case 'totalOfferDays':
      return totalOfferDays(o);
    case 'activationLow':
      return f().activationLow;
    case 'activationHigh':
      return f().activationHigh;
    case 'bonusedMembersLow':
      return f().bonusedMembersLow;
    case 'bonusedMembersHigh':
      return f().bonusedMembersHigh;
    case 'bonusedSalesLow':
      return f().bonusedSalesLow;
    case 'bonusedSalesHigh':
      return f().bonusedSalesHigh;
    case 'bonusRedeemableLow':
      return f().bonusRedeemableLow;
    case 'bonusRedeemableHigh':
      return f().bonusRedeemableHigh;
    // Retired in product — not implemented (shown as note in Data Dictionary).
    case 'metadataRefNumber':
    case 'resultsForecastRefNumber':
      return null;
    default:
      return null;
  }
}
