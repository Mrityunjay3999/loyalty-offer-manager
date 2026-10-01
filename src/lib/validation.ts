// Validation rules, spec section 9. Errors block submission / the relevant
// status change; warnings never block. Hidden fields (section 10) are skipped.
import { fields } from './dataLoaders';
import { isNoValue, toNumber, parseISO } from './format';
import { isFieldVisible } from './visibility';
import type { OfferRecord, CategorySubCategory } from './types';

export interface Issue {
  fieldId: string;
  message: string;
}
export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}
export interface ValidationCtx {
  allOffers: OfferRecord[];
  categorySubCategory: CategorySubCategory[];
}

const OFFER_NAME_RE = /^\d{8}_[A-Z0-9$&_.\-]+$/;
const DEACTIVATION_RE = /^\d{4}[DGEPX]\d+K\d*$/;

function otherOffers(offer: OfferRecord, all: OfferRecord[]): OfferRecord[] {
  return all.filter((o) => o._uid !== offer._uid);
}
function nameOf(o: OfferRecord): string {
  return String(o.offerName ?? o.offerId ?? 'another offer');
}
function isRealText(v: unknown): boolean {
  // A usable, non-N/A, non-"same code" text value.
  if (isNoValue(v)) return false;
  return String(v).trim().toLowerCase() !== 'using same code as uspr';
}

