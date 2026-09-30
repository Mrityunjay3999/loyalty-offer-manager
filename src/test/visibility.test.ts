import { describe, it, expect } from 'vitest';
import { isFieldVisible, countryIncludes, isGroupedTabVisible } from '@/lib/visibility';
import type { OfferRecord } from '@/lib/types';

const o = (p: Partial<OfferRecord>): OfferRecord => ({ ...p });

describe('visibility rules (section 10)', () => {
  it('countryIncludes handles USPR / mixed markets', () => {
    expect(countryIncludes('USPR, CAN', 'US')).toBe(true);
    expect(countryIncludes('USPR, CAN', 'PR')).toBe(true);
    expect(countryIncludes('USPR, CAN', 'CAN')).toBe(true);
    expect(countryIncludes('CAN', 'US')).toBe(false);
    expect(countryIncludes('CAN, PR', 'PR')).toBe(true);
  });

  it('CAN fields show only when country includes CAN', () => {
    expect(isFieldVisible('canActivationDescriptor', o({ country: 'USPR, CAN' }))).toBe(true);
    expect(isFieldVisible('canActivationDescriptor', o({ country: 'US' }))).toBe(false);
  });

  it('US/PR fields show for USPR but not CAN-only', () => {
    expect(isFieldVisible('offerCardLinkUS', o({ country: 'USPR' }))).toBe(true);
    expect(isFieldVisible('offerCardLinkUS', o({ country: 'CAN' }))).toBe(false);
  });

  it('locationCode only for GRAND OPENING', () => {
    expect(isFieldVisible('locationCode', o({ subCategory: 'GRAND OPENING' }))).toBe(true);
    expect(isFieldVisible('locationCode', o({ subCategory: 'CONSUMABLES' }))).toBe(false);
  });

  it('multiplier vs fixedPoints by design', () => {
    expect(isFieldVisible('multiplier', o({ offerDesign: 'Multiplier' }))).toBe(true);
    expect(isFieldVisible('multiplier', o({ offerDesign: 'Benefit - Choose 2X' }))).toBe(true);
    expect(isFieldVisible('multiplier', o({ offerDesign: 'Fixed Point' }))).toBe(false);
    expect(isFieldVisible('fixedPoints', o({ offerDesign: 'Fixed Point' }))).toBe(true);
    expect(isFieldVisible('fixedPoints', o({ offerDesign: 'Multiplier' }))).toBe(false);
  });

  it('member descriptor only for Targeted; primary brand only when Brand Offer=Yes', () => {
    expect(isFieldVisible('memberDescriptor', o({ broadVsTargeted: 'Targeted' }))).toBe(true);
    expect(isFieldVisible('memberDescriptor', o({ broadVsTargeted: 'Broad' }))).toBe(false);
    expect(isFieldVisible('primaryBrand', o({ brandOffer: 'Yes' }))).toBe(true);
    expect(isFieldVisible('primaryBrand', o({ brandOffer: 'No' }))).toBe(false);
  });

  it('funding structure only when Offset=JBP; optInMethod when Activation Required=Yes', () => {
    expect(isFieldVisible('fundingStructure', o({ offset: 'JBP' }))).toBe(true);
    expect(isFieldVisible('fundingStructure', o({ offset: 'Merch' }))).toBe(false);
    expect(isFieldVisible('optInMethod', o({ activationRequired: 'Yes' }))).toBe(true);
    expect(isFieldVisible('optInMethod', o({ activationRequired: 'No' }))).toBe(false);
  });

  it('setup-type driven fields', () => {
    expect(
      isFieldVisible('interactionType', o({ kognitivOfferSetupType: 'Interaction Bonus Promotion' })),
    ).toBe(true);
    expect(
      isFieldVisible('txnTypeFixedPointBack', o({ kognitivOfferSetupType: 'Batch Promotion : Fixed Point Back' })),
    ).toBe(true);
    expect(
      isFieldVisible('txnTypeUploadPts', o({ offerDesign: 'Activation Only - Points upload' })),
    ).toBe(true);
  });

  it('unconditional fields always visible; grouped tab gated by Grouped Offer', () => {
    expect(isFieldVisible('offerName', o({}))).toBe(true);
    expect(isGroupedTabVisible(o({ groupedOffer: 'Yes' }))).toBe(true);
    expect(isGroupedTabVisible(o({ groupedOffer: 'No' }))).toBe(false);
  });
});
