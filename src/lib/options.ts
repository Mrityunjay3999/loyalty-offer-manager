// Helpers to resolve the option list for a field, including the cascading
// Category -> Sub-Category relationship. All option values come from
// dropdowns.json / reference.json — nothing is invented here.
import type { Dropdowns, CategorySubCategory, OfferValue } from './types';

/**
 * Make the Categories tab the single source for category/sub-category: given the
 * edited pairs, return the planningCategory / planningSubCategory lists with any
 * new values added so they become selectable on the offer form. Additive only —
 * existing values are preserved (retire them separately), keeping offers that
 * already use a value valid.
 */
export function mergedCategoryDropdowns(
  pairs: Array<Pick<CategorySubCategory, 'category' | 'subCategory'>>,
  dropdowns: Dropdowns,
): { planningCategory: string[]; planningSubCategory: string[] } {
  const cats = pairs.map((r) => String(r.category ?? '').trim()).filter(Boolean);
  const subs = pairs.map((r) => String(r.subCategory ?? '').trim()).filter(Boolean);
  return {
    planningCategory: [...new Set([...(dropdowns.planningCategory ?? []), ...cats])],
    planningSubCategory: [...new Set([...(dropdowns.planningSubCategory ?? []), ...subs])],
  };
}

/** Large lists that must render as a searchable combobox, never a plain select. */
export const LARGE_LIST_KEYS = new Set(['brands', 'transactionTypes']);

/**
 * Sub-categories valid for the chosen category (spec section 10 / reference
 * cascading). Falls back to the full planningSubCategory list when no category
 * is chosen yet. Retired values still in use are kept by the caller.
 */
export function subCategoriesForCategory(
  category: OfferValue | undefined,
  categorySubCategory: CategorySubCategory[],
  fullSubCategoryList: string[],
): string[] {
  if (!category || category === 'N/A') return fullSubCategoryList;
  const matches = categorySubCategory
    .filter((row) => row.category === category)
    .map((row) => row.subCategory);
  // De-dupe while preserving order.
  const seen = new Set<string>();
  const list = matches.filter((v) => (seen.has(v) ? false : (seen.add(v), true)));
  // Always allow N/A if the full list has it.
  if (fullSubCategoryList.includes('N/A') && !list.includes('N/A')) list.push('N/A');
  return list.length > 0 ? list : fullSubCategoryList;
}

/**
 * Resolve the option list for a field id given its optionsKey and current
 * editable dropdowns/reference in the store.
 */
export function optionsForField(
  fieldId: string,
  optionsKey: string | null,
  dropdowns: Dropdowns,
  categorySubCategory: CategorySubCategory[],
  currentCategory?: OfferValue,
): string[] {
  if (!optionsKey) return [];
  const base = dropdowns[optionsKey] ?? [];
  if (fieldId === 'subCategory') {
    return subCategoriesForCategory(currentCategory, categorySubCategory, base);
  }
  return base;
}