export function validateOffer(offer: OfferRecord, ctx: ValidationCtx): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const others = otherOffers(offer, ctx.allOffers);
  const err = (fieldId: string, message: string) => errors.push({ fieldId, message });
  const warn = (fieldId: string, message: string) => warnings.push({ fieldId, message });

  const visible = (id: string) => isFieldVisible(id, offer);

  // 1. Required fields (N/A not accepted). Skip hidden ones.
  for (const f of fields) {
    if (!f.required) continue;
    if (!visible(f.id)) continue;
    const v = offer[f.id];
    if (isNoValue(v) || v === 'N/A') err(f.id, `${f.label} is required.`);
  }

  // 2. offerId: positive whole number; unique.
  if (!isNoValue(offer.offerId)) {
    const n = toNumber(offer.offerId);
    if (n === null || !Number.isInteger(n) || n <= 0) {
      err('offerId', 'Offer ID must be a positive whole number.');
    } else {
      const dup = others.find((o) => toNumber(o.offerId) === n);
      if (dup) err('offerId', `Offer ID ${n} is already used by ${nameOf(dup)}.`);
    }
  }

  // 3. endDate >= startDate
  {
    const s = parseISO(offer.startDate);
    const e = parseISO(offer.endDate);
    if (s && e && e < s) err('endDate', 'End Date must be on or after Start Date.');
  }

  // Offer due date (data-dictionary-only field): warn if after Start Date.
  {
    const due = parseISO(offer.offerDueDate);
    const s = parseISO(offer.startDate);
    if (due && s && due > s) {
      warn('offerDueDate', 'Offer due date is after the Start Date.');
    }
  }

  // 4. earlyActivationDate < startDate (when a real date)
  {
    const ea = parseISO(offer.earlyActivationDate);
    const s = parseISO(offer.startDate);
    if (ea && s && ea >= s) {
      err('earlyActivationDate', 'Early Activation must be before the Start Date.');
    }
  }

  // 5. ltbpRemovalDate >= ltbpExpiryDisplayed (when both dates)
  if (visible('ltbpRemovalDate')) {
    const rem = parseISO(offer.ltbpRemovalDate);
    const exp = parseISO(offer.ltbpExpiryDisplayed);
    if (rem && exp && rem < exp) {
      err('ltbpRemovalDate', 'Removal date must be on or after the displayed expiry date.');
    }
  }

  // 6/7/8. offerName format, date prefix, uniqueness (warnings)
  if (!isNoValue(offer.offerName)) {
    const name = String(offer.offerName);
    if (!OFFER_NAME_RE.test(name)) {
      warn(
        'offerName',
        'Standard format is YYYYMMDD_DESCRIPTION_REWARD, e.g. 20251103_CANJBPDOGMERRICK_3X.',
      );
    }
    const s = parseISO(offer.startDate);
    if (s && /^\d{8}_/.test(name)) {
      const prefix = name.slice(0, 8);
      const startYmd = `${s.getFullYear()}${String(s.getMonth() + 1).padStart(2, '0')}${String(
        s.getDate(),
      ).padStart(2, '0')}`;
      if (prefix !== startYmd) {
        warn('offerName', `Name date ${prefix} differs from Start Date ${startYmd}.`);
      }
    }
    const dupName = others.find(
      (o) => String(o.offerName ?? '').toLowerCase() === name.toLowerCase(),
    );
    if (dupName) {
      warn(
        'offerName',
        'Another offer already uses this name. Allowed only in agreed cases (e.g. an activation offer and its promotion).',
      );
    }
  }

  // 9. subCategory pair exists in categorySubCategory (error)
  if (!isNoValue(offer.category) && !isNoValue(offer.subCategory) && offer.subCategory !== 'N/A') {
    const ok = ctx.categorySubCategory.some(
      (r) => r.category === offer.category && r.subCategory === offer.subCategory,
    );
    if (!ok) {
      err('subCategory', `${offer.subCategory} is not a valid sub-category for ${offer.category}.`);
    }
  }

  // 10. CAN tiering (warning, proposed rule)
  if (offer.country === 'CAN' && !isNoValue(offer.offerTiering)) {
    const t = String(offer.offerTiering);
    if (!(t.endsWith('CAN') || t === 'Exclude' || t === 'N/A')) {
      warn('offerTiering', 'Canada-only offers use CAN tiers (e.g. ACAN).');
    }
  }

  // 11. multiplier / fixedPoints required by design (error, proposed rule)
  if (offer.offerDesign === 'Multiplier' && visible('multiplier') && isNoValue(offer.multiplier)) {
    err('multiplier', 'Enter the multiplier for a Multiplier offer.');
  }
  if (
    offer.offerDesign === 'Fixed Point' &&
    visible('fixedPoints') &&
    isNoValue(offer.fixedPoints)
  ) {
    err('fixedPoints', 'Enter the fixed points for a Fixed Point offer.');
  }

  // 13. canActivationDescriptor required when Country includes CAN (warning)
  if (visible('canActivationDescriptor') && isNoValue(offer.canActivationDescriptor)) {
    warn(
      'canActivationDescriptor',
      "Enter the CAN Activation Descriptor or 'Using same code as USPR'.",
    );
  }

  // 14. Uniqueness (warnings) for activationDescriptor, transactionExternalRefId, memberDescriptor
  for (const id of ['activationDescriptor', 'transactionExternalRefId', 'memberDescriptor']) {
    const v = offer[id];
    if (!isRealText(v)) continue;
    const dup = others.find(
      (o) => isRealText(o[id]) && String(o[id]).toLowerCase() === String(v).toLowerCase(),
    );
    if (dup) warn(id, `Also used on ${nameOf(dup)}.`);
  }

  // 15. deactivationCode format (warning)
  if (!isNoValue(offer.deactivationCode)) {
    if (!DEACTIVATION_RE.test(String(offer.deactivationCode))) {
      warn('deactivationCode', 'Expected format MMYYD#K# (see tooltip).');
    }
  }

  // 16. offerCardLinkUS/CAN valid URL or N/A (error) — only when visible
  for (const id of ['offerCardLinkUS', 'offerCardLinkCAN']) {
    if (!visible(id)) continue;
    const v = offer[id];
    if (isNoValue(v)) continue; // empty/N/A allowed
    if (!/^https?:\/\/\S+$/i.test(String(v))) {
      err(id, 'Enter a full link starting with https:// or N/A.');
    }
  }

  // 17. bonusRate 0..1 (error)
  for (const id of ['bonusRateLow', 'bonusRateHigh']) {
    const n = toNumber(offer[id]);
    if (n !== null && (n < 0 || n > 1)) err(id, 'Enter a rate between 0% and 100%.');
  }

  // 18. Low <= High (warnings)
  const pairs: Array<[string, string]> = [
    ['activationByDayLow', 'activationByDayHigh'],
    ['bonusRateLow', 'bonusRateHigh'],
    ['avgSpendPerTxnLow', 'avgSpendPerTxnHigh'],
  ];
  for (const [lo, hi] of pairs) {
    const a = toNumber(offer[lo]);
    const b = toNumber(offer[hi]);
    if (a !== null && b !== null && a > b) warn(lo, 'Low is higher than High.');
  }

  // 19. Numbers non-negative (error)
  const numberFieldIds = fields
    .filter((f) => f.control === 'number' || f.control === 'currency')
    .map((f) => f.id);
  for (const id of numberFieldIds) {
    const n = toNumber(offer[id]);
    if (n !== null && n < 0) err(id, 'Must be 0 or more.');
  }

  return { errors, warnings };
}

/** Soft-lock banner (warning). Status before Audited/Ready to go and today past soft lock. */
const PRE_AUDIT_STATUSES = new Set([
  'Draft',
  'Forecast Only',
  'Pending SteerCo Approval',
  'Proposed',
  'Planning Phase',
  'Approved / Build Phase',
  'Pending MD',
]);

export function softLockWarning(offer: OfferRecord, softLockDateISO: string): string | null {
  if (!softLockDateISO || softLockDateISO === 'Not in soft lock table') return null;
  const status = String(offer.buildStatus ?? 'Draft');
  if (!PRE_AUDIT_STATUSES.has(status)) return null;
  const sl = parseISO(softLockDateISO);
  if (!sl) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today > sl) {
    return `This offer is past its soft lock date (${softLockDateISO}).`;
  }
  return null;
}
