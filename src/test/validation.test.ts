import { describe, it, expect } from 'vitest';
import { validateOffer, softLockWarning, type ValidationCtx } from '@/lib/validation';
import { reference } from '@/lib/dataLoaders';
import type { OfferRecord } from '@/lib/types';

const ctx = (all: OfferRecord[] = []): ValidationCtx => ({
  allOffers: all,
  categorySubCategory: reference.categorySubCategory,
});

// A minimally valid submittable offer (all 13 required present).
const valid: OfferRecord = {
  _uid: 'me',
  offerId: 9001,
  offerRequestDate: '2026-10-01',
  submittedBy: 'Merch Team',
  ppContact: 'Victoria Burt',
  startDate: '2026-11-02',
  endDate: '2026-11-29',
  offerName: '20261102_DOGTREATS_25_2500',
  category: 'MERCH',
  subCategory: 'CONSUMABLES',
  offerTiering: 'D',
  country: 'USPR, CAN',
  broadVsTargeted: 'Broad',
  offerDesign: 'Fixed Point',
  fixedPoints: 2500,
};

function errIds(o: OfferRecord, all: OfferRecord[] = []) {
  return validateOffer(o, ctx(all)).errors.map((e) => e.fieldId);
}
function warnIds(o: OfferRecord, all: OfferRecord[] = []) {
  return validateOffer(o, ctx(all)).warnings.map((w) => w.fieldId);
}

describe('validation (section 9)', () => {
  it('a complete offer has no errors', () => {
    expect(validateOffer(valid, ctx()).errors).toEqual([]);
  });

  it('missing required fields are errors', () => {
    const o: OfferRecord = { _uid: 'me' };
    const ids = errIds(o);
    expect(ids).toContain('offerId');
    expect(ids).toContain('startDate');
    expect(ids).toContain('offerName');
    expect(ids).toContain('category');
  });

  it('End before Start is an error', () => {
    expect(errIds({ ...valid, endDate: '2026-11-01' })).toContain('endDate');
  });

  it('Early Activation on/after Start is an error', () => {
    expect(errIds({ ...valid, earlyActivationDate: '2026-11-02' })).toContain('earlyActivationDate');
  });

  it('duplicate Offer ID is an error naming the other offer', () => {
    const other: OfferRecord = { _uid: 'other', offerId: 9001, offerName: 'EXISTING' };
    const res = validateOffer(valid, ctx([other]));
    const issue = res.errors.find((e) => e.fieldId === 'offerId');
    expect(issue?.message).toContain('EXISTING');
  });

  it('invalid sub-category for category is an error', () => {
    expect(errIds({ ...valid, subCategory: 'HOTEL' })).toContain('subCategory');
  });

  it('bonus rate outside 0..1 is an error', () => {
    expect(errIds({ ...valid, bonusRateLow: 1.5 })).toContain('bonusRateLow');
  });

  it('negative numbers are errors', () => {
    expect(errIds({ ...valid, fixedPoints: -5 })).toContain('fixedPoints');
  });

  it('bad offer card URL is an error, N/A is allowed', () => {
    expect(errIds({ ...valid, offerCardLinkUS: 'not-a-url' })).toContain('offerCardLinkUS');
    expect(errIds({ ...valid, offerCardLinkUS: 'N/A' })).not.toContain('offerCardLinkUS');
  });

  it('offer name format is a warning, not an error', () => {
    const bad = { ...valid, offerName: 'my offer' };
    expect(warnIds(bad)).toContain('offerName');
    expect(errIds(bad)).not.toContain('offerName');
  });

  it('Low > High is a warning', () => {
    const o = { ...valid, activationByDayLow: 400, activationByDayHigh: 300 };
    expect(warnIds(o)).toContain('activationByDayLow');
  });

  it('duplicate activation descriptor is a warning', () => {
    const me = { ...valid, activationDescriptor: 'ABC123' };
    const other: OfferRecord = { _uid: 'o2', offerName: 'OTHER', activationDescriptor: 'ABC123' };
    expect(warnIds(me, [other])).toContain('activationDescriptor');
  });

  it('CAN tiering warning for CAN-only offers with non-CAN tier', () => {
    expect(warnIds({ ...valid, country: 'CAN', offerTiering: 'A' })).toContain('offerTiering');
    expect(warnIds({ ...valid, country: 'CAN', offerTiering: 'ACAN' })).not.toContain('offerTiering');
  });

  it('deactivation code format warning', () => {
    expect(warnIds({ ...valid, deactivationCode: 'bad' })).toContain('deactivationCode');
    expect(warnIds({ ...valid, deactivationCode: '1125D5K' })).not.toContain('deactivationCode');
  });

  it('hidden fields are not validated (fixedPoints hidden for Multiplier)', () => {
    const o = { ...valid, offerDesign: 'Multiplier', multiplier: '3X', fixedPoints: undefined };
    // fixedPoints is hidden for Multiplier, so no "required/numeric" issue from it
    expect(errIds(o)).not.toContain('fixedPoints');
  });
});

describe('soft-lock warning', () => {
  it('warns when pre-audit and today past soft lock', () => {
    const o: OfferRecord = { buildStatus: 'Proposed' };
    expect(softLockWarning(o, '2000-01-01')).toContain('past its soft lock');
  });
  it('no warning once Audited / Ready to go', () => {
    const o: OfferRecord = { buildStatus: 'Audited / Ready to go' };
    expect(softLockWarning(o, '2000-01-01')).toBeNull();
  });
});
