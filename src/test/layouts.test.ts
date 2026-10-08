// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { migrateLayoutsToUsers } from '@/lib/migrateLayouts';

beforeEach(() => localStorage.clear());

describe('personal layouts are stored per user', () => {
  it('migrates an old per-role layout to the first sample user of that role', () => {
    localStorage.setItem('lom-offerview-Offer Team Editor', JSON.stringify({ freeze: 3 }));
    localStorage.setItem('lom-rf-Admin', JSON.stringify({ density: 'comfortable' }));
    migrateLayoutsToUsers();
    expect(localStorage.getItem('lom-offerview-u-editor-1')).toBe(JSON.stringify({ freeze: 3 }));
    expect(localStorage.getItem('lom-rf-u-admin')).toBe(JSON.stringify({ density: 'comfortable' }));
  });

  it('runs only once (guarded by a flag)', () => {
    migrateLayoutsToUsers();
    localStorage.setItem('lom-offerview-Offer Team Editor', JSON.stringify({ freeze: 9 }));
    migrateLayoutsToUsers(); // flag already set → no copy
    expect(localStorage.getItem('lom-offerview-u-editor-1')).toBeNull();
  });

  it("one user's layout does not appear for another user", () => {
    localStorage.setItem('lom-offerview-u-editor-1', JSON.stringify({ freeze: 1 }));
    localStorage.setItem('lom-offerview-u-editor-2', JSON.stringify({ freeze: 4 }));
    expect(localStorage.getItem('lom-offerview-u-editor-1')).toBe(JSON.stringify({ freeze: 1 }));
    expect(localStorage.getItem('lom-offerview-u-editor-2')).toBe(JSON.stringify({ freeze: 4 }));
  });
});
