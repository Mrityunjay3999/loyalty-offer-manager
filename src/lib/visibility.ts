// Conditional display rules, spec section 10. Hidden fields keep their stored
// value but are excluded from validation. "Country includes X" = the Country
// string contains X (USPR includes US and PR).
import type { OfferRecord, OfferValue } from './types';

function s(v: OfferValue | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Country string contains the given market token. */
export function countryIncludes(country: OfferValue | undefined, token: 'US' | 'PR' | 'CAN'): boolean {
  return s(country).includes(token);
}

const RULES: Record<string, (o: OfferRecord) => boolean> = {
  canActivationDescriptor: (o) => countryIncludes(o.country, 'CAN'),
  canActivationDescriptorLength: (o) => countryIncludes(o.country, 'CAN'),
  disclaimerCAN: (o) => countryIncludes(o.country, 'CAN'),
  offerCardLinkCAN: (o) => countryIncludes(o.country, 'CAN'),
  canPrioritySkus: (o) => countryIncludes(o.country, 'CAN'),

  disclaimerUSPR: (o) => countryIncludes(o.country, 'US') || countryIncludes(o.country, 'PR'),
  offerCardLinkUS: (o) => countryIncludes(o.country, 'US') || countryIncludes(o.country, 'PR'),
  usprFosSignage: (o) => countryIncludes(o.country, 'US') || countryIncludes(o.country, 'PR'),
  usprPrioritySkus: (o) => countryIncludes(o.country, 'US') || countryIncludes(o.country, 'PR'),

  locationCode: (o) => o.subCategory === 'GRAND OPENING',

  multiplier: (o) => o.offerDesign === 'Multiplier' || o.offerDesign === 'Benefit - Choose 2X',
  fixedPoints: (o) => o.offerDesign !== 'Multiplier',

  ltbpExpiryDisplayed: (o) => o.offerDesign === 'Limited Time Bonus Offer',
  ltbpRemovalDate: (o) => o.offerDesign === 'Limited Time Bonus Offer',

  optInMethod: (o) => o.activationRequired === 'Yes',
  interactionType: (o) => s(o.kognitivOfferSetupType).includes('Interaction'),
  txnTypeFixedPointBack: (o) => s(o.kognitivOfferSetupType).includes('Fixed Point Back'),
  txnTypeUploadPts: (o) =>
    o.kognitivOfferSetupType === 'Manual Batch Upload : Earned' ||
    o.offerDesign === 'Activation Only - Points upload',

  memberDescriptor: (o) => o.broadVsTargeted === 'Targeted',
  primaryBrand: (o) => o.brandOffer === 'Yes',
  fundingStructure: (o) => o.offset === 'JBP',
  skuUploadDate: (o) => o.skuList === 'Yes',
};

/** Human-readable reason a field is hidden (for the "value kept" toast). */
const REASONS: Record<string, string> = {
  canActivationDescriptor: 'Country does not include CAN',
  canActivationDescriptorLength: 'Country does not include CAN',
  disclaimerCAN: 'Country does not include CAN',
  offerCardLinkCAN: 'Country does not include CAN',
  canPrioritySkus: 'Country does not include CAN',
  disclaimerUSPR: 'Country does not include US or PR',
  offerCardLinkUS: 'Country does not include US or PR',
  usprFosSignage: 'Country does not include US or PR',
  usprPrioritySkus: 'Country does not include US or PR',
  locationCode: 'Sub-Category is not GRAND OPENING',
  multiplier: 'Offer Design is not Multiplier or Benefit - Choose 2X',
  fixedPoints: 'Offer Design is Multiplier',
  ltbpExpiryDisplayed: 'Offer Design is not Limited Time Bonus Offer',
  ltbpRemovalDate: 'Offer Design is not Limited Time Bonus Offer',
  optInMethod: 'Activation Required is not Yes',
  interactionType: 'Offer Setup Type does not contain Interaction',
  txnTypeFixedPointBack: 'Offer Setup Type does not contain Fixed Point Back',
  txnTypeUploadPts: 'Offer Setup Type / Design does not require an upload transaction type',
  memberDescriptor: 'Broad vs Targeted is not Targeted',
  primaryBrand: 'Brand Offer is not Yes',
  fundingStructure: 'Offset is not JBP',
  skuUploadDate: 'SKU List is not Yes',
};

/** Field ids that carry a conditional visibility rule. */
export const CONDITIONAL_FIELD_IDS = Object.keys(RULES);

/** True when the field should be shown for this offer. Unconditional fields show. */
export function isFieldVisible(fieldId: string, o: OfferRecord): boolean {
  const rule = RULES[fieldId];
  return rule ? rule(o) : true;
}

export function visibilityReason(fieldId: string): string {
  return REASONS[fieldId] ?? 'a condition is not met';
}

/** Grouped Offer child tab visibility. */
export function isGroupedTabVisible(o: OfferRecord): boolean {
  return o.groupedOffer === 'Yes';
}
