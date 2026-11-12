// v3 Package D: the Metadata Master Sheet's own results and forecast logic,
// columns BW..FC plus the BASICS inputs (B, D..M, O, Q, AD, AE, AF, AT, AU).
// Evaluated with Excel semantics (lib/excel.ts); memoised per offer + as-of date.
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
  ge,
  IF,
  AND,
  OR,
  left,
  len,
  serial,
  serialOfDate,
  isErr,
} from './excel';
import { computeRfCells, pullNum } from './rfEngine';
import { fiscalLookup, txnRefFixedPointBack, txnRefUploadPts, txnRefRemovePts } from './calculations';
import { isNoValue, toNumber } from './format';
import type { ImportMeta, OfferRecord } from './types';

const UNIT = 1000;
const OCT_1_2025 = serial('2025-10-01')!;
const NOV_1_2024 = serial('2024-11-01')!;
const LTBO = 'Limited Time Bonus Offer';
const REVERSAL_SETUPS = [
  'Transaction Bonus Promotion',
  'Transaction Product Bonus Promotion',
  'Transaction Product Quantity Bonus Promotion',
  'Transaction Product Value Bonus Promotion',
];
const DIVISIONS = ['hardgoodsOffer', 'consumablesOffer', 'specialtyOffer', 'servicesOffer', 'charitiesOffer'];
const SHARES = ['divisionShareHG', 'divisionShareCONS', 'divisionShareSPEC', 'divisionShareSVCS', 'divisionShareCharities'];

export type MdCells = Record<string, XVal>;

const text = (v: unknown): XVal => (v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v));
/** A value typed in the Metadata file: number, text, or "" when blank. */
const typed = (v: unknown): XVal => {
  if (isNoValue(v) && v !== 'N/A') return '';
  if (typeof v === 'number') return v;
  const n = toNumber(v);
  return n === null ? String(v) : n;
};
/** An empty typed cell counts as 0 in arithmetic (Excel blank cell). */
const z = (v: XVal): XVal => (v === '' ? 0 : v);

const memo = new WeakMap<OfferRecord, Map<number, MdCells>>();

export function computeMdCells(o: OfferRecord, asOf: Date = new Date(), meta?: ImportMeta): MdCells {
  const t = serialOfDate(asOf);
  let m = memo.get(o);
  if (!m) {
    m = new Map();
    memo.set(o, m);
  }
  const hit = m.get(t);
  if (hit) return hit;
  const row = evaluate(o, t, meta);
  m.set(t, row);
  return row;
}

