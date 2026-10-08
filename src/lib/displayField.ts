// Shared read-only field formatter used by Offer View and the Calendar detail
// drawer. Never shows null/undefined/NaN — blanks become an em dash upstream.
import { computedFieldValue } from './calculations';
import { isNoValue, formatDate, formatCurrency, formatPercent } from './format';
import type { OfferRecord, FieldDef } from './types';

export function displayField(f: FieldDef, o: OfferRecord): string {
  if (f.control === 'computed') {
    const v = computedFieldValue(f.id, o);
    return v === null || v === undefined ? '' : String(v);
  }
  const v = o[f.id];
  if (isNoValue(v)) return v === 'N/A' ? 'N/A' : '';
  if (f.control === 'date' || f.control === 'dateOrNA') return formatDate(v);
  if (f.control === 'currency') return formatCurrency(v);
  if (f.control === 'percent') return formatPercent(v, 1);
  return String(v);
}
