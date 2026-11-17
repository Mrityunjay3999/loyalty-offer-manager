// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

describe('A7 migration from v2', () => {
  it('keeps prototype-created offers, drops v2 seed copies and re-assigns colliding IDs', async () => {
    localStorage.clear();
    const v2 = {
      state: {
        offers: [
          { _uid: 'seed-0-5241', offerId: 5241, offerName: '20261216_JBPFISHAQUARIUMDECORBASH_15X', buildStatus: 'Planning Phase' },
          { _uid: 'offer-abc-1', offerId: 324234234, offerName: 'Thanksgiving offer', buildStatus: 'Forecast Only' },
          { _uid: 'offer-abc-2', offerId: 4661, offerName: 'My copy', buildStatus: 'Draft' },
        ],
        auditLog: [
          { id: 'a1', offerId: '', offerUid: 'offer-abc-1', timestamp: '2026-10-01T00:00:00Z', user: 'Admin', action: 'created' },
          { id: 'a2', offerId: '5241', offerUid: 'seed-0-5241', timestamp: '2026-09-01T00:00:00Z', user: 'Admin', action: 'imported' },
        ],
        savedViews: [{ id: 'v1', name: 'Mine', role: 'Offer Team Editor', state: {} }],
      },
      version: 2,
    };
    localStorage.setItem('lom-prototype-v2', JSON.stringify(v2));

    vi.resetModules();
    const mod = await import('@/store/useAppStore');
    await mod.ensureBaseLoaded();
    const s = mod.useAppStore.getState();

    expect(localStorage.getItem('lom-prototype-v3')).not.toBeNull();
    expect(s.createdOffers.map((o) => o.offerName)).toEqual(['Thanksgiving offer', 'My copy']);
    // the seed copy is gone; the imported record replaces it
    expect(s.offers.filter((o) => o.offerName === '20261216_JBPFISHAQUARIUMDECORBASH_15X')).toHaveLength(1);
    expect(s.offers.find((o) => o.offerName === '20261216_JBPFISHAQUARIUMDECORBASH_15X')!._uid).toMatch(/^imp-/);
    // 4661 collides with an imported offer -> new ID from the generator (max + 1;
    // the kept test offer 324234234 is the current maximum)
    const copy = s.createdOffers.find((o) => o.offerName === 'My copy')!;
    expect(copy.offerId).toBe(324234235);
    expect(s.migrationLog.join(' ')).toMatch(/4661/);
    // audit log and saved views kept (the old "imported" seed entry dropped)
    expect(s.auditLog.map((a) => a.id)).toEqual(['a1']);
    expect(s.savedViews.map((v) => v.name)).toEqual(['Mine']);
  });
});
