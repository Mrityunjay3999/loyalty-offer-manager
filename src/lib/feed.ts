// Databricks feed logic (Package C): routing the 169 metadata columns to the 2
// tables, inclusion, per-offer load state, and exceptions.
import { metadataFields, requiredFieldIds, fieldsById, dropdowns } from './dataLoaders';
import { includeForMetadata, resolveCalendarFieldValue } from './calculations';
import { isNoValue, parseISO } from './format';
import type { MetadataField, OfferRecord, CategorySubCategory } from './types';

export type FeedTable = 'attributes' | 'metrics' | 'notLoaded';

/** C2: route a metadata column by type / include flag. */
export function routeTable(m: MetadataField): FeedTable {
  if (m.includeInDatalake === 'No') return 'notLoaded';
  if (m.type === 'CM') return 'metrics';
  return 'attributes'; // MA and unclassified default to attributes
}

export const attributeColumns = metadataFields.filter((m) => routeTable(m) === 'attributes');
export const metricColumns = metadataFields.filter((m) => routeTable(m) === 'metrics');
export const notLoadedColumns = metadataFields.filter((m) => routeTable(m) === 'notLoaded');

export interface FeedCounts {
  included: number;
  attributes: number;
  metrics: number;
  notLoaded: number;
}
export function feedColumnCounts(): FeedCounts {
  return {
    included: 0,
    attributes: attributeColumns.length,
    metrics: metricColumns.length,
    notLoaded: notLoadedColumns.length,
  };
}

/** C3: offers in the feed (status set, not Cancelled, not Draft). */
export function includedOffers(offers: OfferRecord[]): OfferRecord[] {
  return offers.filter((o) => includeForMetadata(o) === 'Yes');
}

export interface FeedException {
  offerUid: string;
  offerId: string;
  offerName: string;
  status: string;
  fieldId: string;
  rule: string;
}

/** C5: validation-at-load exceptions for one included offer. */
export function offerExceptions(
  o: OfferRecord,
  categorySubCategory: CategorySubCategory[],
): FeedException[] {
  const out: FeedException[] = [];
  const ex = (fieldId: string, rule: string) =>
    out.push({
      offerUid: o._uid ?? '',
      offerId: String(o.offerId ?? ''),
      offerName: String(o.offerName ?? ''),
      status: String(o.buildStatus ?? ''),
      fieldId,
      rule,
    });

  // required fields must have a value
  for (const id of requiredFieldIds) {
    if (isNoValue(o[id])) ex(id, `${fieldsById[id]?.label ?? id} is required for the metadata load.`);
  }
  // sub-category valid for category
  if (!isNoValue(o.category) && !isNoValue(o.subCategory) && o.subCategory !== 'N/A') {
    const ok = categorySubCategory.some((r) => r.category === o.category && r.subCategory === o.subCategory);
    if (!ok) ex('subCategory', `${o.subCategory} is not a valid sub-category for ${o.category}.`);
  }
  // dropdown values must be active values of their list
  for (const f of Object.values(fieldsById)) {
    if ((f.control === 'select' || f.control === 'yesno') && f.optionsKey) {
      const v = o[f.id];
      if (!isNoValue(v) && v !== 'N/A') {
        const list = dropdowns[f.optionsKey] ?? [];
        if (!list.includes(String(v))) ex(f.id, `${f.label} value "${v}" is not an active list value.`);
      }
    }
  }
  // dates must be valid
  for (const f of Object.values(fieldsById)) {
    if (f.control === 'date' || f.control === 'dateOrNA') {
      const v = o[f.id];
      if (!isNoValue(v) && v !== 'N/A' && !parseISO(v)) ex(f.id, `${f.label} is not a valid date.`);
    }
  }
  return out;
}

export function allExceptions(offers: OfferRecord[], csc: CategorySubCategory[]): FeedException[] {
  return includedOffers(offers).flatMap((o) => offerExceptions(o, csc));
}

export type FeedChip =
  | 'Not in feed (Draft)'
  | 'Not in feed (Cancelled)'
  | 'Waiting for next load'
  | `Loaded ${string}`
  | `Exception: ${number} issue(s)`;

/** C4: the header chip state for one offer. */
export function feedChip(
  o: OfferRecord,
  loadedAt: string | undefined,
  csc: CategorySubCategory[],
): FeedChip {
  const st = String(o.buildStatus ?? '');
  if (st === '' || st === 'Draft') return 'Not in feed (Draft)';
  if (st === 'Cancelled') return 'Not in feed (Cancelled)';
  const issues = offerExceptions(o, csc).length;
  if (issues > 0) return `Exception: ${issues} issue(s)`;
  if (!loadedAt) return 'Waiting for next load';
  if (o._updatedAt && o._updatedAt > loadedAt) return 'Waiting for next load';
  return `Loaded ${new Date(loadedAt).toLocaleString()}`;
}

/** Format a metadata value by its datatype (C2). */
export function formatByDatatype(datatype: string, raw: string, captured: boolean): string {
  if (!captured) return raw; // "Not captured in the calendar form"
  if (isNoValue(raw) || raw === 'N/A') return '';
  const dt = (datatype ?? '').toLowerCase();
  if (dt.includes('decimal')) {
    // "Decimal X.XXXXXX" -> 6 decimals; "Decimal X.XX" -> 2 decimals (count the X's).
    const m = dt.match(/x\.(x+)/);
    const decimals = m ? m[1].length : 2;
    const n = Number(String(raw).replace(/,/g, ''));
    return Number.isFinite(n) ? n.toFixed(decimals) : raw;
  }
  if (dt === 'number') {
    const n = Number(String(raw).replace(/,/g, ''));
    return Number.isFinite(n) ? String(n) : raw;
  }
  return raw;
}

/** The resolved display value + source descriptor for a metadata column (C5). */
export function columnValue(m: MetadataField, o: OfferRecord) {
  const resolved = resolveCalendarFieldValue(m.calendarFieldId, o);
  let source: string;
  if (!m.calendarFieldId) source = 'Not captured';
  else if (m.calendarFieldId.startsWith('calc.')) source = `Calculated: ${m.calendarFieldId.slice(5)}`;
  else {
    const f = fieldsById[m.calendarFieldId];
    source = f ? `Offer form: ${f.label}${f.step ? ` (${f.step})` : ''}` : m.calendarFieldId;
  }
  return { ...resolved, source };
}
