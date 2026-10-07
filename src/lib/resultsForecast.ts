// Results & Forecast module (Package B). Reproduces today's "LIVE - Results and
// Forecast" Excel tab (columns A..BZ). The FORECAST block equals the existing
// computeForecast (section 8.3); the RESULTS and WBR blocks are implemented here
// because they differ (TBD strings, the forecast redemption rule for actuals,
// and the exact Excel WBR text formulas). Linked to offers by Offer ID only.
import { format as fmtDate } from 'date-fns';
import {
  computeForecast,
  bonusPointFactor,
  redemptionRate,
  numberOfDays,
  includeForResultsForecast,
} from './calculations';
import { toNumber, parseISO } from './format';
import type { OfferRecord } from './types';

const V = 2; // $ per 1,000 points
const X = 10; // base pts per $

/** Excel ROUND: round half away from zero to `d` decimals. */
export function excelRound(x: number, d = 0): number {
  const f = 10 ** d;
  const r = Math.round(Math.abs(x) * f + 1e-9) / f;
  return x < 0 ? -r : r;
}
/** Excel ROUNDDOWN: truncate toward zero to `d` decimals. */
export function excelRoundDown(x: number, d = 0): number {
  const f = 10 ** d;
  return Math.trunc(x * f) / f;
}

function num(v: unknown): number | null {
  return toNumber(v);
}

export type RfNum = number | null;
export type RfResult = number | 'TBD' | null;

export interface RfRow {
  // RESULTS (actuals)
  ltbpOutstanding: RfNum; // S
  ltbpRemoved: RfNum; // T
  bonusRate: RfNum; // U  (null => "Not available")
  bonusPointCalc: RfNum; // W
  bonusedSales: RfResult; // Y
  basePoints: RfResult; // Z
  basePointsRedeemable: RfResult; // AA
  bonusPointsRedeemable: RfNum; // AB
  redemptionRateResults: number; // AC
  bonusRedeemableWithBreakage: RfNum; // AD
  spendPerBonusedMember: RfResult; // AE
  // FORECAST (from computeForecast)
  activationLow: RfNum; // AF
  activationHigh: RfNum; // AG
  bonusRateLowIn: RfNum; // AH
  bonusRateHighIn: RfNum; // AI
  avgSpendLowIn: RfNum; // AJ
  avgSpendHighIn: RfNum; // AK
  activationAvg: RfNum; // AL
  bonusRateAvg: RfNum; // AM
  bonusedMembersLow: RfNum; // AN
  bonusedMembersHigh: RfNum; // AO
  bonusedMembersAvg: RfNum; // AP
  spendPerTxnAvg: RfNum; // AQ
  bonusedSalesLow: RfNum; // AR
  bonusedSalesHigh: RfNum; // AS
  bonusedSalesAvg: RfNum; // AT
  basePointsLow: RfNum; // AU
  basePointsHigh: RfNum; // AV
  basePointsAvg: RfNum; // AW
  bonusPointsLow: RfNum; // AX
  bonusPointsHigh: RfNum; // AY
  bonusPointsAvg: RfNum; // AZ
  basePointsRedeemableLow: RfNum; // BA
  basePointsRedeemableHigh: RfNum; // BB
  bonusPointsRedeemableLow: RfNum; // BC
  bonusPointsRedeemableHigh: RfNum; // BD
  bonusPointsRedeemableAvg: RfNum; // BE
  redemptionRateForecast: number; // BF
  bonusRedeemableLow: RfNum; // BG
  bonusRedeemableHigh: RfNum; // BH
  bonusRedeemableAvg: RfNum; // BI
  jbpLow: RfNum; // BJ
  jbpHigh: RfNum; // BK
  jbpAvg: RfNum; // BL
  // WBR strings
  wbrOfferPeriod: string; // BM
  wbrFcstActivations: string; // BN
  wbrFcstBonused: string; // BO
  wbrFcstSpend: string; // BP
  wbrFcstBonusPts: string; // BQ
  wbrActActivations: string; // BR
  wbrActBonused: string; // BS
  wbrActSpend: string; // BT
  wbrActBonusPts: string; // BU
  wbrActBonusedSales: string; // BV
  daysElapsed: RfNum; // BW
  pctComplete: RfNum; // BX
  proratedPts: RfNum; // BY
  colourCode: '' | 'Pink' | 'Light green' | 'Dark Green'; // BZ
}

