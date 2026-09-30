// Offer-level helpers used by the list, workspace and WBR.
import { checklistFields } from './dataLoaders';
import { startMonth } from './calculations';
import { isNoValue } from './format';
import type { OfferRecord } from './types';

const CHECKLIST_DONE_VALUES = new Set(['Yes', 'Partially', 'N/A']);

export interface ChecklistProgress {
  done: number;
  total: number;
}

/** Build checklist progress (spec: 6 items; done = Yes / Partially / N/A). */
export function checklistProgress(o: OfferRecord): ChecklistProgress {
  let done = 0;
  for (const f of checklistFields) {
    const v = o[f.id];
    if (!isNoValue(v) || v === 'N/A') {
      if (CHECKLIST_DONE_VALUES.has(String(v))) done += 1;
    }
  }
  return { done, total: checklistFields.length };
}

/** Planning month (MMM YYYY) from Start Date, used in filters and columns. */
export function planningMonth(o: OfferRecord): string {
  return startMonth(o) ?? '';
}

export function isGrouped(o: OfferRecord): boolean {
  return o.groupedOffer === 'Yes';
}
