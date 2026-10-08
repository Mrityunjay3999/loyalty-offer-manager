import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { can, buildDefaultMatrix, CAPABILITIES, ROLES } from '@/lib/permissions';
import type { Role } from '@/lib/types';

const S = () => useAppStore.getState();

beforeEach(() => {
  S().resetDemoData();
  S().resetPermissions();
  S().signInAs('u-editor-1');
});

describe('can() over the full matrix', () => {
  it('matches the default matrix for every role and capability', () => {
    const def = buildDefaultMatrix();
    for (const role of ROLES) {
      for (const cap of CAPABILITIES) {
        expect(can(role as Role, cap.id)).toBe(def[role as Role][cap.id]);
      }
    }
  });

  it('Admin is always allowed, except locked-off capabilities', () => {
    for (const cap of CAPABILITIES) {
      const expected = cap.locked ? !!cap.lockedValue : true;
      expect(can('Admin', cap.id)).toBe(expected);
    }
  });

  it('locked rows are fixed for every role', () => {
    // "Add or remove a field" is off for everyone incl. Admin; view/calendar on for all.
    for (const role of ROLES) {
      expect(can(role as Role, 'addRemoveField')).toBe(false);
      expect(can(role as Role, 'openOfferView')).toBe(true);
      expect(can(role as Role, 'openCalendar')).toBe(true);
      expect(can(role as Role, 'savePersonalViews')).toBe(true);
    }
  });
});

describe('editing permissions takes effect immediately', () => {
  it('unticking Enter results for Offer Team Editor disables it at once', () => {
    expect(can('Offer Team Editor', 'enterResults')).toBe(true);
    const r = S().setPermission('Offer Team Editor', 'enterResults', false);
    expect(r.ok).toBe(true);
    expect(can('Offer Team Editor', 'enterResults')).toBe(false);
  });

  it('locked rows cannot be changed', () => {
    expect(S().setPermission('View-only', 'addRemoveField', true).ok).toBe(false);
    expect(can('View-only', 'addRemoveField')).toBe(false);
    expect(S().setPermission('Offer Team Editor', 'openOfferView', false).ok).toBe(false);
    expect(can('Offer Team Editor', 'openOfferView')).toBe(true);
  });

  it('the Admin column cannot be unticked', () => {
    expect(S().setPermission('Admin', 'manageUsers', false).ok).toBe(false);
    expect(can('Admin', 'manageUsers')).toBe(true);
  });
});

describe('route-guard capabilities', () => {
  it('View-only cannot open the edit area or Users & roles', () => {
    expect(can('View-only', 'openEditArea')).toBe(false);
    expect(can('View-only', 'manageUsers')).toBe(false);
  });
  it('Admin can open both', () => {
    expect(can('Admin', 'openEditArea')).toBe(true);
    expect(can('Admin', 'manageUsers')).toBe(true);
  });
});

describe('user guards', () => {
  it('the last active Admin cannot be deactivated or re-roled', () => {
    // Seed has exactly one Admin (u-admin).
    expect(S().setUserRole('u-admin', 'View-only').ok).toBe(false);
    expect(S().setUserActive('u-admin', false).ok).toBe(false);
    // Add a second Admin → now the first can change.
    S().addUser({ name: 'Second Admin', email: 'a2@example.com', role: 'Admin' });
    expect(S().setUserRole('u-admin', 'View-only').ok).toBe(true);
  });

  it('a user cannot deactivate themselves', () => {
    S().signInAs('u-editor-1');
    expect(S().setUserActive('u-editor-1', false).ok).toBe(false);
    expect(S().users.find((u) => u.id === 'u-editor-1')?.active).toBe(true);
  });

  it('adding a user appends an active user and a change-log entry', () => {
    const before = S().users.length;
    const logBefore = S().userRoleLog.length;
    S().addUser({ name: 'New Person', email: 'np@example.com', role: 'View-only' });
    expect(S().users.length).toBe(before + 1);
    expect(S().userRoleLog.length).toBe(logBefore + 1);
    expect(S().userRoleLog[0].type).toBe('user');
  });
});

describe('reset demo data', () => {
  it('restores users and permissions', () => {
    S().setPermission('View-only', 'openResultsForecast', false);
    S().addUser({ name: 'Temp', email: 'temp@example.com', role: 'View-only' });
    expect(can('View-only', 'openResultsForecast')).toBe(false);
    S().resetDemoData();
    expect(S().users.length).toBe(6);
    expect(can('View-only', 'openResultsForecast')).toBe(true);
  });
});
