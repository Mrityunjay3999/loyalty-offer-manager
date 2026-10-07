import { describe, it, expect } from 'vitest';
import { computeNextOfferId } from '@/lib/offerId';
import { requiredFieldIds } from '@/lib/dataLoaders';
import type { OfferRecord } from '@/lib/types';

describe('A1 Offer ID auto-generation', () => {
  it('next id is max existing + 1', () => {
    const offers: OfferRecord[] = [{ offerId: 10 }, { offerId: 2578 }, { offerId: 'x' }, {}];
    expect(computeNextOfferId(offers)).toBe(2579);
  });
  it('empty list starts at 1', () => {
    expect(computeNextOfferId([])).toBe(1);
  });
  it('blank / non-numeric ids are ignored', () => {
    expect(computeNextOfferId([{ offerId: '' }, { offerId: 'N/A' }])).toBe(1);
  });
});

describe('A7 required fields come from requiredFields.json', () => {
  it('has the 12 provisional fields and not offerId', () => {
    expect(requiredFieldIds.size).toBe(12);
    expect(requiredFieldIds.has('offerId')).toBe(false);
    for (const id of ['offerRequestDate', 'startDate', 'offerName', 'category', 'offerDesign']) {
      expect(requiredFieldIds.has(id)).toBe(true);
    }
  });
});
