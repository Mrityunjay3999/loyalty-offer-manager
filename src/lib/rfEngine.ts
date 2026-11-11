// v3 Package B: the "LIVE - Results and Forecast" tab, columns A..BZ, evaluated
// with Excel semantics (lib/excel.ts). Each column is the B3 formula, written as
// close to the Excel text as possible. Results are memoised per offer + as-of date.
import {
  type XVal,
  add,
  sub,
  mul,
  div,
  iferror,
  average,
  min,
  eq,
  lt,
  le,
  gt,
  ge,
  IF,
  AND,
  OR,
  xround,
  xrounddown,
  cat,
  xtextPct,
  xtext1,
  left,
  len,
  serial,
  serialOfDate,
  textMD,
  round,
} from './excel';
import { isNoValue, toNumber } from './format';
import type { OfferRecord } from './types';

/** All 78 R&F column letters in Excel order. */
export const RF_COLUMNS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U',
  'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM',
  'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD',
  'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU',
  'BV', 'BW', 'BX', 'BY', 'BZ',
] as const;
export type RfCol = (typeof RF_COLUMNS)[number];
export type RfCells = Record<RfCol, XVal>;

/** The Excel export date used by the Check tab and the default "Use Excel export date". */
export const EXCEL_EXPORT_DATE = '2026-11-11';

/** Points unit (Excel header cell V4). */
const UNIT = 1000;
const OCT_1_2025 = serial('2025-10-01')!;

/** A text input as pulled into the grid ("" when blank). */
function pullText(v: unknown): XVal {
  if (v === null || v === undefined) return '';
  return typeof v === 'number' ? v : String(v);
}
/** A numeric input as pulled into the grid: blank counts as 0 (Excel INDEX/MATCH). */
export function pullNum(v: unknown): XVal {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = toNumber(v);
  return n === null ? String(v) : n;
}
/** A number-or-text input that is not pulled as 0 when blank (N, fixed points). */
function pullNumOrText(v: unknown): XVal {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v;
  const n = toNumber(v);
  return n === null ? String(v) : n;
}

/** Total offer days: End - Start + 1, or End - Early Activation + 1. */
export function totalOfferDaysOf(o: OfferRecord): number | null {
  const s = serial(o.startDate);
  const e = serial(o.endDate);
  if (s === null || e === null) return null;
  const ea = isNoValue(o.earlyActivationDate) ? null : serial(o.earlyActivationDate);
  return e - (ea ?? s) + 1;
}
/** Activation total = by day x total offer days, rounded to 6 decimals (A4). */
export function activationTotal(byDay: unknown, o: OfferRecord): number {
  const b = toNumber(byDay);
  const days = totalOfferDaysOf(o);
  if (b === null || days === null) return 0;
  return round(b * days, 6);
}

/** Redemption rate rule used by R&F AC and BF (case-insensitive like Excel `=`). */
function rfRedemptionRate(L: XVal, D: XVal): XVal {
  return IF(eq(L, 'Points donations'), () => 1, () =>
    IF(eq(L, 'Extra Entries'), () => 1, () =>
      IF(eq(L, 'Limited Time Bonus Offer'), () => 1, () =>
        IF(ge(D, OCT_1_2025), () => 0.88, () => 0.85)))); // prettier-ignore
}

// Memo: offer object identity + as-of serial -> computed row.
const memo = new WeakMap<OfferRecord, Map<number, RfCells>>();

/** Compute all 78 R&F columns for one offer at an as-of date. */
export function computeRfCells(o: OfferRecord, asOf: Date = new Date()): RfCells {
  const today = serialOfDate(asOf);
  let byDate = memo.get(o);
  if (!byDate) {
    byDate = new Map();
    memo.set(o, byDate);
  }
  const hit = byDate.get(today);
  if (hit) return hit;
  const row = evaluate(o, today);
  byDate.set(today, row);
  return row;
}

