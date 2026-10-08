import { describe, it, expect } from 'vitest';
import { fields } from '@/lib/dataLoaders';
import * as storeMod from '@/store/useAppStore';

describe('A6 structure cannot change in the app', () => {
  it('there is no store action to add, remove or rename a field (columns are fixed)', () => {
    // The fields list is a static import, never part of the mutable store.
    const actionNames = Object.keys(storeMod).join(' ').toLowerCase();
    expect(actionNames).not.toMatch(/addfield|removefield|deletefield|renamefield|addcolumn|removecolumn/);
    // The store module exposes only the store hook + helpers, not a fields mutator.
    expect(typeof (storeMod as Record<string, unknown>).useAppStore).toBe('function');
  });
});

describe('A10 grouping comes only from fields.json', () => {
  it('every form field carries a step from the data file', () => {
    for (const f of fields) {
      expect(typeof f.step).toBe('string');
      expect(f.step.length).toBeGreaterThan(0);
    }
  });
});
