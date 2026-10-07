// Every formula from spec section 8, implemented exactly.
// Constants come from reference.constants. "N/A", "", null count as no value.
// Never return NaN/Infinity/#N/A — callers render "Not entered" / "Not available".
import { format as fmtDate, addDays } from 'date-fns';
import { reference, fieldsById } from './dataLoaders';
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

/** Draft (prototype-only) and blank status are excluded from all downstream views. */
function isExcludedStatus(o: OfferRecord): boolean {
  const s = String(o.buildStatus ?? '');
  return s === '' || s === 'Draft';
}

export function includeForMetadata(o: OfferRecord): 'Yes' | 'No' {
  // C3: status is set and not Cancelled. Drafts excluded.
  if (isExcludedStatus(o) || o.buildStatus === 'Cancelled') return 'No';
  return 'Yes';
}

export function includeForResultsForecast(o: OfferRecord): 'Yes' | 'No' {
  // B1: No if Cancelled or Offer Design = "IMP only". Drafts/blank excluded.
  if (isExcludedStatus(o) || o.buildStatus === 'Cancelled' || o.offerDesign === 'IMP only') {
    return 'No';
  }
  return 'Yes';
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
  // §8.4: actual-results breakage uses the ACTUAL redemption rule (different from
  // the forecast rule in redemptionRate / "Fcst - Assumed Redemption Rate").
  const rate = redemptionRateActual(o);
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

// ===========================================================================
// 8.6 Metadata-only calculations (traced from the Metadata "Master Sheet").
// Some inputs are typed only in the Metadata file and are not captured in our
// form; those return NOT_CAPTURED so the UI shows "Not captured in the calendar
// form". Never return NaN/Infinity.
// ===========================================================================

/** Sentinel: the value is typed only in the Metadata file, not in the calendar. */
export const NOT_CAPTURED = '__NOT_CAPTURED__';

const DAY_MS = 86_400_000;
function midnight(d: Date): Date {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

/** (2) Offer Status — NOT buildStatus; derived from today vs start/end. */
export function offerStatus(o: OfferRecord, today: Date = new Date()): string {
  const s = parseISO(o.startDate);
  const e = parseISO(o.endDate);
  const t = midnight(today);
  if (!s) return 'Not Started';
  if (e && t >= s && t < e) return 'Live';
  if (e && t >= e) return 'Completed';
  if (!e && t >= s) return 'Live';
  return 'Not Started';
}

/** (3) Early Activation # of days = startDate - earlyActivationDate (0 if none). */
export function earlyActivationDays(o: OfferRecord): number {
  if (isNoValue(o.earlyActivationDate)) return 0;
  const s = parseISO(o.startDate);
  const ea = parseISO(o.earlyActivationDate);
  if (!s || !ea) return 0;
  return Math.round((s.getTime() - ea.getTime()) / DAY_MS);
}

/** (9) Actual-results redemption rate — a DIFFERENT rule from the forecast rate. */
export function redemptionRateActual(o: OfferRecord): number {
  if (o.offerDesign === 'Limited Time Bonus Offer' || o.category === 'REDEMPTION') return 1;
  const d = parseISO(o.startDate);
  if (d && d >= new Date('2025-10-01T00:00:00')) return 0.88;
  if (d && d >= new Date('2024-11-01T00:00:00')) return 0.85;
  return 0.8;
}

/** (11-13) Transaction Type External Ref lookup by "Transaction Type". Blank if not found. */
function lookupTxnRef(value: OfferValue | undefined): string {
  if (isNoValue(value)) return '';
  const row = reference.transactionTypes.find(
    (r) => String(r['Transaction Type']) === String(value),
  );
  const ref = row ? row['Transaction Type External Ref'] : null;
  return ref === null || ref === undefined ? '' : String(ref);
}
export function txnRefFixedPointBack(o: OfferRecord): string {
  return lookupTxnRef(o.txnTypeFixedPointBack);
}
export function txnRefUploadPts(o: OfferRecord): string {
  return lookupTxnRef(o.txnTypeUploadPts);
}
export function txnRefRemovePts(o: OfferRecord): string {
  return lookupTxnRef(o.txnTypeRemovePts);
}

/** (16) Activation during promo window = activations - Early Activation count (not captured). */
export function activationDuringPromo(_o: OfferRecord): string {
  return NOT_CAPTURED;
}

/** (17) Points Issued per day = bonusPtsIssued / numberOfDays. */
export function pointsIssuedPerDay(o: OfferRecord): number | null {
  const pts = num(o.bonusPtsIssued);
  const days = numberOfDays(o);
  if (pts === null || days === null || days === 0) return null;
  return pts / days;
}

/** (18) Spend per unique bonused member — unique count not captured. */
export function spendPerUniqueBonusedMember(_o: OfferRecord): string {
  return NOT_CAPTURED;
}

/** (19) Redemption Pts (Charities OR TRSG): bonusedMembers x W x -1 for ENTRIES / POINTS DONATION. */
export function redemptionPts(o: OfferRecord): number | null {
  const sub = String(o.subCategory ?? '');
  if (sub !== 'ENTRIES' && sub !== 'POINTS DONATION') return null;
  const bm = num(o.bonusedMembers);
  const W = bonusPointFactor(o);
  if (bm === null || W === null) return null;
  return bm * W * -1;
}

/** (20) Value of Redemption Pts (100%) = (redemptionPts / 1000) x 2. */
export function redemptionPtsValue(o: OfferRecord): number | null {
  const rp = redemptionPts(o);
  if (rp === null) return null;
  return (rp / POINTS_UNIT) * DOLLARS_PER_THOUSAND;
}

/** (21) Currency: CAD if CAN; USD if US/USPR; else Blended. */
export function currency(o: OfferRecord): 'USD' | 'CAD' | 'Blended' {
  const c = String(o.country ?? '');
  if (c === 'CAN') return 'CAD';
  if (c === 'US' || c === 'USPR') return 'USD';
  return 'Blended';
}

/** (28) Record Date (Activations) = endDate + 1 day. */
export function recordDateActivations(o: OfferRecord): string | null {
  const e = parseISO(o.endDate);
  return e ? fmtDate(addDays(e, 1), 'yyyy-MM-dd') : null;
}
/** (29) Record Date (Member Bonused & Bonus Points Issued) = endDate + 5 days. */
export function recordDateBonus(o: OfferRecord): string | null {
  const e = parseISO(o.endDate);
  return e ? fmtDate(addDays(e, 5), 'yyyy-MM-dd') : null;
}

const DIVISION_FLAGS = [
  'hardgoodsOffer',
  'consumablesOffer',
  'specialtyOffer',
  'servicesOffer',
  'charitiesOffer',
];
function divisionYesCount(o: OfferRecord): number {
  return DIVISION_FLAGS.reduce((n, id) => n + (o[id] === 'Yes' ? 1 : 0), 0);
}
/** (30) Multiple Divisions = Yes if more than one division flag is Yes. */
export function multipleDivisions(o: OfferRecord): 'Yes' | 'No' {
  return divisionYesCount(o) > 1 ? 'Yes' : 'No';
}
/** (31) Count of divisions if Multiple (less 1). */
export function divisionCountLess1(o: OfferRecord): number {
  return multipleDivisions(o) === 'Yes' ? divisionYesCount(o) - 1 : 0;
}
/** (32) Sum pts issued if Multiple = bonusPtsIssued x divisionCountLess1. */
export function sumPtsIfMultiple(o: OfferRecord): number {
  if (multipleDivisions(o) !== 'Yes') return 0;
  return (num(o.bonusPtsIssued) ?? 0) * divisionCountLess1(o);
}
/** (33) Sum Redeemable $ with breakage if Multiple. */
export function sumRedeemableIfMultiple(o: OfferRecord): number {
  if (multipleDivisions(o) !== 'Yes') return 0;
  return (computeResults(o).bonusRedeemableActualWithBreakage ?? 0) * divisionCountLess1(o);
}
/** (34) Check: N/A unless Multiple; then the % share columns are typed only in Metadata. */
export function divisionShareCheck(o: OfferRecord): string {
  return multipleDivisions(o) !== 'Yes' ? 'N/A' : NOT_CAPTURED;
}

/** (35) Promotional bonus points per $ (multiplier only) = 10 x W. */
export function promoBonusPtsPerDollar(o: OfferRecord): number | null {
  if (o.offerDesign !== 'Multiplier') return null;
  const W = bonusPointFactor(o);
  return W === null ? null : BASE_POINTS_PER_DOLLAR * W;
}

const REVERSAL_SETUPS = new Set([
  'Transaction Bonus Promotion',
  'Transaction Product Bonus Promotion',
  'Transaction Product Quantity Bonus Promotion',
  'Transaction Product Value Bonus Promotion',
]);
/** (36) Eligible for Bonus Points Reversal on Return (Yes). */
export function eligibleForReversal(o: OfferRecord): string | null {
  return REVERSAL_SETUPS.has(String(o.kognitivOfferSetupType)) ? 'Yes' : null;
}

/** (37) Promo days (Prorated) — copies the Excel formula, including the early-
 *  activation branch which caps at the early-activation day count. */
export function promoDaysProrated(o: OfferRecord, today: Date = new Date()): number | null {
  const t = midnight(today);
  const nDays = numberOfDays(o);
  if (isNoValue(o.earlyActivationDate)) {
    const s = parseISO(o.startDate);
    if (!s || nDays === null) return null;
    if (t < s) return null; // blank before the offer starts
    return Math.min(Math.round((t.getTime() - s.getTime()) / DAY_MS), nDays);
  }
  const ea = parseISO(o.earlyActivationDate);
  if (!ea) return null;
  if (t < ea) return null; // blank before early activation
  // Excel caps this branch at calc.earlyActivationDays (the pre-start day count).
  return Math.min(Math.round((t.getTime() - ea.getTime()) / DAY_MS), earlyActivationDays(o));
}

/** (38) Activation per day (Prorated) = activations / (promoDaysProrated + earlyActivationDays). */
export function activationPerDayProrated(o: OfferRecord, today: Date = new Date()): number | null {
  const pdp = promoDaysProrated(o, today);
  const act = num(o.activations);
  if (pdp === null || act === null) return null;
  const denom = pdp + earlyActivationDays(o);
  if (denom === 0) return null;
  return act / denom;
}

/** (39) Bonus Points per day (Prorated) = (bonusPtsIssued / promoDaysProrated) x numberOfDays. */
export function bonusPtsPerDayProrated(o: OfferRecord, today: Date = new Date()): number | null {
  const pdp = promoDaysProrated(o, today);
  const pts = num(o.bonusPtsIssued);
  const nDays = numberOfDays(o);
  if (pdp === null || pdp === 0 || pts === null || nDays === null) return null;
  return (pts / pdp) * nDays;
}

// ---------------------------------------------------------------------------
// Resolve a metadata / submission-form calendarFieldId to a display value.
// Used by the Data Feed preview and the Inspire submission-form preview.
// ---------------------------------------------------------------------------

function calcMapFor(o: OfferRecord): Record<string, unknown> {
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
    // 8.6 metadata-only keys
    offerStatus: offerStatus(o),
    earlyActivationDays: earlyActivationDays(o),
    redemptionRateActual: redemptionRateActual(o),
    txnRefFixedPointBack: txnRefFixedPointBack(o),
    txnRefUploadPts: txnRefUploadPts(o),
    txnRefRemovePts: txnRefRemovePts(o),
    activationDuringPromo: activationDuringPromo(o),
    pointsIssuedPerDay: pointsIssuedPerDay(o),
    spendPerUniqueBonusedMember: spendPerUniqueBonusedMember(o),
    redemptionPts: redemptionPts(o),
    redemptionPtsValue: redemptionPtsValue(o),
    currency: currency(o),
    recordDateActivations: recordDateActivations(o),
    recordDateBonus: recordDateBonus(o),
    multipleDivisions: multipleDivisions(o),
    divisionCountLess1: divisionCountLess1(o),
    sumPtsIfMultiple: sumPtsIfMultiple(o),
    sumRedeemableIfMultiple: sumRedeemableIfMultiple(o),
    divisionShareCheck: divisionShareCheck(o),
    promoBonusPtsPerDollar: promoBonusPtsPerDollar(o),
    eligibleForReversal: eligibleForReversal(o),
    promoDaysProrated: promoDaysProrated(o),
    activationPerDayProrated: activationPerDayProrated(o),
    bonusPtsPerDayProrated: bonusPtsPerDayProrated(o),
  };
}

function fmtValue(v: unknown): string {
  if (isNoValue(v)) return v === 'N/A' ? 'N/A' : 'Not entered';
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(v);
}

export function resolveCalendarFieldValue(
  calendarFieldId: string | null | undefined,
  o: OfferRecord,
): { text: string; captured: boolean } {
  if (!calendarFieldId) return { text: 'Not captured in the calendar form', captured: false };
  if (calendarFieldId.startsWith('calc.')) {
    const v = calcMapFor(o)[calendarFieldId.slice(5)];
    if (v === NOT_CAPTURED) return { text: 'Not captured in the calendar form', captured: false };
    return { text: fmtValue(v), captured: true };
  }
  const f = fieldsById[calendarFieldId];
  if (f && f.control === 'computed') {
    return { text: fmtValue(computedFieldValue(calendarFieldId, o)), captured: true };
  }
  return { text: fmtValue(o[calendarFieldId]), captured: true };
}