/** Big-number MD style used in WBR points cells: >=1B -> "1.2B", >=1M -> "1M" (0 dp), else "..K" (0 dp). */
function ptsMD(n: number): string {
  if (n >= 1e9) return `${excelRound(n / 1e9, 1)}B`;
  if (n >= 1e6) return `${excelRound(n / 1e6, 0)}M`;
  return `${excelRound(n / 1000, 0)}K`;
}
/** Dollar MD style for the "($..)" part: >=1M -> "$1M", >=1K -> "$1K", else "$n" (all 0 dp). */
function dollarMD(n: number): string {
  if (n >= 1e6) return `$${excelRound(n / 1e6, 0)}M`;
  if (n >= 1e3) return `$${excelRound(n / 1e3, 0)}K`;
  return `$${excelRound(n, 0)}`;
}

export function computeResultsForecast(o: OfferRecord, today: Date = new Date()): RfRow {
  const f = computeForecast(o);
  const W = bonusPointFactor(o); // W
  const isMultiplier = o.offerDesign === 'Multiplier';
  const isLTBO = o.offerDesign === 'Limited Time Bonus Offer';

  const P = num(o.activations);
  const Q = num(o.bonusedMembers);
  const R = num(o.bonusPtsIssued);
  const N = num(o.fixedPoints);

  // --- RESULTS ---
  const ltbpOutstanding = isLTBO && N !== null && P !== null ? N * P : null; // S
  const ltbpRemoved =
    o.buildStatus === 'Completed' && isLTBO && ltbpOutstanding !== null && R !== null
      ? ltbpOutstanding - R
      : null; // T
  const bonusRate = P !== null && P !== 0 && Q !== null ? Q / P : null; // U

  let bonusedSales: RfResult; // Y
  if (isMultiplier) bonusedSales = R !== null && W !== null && W !== 0 ? R / W / X : null;
  else bonusedSales = 'TBD';

  const Yn = typeof bonusedSales === 'number' ? bonusedSales : null;
  const basePoints: RfResult = bonusedSales === 'TBD' ? 'TBD' : Yn === null ? null : X * Yn; // Z
  const Zn = typeof basePoints === 'number' ? basePoints : null;
  const basePointsRedeemable: RfResult =
    basePoints === 'TBD' ? 'TBD' : Zn === null ? null : (Zn / 1000) * V; // AA
  const bonusPointsRedeemable = R === null ? null : (R / 1000) * V; // AB
  const redemptionRateResults = redemptionRate(o); // AC (forecast-style rule)
  const bonusRedeemableWithBreakage =
    bonusPointsRedeemable === null ? null : redemptionRateResults * bonusPointsRedeemable; // AD
  const spendPerBonusedMember: RfResult =
    bonusedSales === 'TBD' ? 'TBD' : Yn !== null && Q !== null && Q !== 0 ? Yn / Q : null; // AE

  // --- WBR strings ---
  const s = parseISO(o.startDate);
  const e = parseISO(o.endDate);
  const Fdays = numberOfDays(o);

  const wbrOfferPeriod = s && e ? `${fmtDate(s, 'M/d')}-${fmtDate(e, 'M/d')}` : ''; // BM

  const AL = f.activationAvg;
  const AM = f.bonusRateAvg;
  const AP = f.bonusedMembersAvg;
  const AQ = f.spendPerTxnAvg;
  const AZ = f.bonusPointsAvg;
  const BI = f.bonusRedeemableAvg;

  const wbrFcstActivations = AL === null ? '' : `${excelRoundDown(AL / 1000, 1)}K`; // BN

  function rateText(r: number): string {
    if (r === 0) return '0%';
    if (r >= 0.1) return `${excelRound(r * 100, 0)}%`;
    return `${excelRound(r * 100, 1).toFixed(1)}%`;
  }
  const wbrFcstBonused =
    AM === null || AP === null
      ? ''
      : `${AP < 1000 ? excelRound(AP, 0) : `${excelRound(AP / 1000, 0)}K`} (${rateText(AM)})`; // BO

  const wbrFcstSpend = AQ === null || AQ === 0 ? 'N/A' : `$${excelRound(AQ, 0)}`; // BP

  const wbrFcstBonusPts =
    AZ === null || AZ === 0 ? 'N/A' : `${ptsMD(AZ)} (${BI === null ? '$0' : dollarMD(BI)})`; // BQ

  const wbrActActivations =
    P === null
      ? 'TBD'
      : P >= 1e6
        ? `${excelRound(P / 1e6, 2)}M`
        : P >= 1000
          ? `${excelRound(P / 1000, 0)}K`
          : `${excelRound(P, 0)}`; // BR

  let wbrActBonused = 'N/A'; // BS
  if (Q !== null) {
    const nTxt = Q < 1000 ? `${Q}` : `${excelRound(Q / 1000, 0)}K`;
    const rTxt =
      bonusRate === null
        ? 'N/A'
        : bonusRate * 100 <= 9.5
          ? `${excelRound(bonusRate * 100, 1).toFixed(1)}%`
          : `${excelRound(bonusRate * 100, 0)}%`;
    wbrActBonused = `${nTxt} (${rTxt})`;
  }

  const wbrActSpend = spendPerBonusedMember === 'TBD' || spendPerBonusedMember === null
    ? 'TBD'
    : `$${excelRound(spendPerBonusedMember, 0)}`; // BT

  const wbrActBonusPts =
    R === null
      ? 'N/A'
      : `${ptsMD(R)} (${bonusRedeemableWithBreakage === null ? '$0' : dollarMD(bonusRedeemableWithBreakage)})`; // BU

  let wbrActBonusedSales = 'TBD'; // BV
  if (Yn !== null) {
    wbrActBonusedSales =
      Yn < 1000
        ? `$${excelRound(Yn, 0)}`
        : Yn < 500000
          ? `$${excelRound(Yn / 1000, 0)}K`
          : `$${excelRound(Yn / 1e6, 1)}M`;
  } else if (bonusedSales === 'TBD') {
    wbrActBonusedSales = 'N/A';
  }

  // Prorated (BW, BX, BY, BZ)
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  let daysElapsed: RfNum = null;
  if (s && Fdays !== null) {
    if (t >= s) daysElapsed = Math.min(Math.round((t.getTime() - s.getTime()) / 86_400_000), Fdays);
  }
  const pctComplete = daysElapsed !== null && Fdays ? daysElapsed / Fdays : null;
  const proratedPts = R !== null && pctComplete !== null && pctComplete !== 0 ? R / pctComplete : null;

  let colourCode: RfRow['colourCode'] = '';
  if (proratedPts !== null && AZ !== null && f.bonusPointsLow !== null && f.bonusPointsHigh !== null) {
    if (proratedPts < f.bonusPointsLow) colourCode = 'Pink';
    else if (proratedPts > f.bonusPointsHigh) colourCode = 'Dark Green';
    else colourCode = 'Light green';
  }

  return {
    ltbpOutstanding,
    ltbpRemoved,
    bonusRate,
    bonusPointCalc: W,
    bonusedSales,
    basePoints,
    basePointsRedeemable,
    bonusPointsRedeemable,
    redemptionRateResults,
    bonusRedeemableWithBreakage,
    spendPerBonusedMember,
    activationLow: f.activationLow,
    activationHigh: f.activationHigh,
    bonusRateLowIn: num(o.bonusRateLow),
    bonusRateHighIn: num(o.bonusRateHigh),
    avgSpendLowIn: num(o.avgSpendPerTxnLow),
    avgSpendHighIn: num(o.avgSpendPerTxnHigh),
    activationAvg: f.activationAvg,
    bonusRateAvg: f.bonusRateAvg,
    bonusedMembersLow: f.bonusedMembersLow,
    bonusedMembersHigh: f.bonusedMembersHigh,
    bonusedMembersAvg: f.bonusedMembersAvg,
    spendPerTxnAvg: f.spendPerTxnAvg,
    bonusedSalesLow: f.bonusedSalesLow,
    bonusedSalesHigh: f.bonusedSalesHigh,
    bonusedSalesAvg: f.bonusedSalesAvg,
    basePointsLow: f.basePointsLow,
    basePointsHigh: f.basePointsHigh,
    basePointsAvg: f.basePointsAvg,
    bonusPointsLow: f.bonusPointsLow,
    bonusPointsHigh: f.bonusPointsHigh,
    bonusPointsAvg: f.bonusPointsAvg,
    basePointsRedeemableLow: f.basePointsRedeemableLow,
    basePointsRedeemableHigh: f.basePointsRedeemableHigh,
    bonusPointsRedeemableLow: f.bonusPointsRedeemableLow,
    bonusPointsRedeemableHigh: f.bonusPointsRedeemableHigh,
    bonusPointsRedeemableAvg: f.bonusPointsRedeemableAvg,
    redemptionRateForecast: f.redemptionRate,
    bonusRedeemableLow: f.bonusRedeemableLow,
    bonusRedeemableHigh: f.bonusRedeemableHigh,
    bonusRedeemableAvg: f.bonusRedeemableAvg,
    jbpLow: f.jbpLow,
    jbpHigh: f.jbpHigh,
    jbpAvg: f.jbpAvg,
    wbrOfferPeriod,
    wbrFcstActivations,
    wbrFcstBonused,
    wbrFcstSpend,
    wbrFcstBonusPts,
    wbrActActivations,
    wbrActBonused,
    wbrActSpend,
    wbrActBonusPts,
    wbrActBonusedSales,
    daysElapsed,
    pctComplete,
    proratedPts,
    colourCode,
  };
}

