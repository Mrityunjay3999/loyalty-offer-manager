// Typed loaders for the seed JSON. The JSON in /src/data is the single source of
// truth; these modules just import it and attach types. Nothing here transforms
// or invents data.
import fieldsJson from '@/data/fields.json';
import dropdownsJson from '@/data/dropdowns.json';
import referenceJson from '@/data/reference.json';
import metadataJson from '@/data/metadataFields.json';
import offersJson from '@/data/sampleOffers.json';
import ddOnlyJson from '@/data/dataDictionaryOnlyFields.json';
import requiredFieldsJson from '@/data/requiredFields.json';

import type {
  FieldDef,
  Dropdowns,
  ReferenceData,
  MetadataField,
  OfferRecord,
  DataDictionaryOnlyField,
  RequiredFields,
} from './types';

export const fields = fieldsJson as unknown as FieldDef[];
export const dropdowns = dropdownsJson as unknown as Dropdowns;
export const reference = referenceJson as unknown as ReferenceData;
export const metadataFields = metadataJson as unknown as MetadataField[];
export const sampleOffers = offersJson as unknown as OfferRecord[];
export const dataDictionaryOnlyFields = ddOnlyJson as unknown as DataDictionaryOnlyField[];
export const requiredFields = requiredFieldsJson as unknown as RequiredFields;

/** Field ids required for the metadata load (A7). Drives the red star + validation. */
export const requiredFieldIds = new Set<string>(requiredFields.fields);
export function isRequired(fieldId: string): boolean {
  return requiredFieldIds.has(fieldId);
}

// Convenience indexes built once.
export const fieldsById: Record<string, FieldDef> = Object.fromEntries(
  fields.map((f) => [f.id, f]),
);

/** Ordered list of the form step names as they appear in fields.json. */
export const STEP_ORDER: string[] = [
  '1. Request & Timing',
  '2. Offer Basics',
  '3. Reward & Rules',
  '4. Audience & Merchandising',
  '5. Loyalty Platform Setup',
  '6. Content, Signage & SKUs',
  '7. Forecast',
  '8. Build Checklist',
  '9. Results',
];

export const fieldsByStep: Record<string, FieldDef[]> = STEP_ORDER.reduce(
  (acc, step) => {
    acc[step] = fields.filter((f) => f.step === step);
    return acc;
  },
  {} as Record<string, FieldDef[]>,
);

export const systemFields: FieldDef[] = fields.filter(
  (f) => f.step === 'System (hidden)',
);

/** Fields that are part of the build checklist (6 per the corrected data). */
export const checklistFields: FieldDef[] = fields.filter((f) => f.checklist);

/** Deep clone of the seed offers, so the store never mutates the imported JSON.
 *  Each offer gets a stable internal _uid (prototype-only) for identity. */
export const SEED_IMPORT_ISO = '2026-09-01T09:00:00.000Z';
export function freshSampleOffers(): OfferRecord[] {
  const clone = JSON.parse(JSON.stringify(sampleOffers)) as OfferRecord[];
  return clone.map((o, i) => ({
    _uid: `seed-${i}-${o.offerId ?? i}`,
    _updatedAt: SEED_IMPORT_ISO,
    ...o,
  }));
}