function evaluate(o: OfferRecord, today: number, meta?: ImportMeta): MdCells {
  const rf = computeRfCells(o, new Date(1900, 0, 1)); // forecast columns do not use the as-of date
  const fis = fiscalLookup(o);

  // ---- BASICS
  const B = text(o.offerId);
  const D: XVal = fis ? fis.fy : meta?.fiscal?.fy ? Number(meta.fiscal.fy) || meta.fiscal.fy : '';
  const E: XVal = fis ? fis.fm : meta?.fiscal?.fm ?? '';
  const F: XVal = fis ? fis.fw : meta?.fiscal?.fw ?? '';
  const G: XVal = isNoValue(o.earlyActivationDate) ? 'N/A' : serial(o.earlyActivationDate) ?? 'N/A';
  const H = text(o.buildStatus);
  const J: XVal = serial(o.startDate) ?? '';
  const K: XVal = serial(o.endDate) ?? '';
  const I: XVal = IF(AND(ge(today, J), lt(today, K)), () => 'Live', () => IF(ge(today, K), () => 'Completed', () => 'Not Started'));
  const L = add(sub(K, J), 1);
  const M = IF(eq(G, 'N/A'), () => 0, () => sub(J, G));
  const O = text(o.offerName);
  const Q = text(o.country);
  const AD = text(o.multiplier);
  const AE: XVal = isNoValue(o.fixedPoints) && o.fixedPoints !== 'N/A' ? '' : typed(o.fixedPoints);
  const AF = text(o.offerDesign);
  const AT = text(o.category);
  const AU = text(o.subCategory);

  // ---- RESULTS (BW..CV)
  const BW = pullNum(o.audienceSize);
  const BX = pullNum(o.activations);
  const BY = pullNum(o.bonusedMembers);
  const BZ = pullNum(o.bonusPtsIssued);
  const CA = typed(o.bonusedMembersUnique);
  const CB = typed(o.earlyActivationCount);
  const CC = IF(eq(BX, 'null'), () => 'null', () => sub(BX, z(CB)));
  const CD = IF(eq(AF, LTBO), () => mul(AE, BX), () => '');
  const CE = IF(AND(eq(I, 'Completed'), eq(AF, LTBO)), () => sub(CD, BZ), () => '');
  const CF = iferror(div(BZ, L), 'null');
  const CG = iferror(div(BX, BW), 'null');
  const CH = iferror(div(BY, BX), 'null');
  const CI: XVal = typeof o.redemptionConversion === 'number' ? o.redemptionConversion : 2;
  const CJ = IF(eq(AF, 'Multiplier'), () => sub(left(AD, sub(len(AD), 1)), 1), () => AE);
  const CK: XVal = typeof o.basePtsPerDollar === 'number' ? o.basePtsPerDollar : 10;
  const CL = IF(eq(AF, 'Multiplier'), () => div(div(BZ, CJ), CK), () => 'TBD');
  const CM = iferror(mul(CL, CK), 'TBD');
  const CN = iferror(mul(div(CM, UNIT), CI), 'TBD');
  const CO = iferror(mul(div(BZ, UNIT), CI), 'TBD');
  const CP = IF(OR(eq(AF, LTBO), eq(AT, 'REDEMPTION')), () => 1, () =>
    IF(ge(J, OCT_1_2025), () => 0.88, () => IF(ge(J, NOV_1_2024), () => 0.85, () => 0.8))); // prettier-ignore
  const CQ = iferror(mul(CP, CO), 0);
  const CR = iferror(div(CL, BY), 'TBD');
  const CS = iferror(div(CL, z(CA)), 'TBD');
  const CT = IF(OR(eq(AU, 'ENTRIES'), eq(AU, 'POINTS DONATION')), () => mul(mul(BY, CJ), -1), () => '');
  const CU = IF(eq(CT, ''), () => '', () => mul(div(CT, UNIT), CI));
  const CV = IF(eq(Q, 'CAN'), () => 'CAD', () => IF(OR(eq(Q, 'US'), eq(Q, 'USPR')), () => 'USD', () => 'Blended'));

  // ---- FORECAST (CW..EA): the R&F formulas on the same inputs; DP/DQ have no Cancelled check
  const CW: XVal = isNoValue(o.forecastDate) ? 'N/A' : serial(o.forecastDate) ?? String(o.forecastDate);
  const [CX, CY, CZ, DA, DB, DC] = [rf.AF, rf.AG, rf.AH, rf.AI, rf.AJ, rf.AK];
  const [DD, DE, DF, DG, DH, DI, DJ, DK, DL, DM, DN, DO] = [
    rf.AL, rf.AM, rf.AN, rf.AO, rf.AP, rf.AQ, rf.AR, rf.AS, rf.AT, rf.AU, rf.AV, rf.AW,
  ];
  const DP = iferror(IF(eq(AF, 'Multiplier'), () => mul(DM, CJ), () => mul(DF, CJ)), 0);
  const DQ = iferror(IF(eq(AF, 'Multiplier'), () => mul(DN, CJ), () => mul(DG, CJ)), 0);
  const DR = average(DP, DQ);
  const DS = mul(div(DM, UNIT), CI);
  const DT = mul(div(DN, UNIT), CI);
  const DU = mul(div(DP, UNIT), CI);
  const DV = mul(div(DQ, UNIT), CI);
  const DW = average(DU, DV);
  const DX = rf.BF;
  const DY = mul(DU, DX);
  const DZ = mul(DV, DX);
  const EA = average(DY, DZ);

  // ---- OTHER IN THIS RANGE (typed in Metadata only, or simple lookups)
  const mo = meta?.metadataOnlyValues ?? {};
  const [EB, EC, EF, EG, ER, ES] = ['EB', 'EC', 'EF', 'EG', 'ER', 'ES'].map((k) => typed(mo[k]));
  const EU: XVal = REVERSAL_SETUPS.some((s) => eq(text(o.kognitivOfferSetupType), s) === true) ? 'Yes' : '';
  // Lookup of the transaction type: a blank type gives 0 (Excel looks up a blank).
  // blank type -> 0; "N/A" -> "N/A"; otherwise the Ref_ID, or "" when the type is not in the table.
  const ref = (v: unknown, r: string): XVal => (v === 'N/A' ? 'N/A' : isNoValue(v) ? 0 : r);
  const EV = ref(o.txnTypeFixedPointBack, txnRefFixedPointBack(o));
  const EW = ref(o.txnTypeUploadPts, txnRefUploadPts(o));
  const EX = ref(o.txnTypeRemovePts, txnRefRemovePts(o));
  const EY = text(o.deactivationCode);

  // ---- MULTIPLE DIVISIONS (EH..EQ)
  const yes = DIVISIONS.filter((id) => eq(text(o[id]), 'Yes') === true).length;
  const EH: XVal = yes > 1 ? 'Yes' : 'No';
  const EI: XVal = EH === 'Yes' ? yes - 1 : 0;
  const EJ = EH === 'Yes' ? mul(BZ, EI) : 0;
  const EK = EH === 'Yes' ? mul(CQ, EI) : 0;
  const [EL, EM, EN, EO, EP] = SHARES.map((id) => typed(o[id]));
  let EQ: XVal = 'N/A';
  if (EH === 'Yes') {
    const sum = [EL, EM, EN, EO, EP].reduce<number>((a, v) => a + (typeof v === 'number' ? v : 0), 0);
    EQ = Math.abs(sum - 1) < 1e-9 ? 'TRUE' : 'FALSE';
  }

  // ---- PRORATED (ED, EE, ET, EZ..FC)
  const ED = add(K, 1);
  const EE = add(K, 5);
  const ET = IF(eq(AF, 'Multiplier'), () => mul(CK, CJ), () => '');
  const EZ = IF(eq(G, 'N/A'),
    () => IF(lt(today, J), () => '', () => min(sub(today, J), L)),
    () => IF(lt(today, G), () => '', () => min(sub(today, G), sub(J, G)))); // prettier-ignore
  const FA = iferror(IF(eq(BX, 'null'), () => 'null', () => div(BX, add(EZ, M))), '');
  const FB: XVal = '';
  const FC = mul(div(BZ, EZ), L); // no IFERROR in Excel

  return {
    B, D, E, F, G, H, I, J, K, L, M, O, Q, AD, AE, AF, AT, AU,
    BW, BX, BY, BZ, CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN, CO, CP, CQ, CR, CS, CT, CU, CV,
    CW, CX, CY, CZ, DA, DB, DC, DD, DE, DF, DG, DH, DI, DJ, DK, DL, DM, DN, DO, DP, DQ, DR, DS, DT, DU, DV, DW,
    DX, DY, DZ, EA, EB, EC, ED, EE, EF, EG, EH, EI, EJ, EK, EL, EM, EN, EO, EP, EQ, ER, ES, ET, EU, EV, EW, EX,
    EY, EZ, FA, FB, FC,
  }; // prettier-ignore
}

/** True when a value is an Excel error (FC shows "Not available" for these). */
export const isMdError = isErr;