function evaluate(o: OfferRecord, today: number): RfCells {
  const Vc = typeof o.redemptionConversion === 'number' ? o.redemptionConversion : 2;
  const Xc = typeof o.basePtsPerDollar === 'number' ? o.basePtsPerDollar : 10;

  // ---- Offer basics (A..N)
  const A: XVal = pullText(o.offerId);
  const B = pullText(o.dashboardMonth);
  const C = pullText(o.buildStatus);
  const D: XVal = serial(o.startDate) ?? '';
  const E: XVal = serial(o.endDate) ?? '';
  const F = add(sub(E, D), 1);
  const G = pullText(o.category);
  const H = pullText(o.subCategory);
  const I = pullText(o.offerTiering);
  const J = pullText(o.offerName);
  const K = pullText(o.country);
  const L = pullText(o.offerDesign);
  const M = pullText(o.multiplier);
  const N = pullNumOrText(o.fixedPoints);

  // ---- RESULTS (O..AE)
  const O = pullNum(o.audienceSize);
  const P = pullNum(o.activations);
  const Q = pullNum(o.bonusedMembers);
  const R = pullNum(o.bonusPtsIssued);
  const S = IF(eq(L, 'Limited Time Bonus Offer'), () => mul(N, P), () => '');
  const T = IF(AND(eq(C, 'Completed'), eq(L, 'Limited Time Bonus Offer')), () => sub(S, R), () => '');
  const U = iferror(div(Q, P), 'null');
  const V: XVal = Vc;
  const W = IF(eq(L, 'Multiplier'), () => sub(left(M, sub(len(M), 1)), 1), () => N);
  const X: XVal = Xc;
  const Y = IF(eq(L, 'Multiplier'), () => div(div(R, W), X), () => 'TBD');
  const Z = iferror(mul(X, Y), 'TBD');
  const AA = iferror(mul(div(Z, UNIT), V), 'TBD');
  const AB = iferror(mul(div(R, UNIT), V), 'TBD');
  const AC = rfRedemptionRate(L, D);
  const AD = mul(AC, AB);
  const AE = iferror(div(Y, Q), 'TBD');

  // ---- FORECAST (AF..BL)
  const AF: XVal = activationTotal(o.activationByDayLow, o);
  const AG: XVal = activationTotal(o.activationByDayHigh, o);
  const AH = pullNum(o.bonusRateLow);
  const AI = pullNum(o.bonusRateHigh);
  const AJ = pullNum(o.avgSpendPerTxnLow);
  const AK = pullNum(o.avgSpendPerTxnHigh);
  const AL = iferror(average(AF, AG), 'null');
  const AM = iferror(average(AH, AI), 'null');
  const AN = mul(AF, AH);
  const AO = mul(AG, AI);
  const AP = average(AN, AO);
  const AQ = average(AJ, AK);
  const AR = mul(AJ, AN);
  const AS = mul(AK, AO);
  const AT = average(AR, AS);
  const AU = mul(AR, X);
  const AV = mul(AS, X);
  const AW = average(AU, AV);
  const AX = IF(eq(C, 'CANCELLED'), () => 0, () =>
    iferror(IF(eq(L, 'Multiplier'), () => mul(AU, W), () => mul(AN, W)), 0)); // prettier-ignore
  const AY = IF(eq(C, 'CANCELLED'), () => 0, () =>
    iferror(IF(eq(L, 'Multiplier'), () => mul(AV, W), () => mul(AO, W)), 0)); // prettier-ignore
  const AZ = average(AX, AY);
  const BA = mul(div(AU, UNIT), V);
  const BB = mul(div(AV, UNIT), V);
  const BC = mul(div(AX, UNIT), V);
  const BD = mul(div(AY, UNIT), V);
  const BE = average(BC, BD);
  const BF = rfRedemptionRate(L, D);
  const BG = mul(BC, BF);
  const BH = mul(BD, BF);
  const BI = average(BG, BH);
  const BJ = add(BA, BC);
  const BK = add(BB, BD);
  const BL = average(BJ, BK);

  // ---- WBR (BM..BZ)
  const BM = cat(textMD(D), '-', textMD(E));
  const BN = IF(eq(AL, 'null'), () => '', () => cat(iferror(xrounddown(div(AL, 1000), 1), 0), 'K'));
  const BO = IF(eq(AM, 'null'), () => '', () =>
    iferror(
      cat(
        IF(lt(AP, 1000), () => xround(AP, 0), () => cat(xround(div(AP, 1000), 0), 'K')),
        ' (',
        IF(eq(AM, 0), () => '0%', () => IF(ge(AM, 0.1), () => xtextPct(AM, '0%'), () => xtextPct(AM, '0.0%'))),
        ')',
      ),
      '',
    )); // prettier-ignore
  const BP = IF(eq(AQ, 0), () => 'N/A', () => iferror(cat('$', xround(AQ, 0)), 'N/A'));
  const BQ = IF(eq(AZ, 0), () => 'N/A', () =>
    iferror(
      cat(
        IF(ge(AZ, 1e9), () => cat(xround(div(AZ, 1e9), 1), 'B'), () =>
          IF(ge(AZ, 1e6), () => cat(xround(div(AZ, 1e6), 0), 'M'), () => cat(xround(div(AZ, 1000), 0), 'K'))),
        ' ($',
        IF(ge(BI, 1e6), () => cat(xround(div(BI, 1e6), 1), 'M'), () =>
          IF(ge(BI, 1000), () => cat(xround(div(BI, 1000), 0), 'K'), () => xround(BI, 0))),
        ')',
      ),
      'N/A',
    )); // prettier-ignore
  const BR = iferror(
    IF(ge(P, 1e6), () => cat(xround(div(P, 1e6), 2), 'M'), () =>
      IF(ge(P, 1000), () => cat(xround(div(P, 1000), 0), 'K'), () => xround(P, 0))),
    'TBD',
  ); // prettier-ignore
  const BS = iferror(
    IF(eq(Q, 'N/A'), () => '', () =>
      cat(
        IF(lt(Q, 1000), () => Q, () => cat(xround(div(Q, 1000), 0), 'K')),
        ' (',
        IF(le(mul(U, 100), 9.5), () => xtext1(xround(mul(U, 100), 1)), () => xround(mul(U, 100), 0)),
        '%)',
      )),
    'N/A',
  ); // prettier-ignore
  const BT = IF(eq(AE, 'TBD'), () => 'TBD', () => cat('$', xround(AE, 0)));
  const BU = iferror(
    IF(eq(R, 'N/A'), () => 'N/A', () =>
      cat(
        IF(ge(R, 1e9), () => cat(xround(div(R, 1e9), 1), 'B'), () =>
          IF(ge(R, 1e6), () => cat(xround(div(R, 1e6), 0), 'M'), () => cat(xround(div(R, 1000), 0), 'K'))),
        ' ($',
        IF(ge(AD, 1e6), () => cat(xround(div(AD, 1e6), 0), 'M'), () =>
          IF(ge(AD, 1000), () => cat(xround(div(AD, 1000), 0), 'K'), () => xround(AD, 0))),
        ')',
      )),
    'N/A',
  ); // prettier-ignore
  const BV = iferror(
    IF(eq(Y, ''), () => 'N/A', () =>
      IF(eq(Y, 'N/A'), () => 'N/A', () =>
        IF(lt(Y, 1000), () => cat('$', xround(Y, 0)), () =>
          IF(lt(Y, 500000), () => cat('$', xround(div(Y, 1000), 0), 'K'), () => cat('$', xround(div(Y, 1e6), 1), 'M'))))),
    'TBD',
  ); // prettier-ignore
  const BW = IF(lt(today, D), () => '', () => iferror(min(sub(today, D), F), ''));
  const BX = iferror(div(BW, F), '');
  const BY = iferror(div(R, BX), '');
  const BZ = iferror(
    IF(OR(eq(BY, ''), eq(BQ, '')), () => '', () =>
      IF(lt(BY, AX), () => 'Pink', () => IF(gt(BY, AY), () => 'Dark Green', () => 'Light green'))),
    '',
  ); // prettier-ignore

  return {
    A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
    AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AN, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ,
    BA, BB, BC, BD, BE, BF, BG, BH, BI, BJ, BK, BL, BM, BN, BO, BP, BQ, BR, BS, BT, BU, BV, BW, BX, BY, BZ,
  }; // prettier-ignore
}
