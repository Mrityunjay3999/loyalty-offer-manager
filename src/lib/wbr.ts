// WBR (Weekly Business Review) string formatting and colour code, spec 8.5.
// Pure formatters over already-computed numbers. Missing values render blank.
import { format as fmtDate } from 'date-fns';
import { parseISO } from './format';

/** Up to 1 decimal, dropping a trailing .0 (12.0 -> "12", 1.2 -> "1.2"). */
function trim1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
function floorTo1(n: number): number {
  return Math.floor(n * 10) / 10;
}

/** 1.2B / 12M / 120K style for large point counts. */
export function pointsMD(n: number): string {
  if (n >= 1e9) return `${trim1(n / 1e9)}B`;
  if (n >= 1e6) return `${trim1(n / 1e6)}M`;
  if (n >= 1e3) return `${trim1(n / 1e3)}K`;
  return String(Math.round(n));
}

/** $1.2M / $120K style for dollar amounts. */
export function dollarsMD(n: number): string {
  if (n >= 1e6) return `$${trim1(n / 1e6)}M`;
  if (n >= 1e3) return `$${trim1(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** Offer Period: M/d-M/d */
export function offerPeriod(startISO: unknown, endISO: unknown): string {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e) return '';
  return `${fmtDate(s, 'M/d')}-${fmtDate(e, 'M/d')}`;
}

/** Forecast activations (thousands): floor(avg/1000, 1 dp) + "K". Blank if missing. */
export function forecastActivationsK(activationAvg: number | null): string {
  if (activationAvg === null) return '';
  return `${floorTo1(activationAvg / 1000)}K`;
}

function membersShort(n: number): string {
  return n < 1000 ? String(Math.round(n)) : `${Math.round(n / 1000)}K`;
}

/** Forecast bonused member & rate: "N (R%)". */
export function forecastBonusedMemberRate(
  bonusedMembersAvg: number | null,
  bonusRateAvg: number | null,
): string {
  if (bonusedMembersAvg === null) return '';
  const n = membersShort(bonusedMembersAvg);
  const r = bonusRateAvg ?? 0;
  let rateStr: string;
  if (r === 0) rateStr = '0%';
  else if (r >= 0.1) rateStr = `${Math.round(r * 100)}%`;
  else rateStr = `${(r * 100).toFixed(1)}%`;
  return `${n} (${rateStr})`;
}

/** Forecast spend per bonused member: "N/A" if 0; else $ + round. */
export function forecastSpendPerMember(spendPerTxnAvg: number | null): string {
  if (spendPerTxnAvg === null || spendPerTxnAvg === 0) return 'N/A';
  return `$${Math.round(spendPerTxnAvg)}`;
}

/** Forecast bonus pts (MDs): "N/A" if 0; else pointsMD ($dollarsMD). */
export function forecastBonusPts(
  bonusPointsAvg: number | null,
  bonusRedeemableAvg: number | null,
): string {
  if (bonusPointsAvg === null || bonusPointsAvg === 0) return 'N/A';
  const dollars = bonusRedeemableAvg === null ? '' : ` (${dollarsMD(bonusRedeemableAvg)})`;
  return `${pointsMD(bonusPointsAvg)}${dollars}`;
}

/** Actual activations: 1.23M (2dp) if >=1M; 123K if >=1000; else integer. Blank if null. */
export function actualActivations(n: number | null): string {
  if (n === null) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

/** Actual bonused member & rate: N + " (R%)"; R to 1 dp if <=9.5 else integer. */
export function actualBonusedMemberRate(
  bonusedMembers: number | null,
  bonusRate: number | null,
): string {
  if (bonusedMembers === null) return '';
  const n = membersShort(bonusedMembers);
  if (bonusRate === null) return n;
  const pct = bonusRate * 100;
  const rateStr = pct <= 9.5 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
  return `${n} (${rateStr})`;
}

/** Actual spend per bonused member: "TBD" or $ + round. */
export function actualSpendPerMember(spend: number | null | 'TBD'): string {
  if (spend === null || spend === 'TBD') return 'TBD';
  return `$${Math.round(spend)}`;
}

/** Actual bonused sales: $123 / $123K (<500K) / $1.2M. Blank if null/TBD. */
export function actualBonusedSales(n: number | null | 'TBD'): string {
  if (n === null || n === 'TBD') return 'TBD';
  if (n >= 500000) return `$${trim1(n / 1e6)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

export function daysElapsed(
  startISO: unknown,
  numberOfDays: number | null,
  today = new Date(),
): number | null {
  const s = parseISO(startISO);
  if (!s || numberOfDays === null) return null;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  if (t < s) return null;
  const elapsed = Math.round((t.getTime() - s.getTime()) / 86_400_000);
  return Math.min(elapsed, numberOfDays);
}

export function percentComplete(
  elapsed: number | null,
  numberOfDays: number | null,
): number | null {
  if (elapsed === null || numberOfDays === null || numberOfDays === 0) return null;
  return elapsed / numberOfDays;
}

/** Prorated points: bonusPtsIssued / %complete (projects full-period points). */
export function proratedPoints(
  bonusPtsIssued: number | null,
  pctComplete: number | null,
): number | null {
  if (bonusPtsIssued === null || pctComplete === null || pctComplete === 0) return null;
  return bonusPtsIssued / pctComplete;
}

export type ColourCode = '' | 'Pink' | 'Light Green' | 'Dark Green';

/** Colour code (8.5): blank if no prorated or no forecast; Pink < low; Dark Green > high; else Light Green. */
export function colourCode(
  prorated: number | null,
  bonusPointsLow: number | null,
  bonusPointsHigh: number | null,
): ColourCode {
  if (prorated === null) return '';
  if (bonusPointsLow === null && bonusPointsHigh === null) return '';
  if (bonusPointsLow !== null && prorated < bonusPointsLow) return 'Pink';
  if (bonusPointsHigh !== null && prorated > bonusPointsHigh) return 'Dark Green';
  return 'Light Green';
}
