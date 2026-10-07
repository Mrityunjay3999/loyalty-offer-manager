import type { OfferRecord } from './types';

/** Next auto-generated Offer ID = max(existing numeric offerId) + 1 (A1). Pure. */
export function computeNextOfferId(offers: OfferRecord[]): number {
  const max = offers.reduce((m, o) => {
    const n = Number(o.offerId);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return max + 1;
}
