// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, isChangedSinceImport, submittedInPrototype, STORAGE_KEY } from '@/store/useAppStore';
import { importMetaOf } from '@/store/importedBase';
import { computeRfCells } from '@/lib/rfEngine';

const S = () => useAppStore.getState();
const byName = (n: string) => S().offers.find((o) => o.offerName === n)!;

beforeEach(() => {
  S().resetDemoData();
});

describe('A7 seed: imported base + demo sample', () => {
  it('holds the 2,425 imported offers plus the 1 demo sample', () => {
    expect(S().baseLoaded).toBe(true);
    expect(S().offers).toHaveLength(2426);
    const demo = S().offers.filter((o) => o._demoSample);
    expect(demo.map((o) => o.offerId)).toEqual([1570]);
    expect(demo[0].buildStatus).toBe('Cancelled');
  });
  it('keeps the _import block beside each imported offer', () => {
    const o = byName('20260330_CATLRGBGS_10X');
    const m = importMetaOf(o._uid)!;
    expect(m.source).toBe('Excel R&F tab + Metadata');
    expect(m.inExcelRfTab).toBe(true);
    expect(m.excelRfRefNumber).toBe(547);
    expect(o._import).toBeUndefined(); // not on the record itself
  });
});

describe('A7 diffs, badges and the round trip', () => {
  it('editing Step 7 / Step 9 recalculates the row and sets Changed since import', () => {
    const o = byName('20260330_CATLRGBGS_10X');
    const before = computeRfCells(o, new Date(2026, 10, 11));
    expect(isChangedSinceImport(o._uid, S().offerDiffs)).toBe(false);
    S().updateOffer(o._uid!, { bonusPtsIssued: 100_000_000, bonusRateLow: 0.2 });
    const after = byName('20260330_CATLRGBGS_10X');
    const cells = computeRfCells(after, new Date(2026, 10, 11));
    expect(cells.R).toBe(100_000_000);
    expect(cells.AH).toBe(0.2);
    expect(cells.AN).not.toBe(before.AN);
    expect(isChangedSinceImport(o._uid, S().offerDiffs)).toBe(true);
  });
  it('writing the same values does not count as a change', () => {
    const o = byName('20260323_TIERA_50_5000');
    S().updateOffer(o._uid!, { ...o });
    expect(isChangedSinceImport(o._uid, S().offerDiffs)).toBe(false);
  });
  it('localStorage stays under 2 MB after editing 50 offers', () => {
    const fifty = S().offers.slice(1, 51);
    for (const o of fifty) S().updateOffer(o._uid!, { activations: 1234, forecastStatus: 'Done' });
    const payload = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(payload.length).toBeGreaterThan(0);
    expect(payload.length).toBeLessThan(2 * 1024 * 1024);
    expect(Object.keys(S().offerDiffs)).toHaveLength(50);
    expect(payload).not.toContain('"offers"'); // the merged list is never persisted
  });
  it('Reset demo data returns to the seed', () => {
    const o = byName('20260330_CATLRGBGS_10X');
    S().updateOffer(o._uid!, { activations: 1 });
    const uid = S().createDraft();
    expect(S().offers.some((x) => x._uid === uid)).toBe(true);
    S().resetDemoData();
    expect(S().offers).toHaveLength(2426);
    expect(Object.keys(S().offerDiffs)).toHaveLength(0);
    expect(S().createdOffers).toHaveLength(0);
    expect(byName('20260330_CATLRGBGS_10X').activations).toBe(148186);
  });
});

describe('A6 approvals are not flooded by imported offers', () => {
  it('imported Proposed offers are not in the queue until their status changes in the prototype', () => {
    const proposed = S().offers.filter((o) => o.buildStatus === 'Proposed');
    expect(proposed.length).toBeGreaterThan(50);
    expect(proposed.filter((o) => submittedInPrototype(o, S().offerDiffs))).toHaveLength(0);
    const o = S().offers.find((x) => x.buildStatus === 'Planning Phase')!;
    S().changeStatus(o._uid!, 'Proposed', 'Back to proposed');
    const changed = S().offers.find((x) => x._uid === o._uid)!;
    expect(submittedInPrototype(changed, S().offerDiffs)).toBe(true);
  });
  it('a new offer gets the next auto-generated Offer ID after the import (2609)', () => {
    expect(S().nextOfferId()).toBe(2609);
  });
});