/** B1: offer appears in Results & Forecast when includeForResultsForecast = "Yes". */
export function inResultsForecast(o: OfferRecord): boolean {
  return includeForResultsForecast(o) === 'Yes';
}

/** B4: the 6 Step-7 round-trip totals (0 when the offer is not in the module). */
export function roundTripTotals(o: OfferRecord): {
  bonusedMembersLow: number;
  bonusedMembersHigh: number;
  bonusedSalesLow: number;
  bonusedSalesHigh: number;
  bonusRedeemableLow: number;
  bonusRedeemableHigh: number;
} {
  if (!inResultsForecast(o)) {
    return {
      bonusedMembersLow: 0,
      bonusedMembersHigh: 0,
      bonusedSalesLow: 0,
      bonusedSalesHigh: 0,
      bonusRedeemableLow: 0,
      bonusRedeemableHigh: 0,
    };
  }
  const rf = computeResultsForecast(o);
  return {
    bonusedMembersLow: rf.bonusedMembersLow ?? 0,
    bonusedMembersHigh: rf.bonusedMembersHigh ?? 0,
    bonusedSalesLow: rf.bonusedSalesLow ?? 0,
    bonusedSalesHigh: rf.bonusedSalesHigh ?? 0,
    bonusRedeemableLow: rf.bonusRedeemableLow ?? 0,
    bonusRedeemableHigh: rf.bonusRedeemableHigh ?? 0,
  };
}
