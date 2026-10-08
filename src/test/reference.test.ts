import { describe, it, expect } from 'vitest';
import { mergedCategoryDropdowns } from '@/lib/options';
import { can } from '@/lib/permissions';
import type { Dropdowns } from '@/lib/types';

describe('mergedCategoryDropdowns (Categories tab is the single source)', () => {
  const dropdowns = { planningCategory: ['MERCH'], planningSubCategory: ['FOOD'] } as unknown as Dropdowns;

  it('adds new categories and sub-categories so they become selectable', () => {
    const pairs = [
      { category: 'MERCH', subCategory: 'FOOD' },
      { category: 'SERVICES', subCategory: 'GROOMING' },
    ];
    const r = mergedCategoryDropdowns(pairs, dropdowns);
    expect(r.planningCategory).toEqual(['MERCH', 'SERVICES']);
    expect(r.planningSubCategory).toEqual(['FOOD', 'GROOMING']);
  });

  it('preserves existing values, de-dupes and trims', () => {
    const pairs = [
      { category: ' MERCH ', subCategory: 'FOOD' }, // trimmed + duplicate
      { category: 'VET', subCategory: '' }, // blank sub ignored
    ];
    const r = mergedCategoryDropdowns(pairs, dropdowns);
    expect(r.planningCategory).toEqual(['MERCH', 'VET']);
    expect(r.planningSubCategory).toEqual(['FOOD']);
  });

  it('never removes an existing option (retiring is a separate action)', () => {
    const r = mergedCategoryDropdowns([{ category: 'NEW', subCategory: 'X' }], dropdowns);
    expect(r.planningCategory).toContain('MERCH');
    expect(r.planningSubCategory).toContain('FOOD');
  });
});

describe('Reference-data capabilities are gated separately', () => {
  it('list / status / Databricks edits each default to Admin only', () => {
    for (const cap of ['addChangeListValues', 'editStatusDefs', 'editDatabricksNames']) {
      expect(can('Admin', cap)).toBe(true);
      expect(can('Offer Team Editor', cap)).toBe(false);
      expect(can('View-only', cap)).toBe(false);
    }
  });
});
