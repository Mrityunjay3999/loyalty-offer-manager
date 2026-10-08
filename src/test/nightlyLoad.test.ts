import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { includedOffers, offerExceptions } from '@/lib/feed';
import type { OfferRecord } from '@/lib/types';

describe('C6 Simulate nightly load (store action)', () => {
  beforeEach(() => {
    // isolate feed state between tests
    useAppStore.setState({ feedState: {}, feedLog: [] });
  });

  it('marks included, exception-free offers as loaded and writes a log entry', () => {
    const { offers, categorySubCategory } = useAppStore.getState();
    // A real seeded offer that is in the feed and passes validation.
    const clean = includedOffers(offers).find(
      (o) => offerExceptions(o, categorySubCategory).length === 0,
    );
    expect(clean, 'expected at least one clean seeded offer in the feed').toBeTruthy();
    const draft: OfferRecord = { _uid: 'nl-draft', buildStatus: 'Draft' };
    useAppStore.setState({ offers: [draft, ...offers] });

    useAppStore.getState().simulateNightlyLoad();

    const { feedState, feedLog } = useAppStore.getState();
    // clean offer loaded
    expect(feedState[clean!._uid!]?.loadedAt).toBeTruthy();
    // draft never enters the feed, so it is never marked loaded
    expect(feedState['nl-draft']).toBeUndefined();
    // a success log entry was appended
    expect(feedLog.length).toBeGreaterThan(0);
    expect(feedLog[0].status).toBe('Success');
    expect(feedLog[0].message).toMatch(/Nightly load/);
  });

  it('does not mark an included offer that fails validation (missing required field)', () => {
    const broken: OfferRecord = { _uid: 'nl-broken', buildStatus: 'Proposed', offerName: 'Broken' };
    const prior = useAppStore.getState().offers;
    useAppStore.setState({ offers: [broken, ...prior] });

    useAppStore.getState().simulateNightlyLoad();

    expect(useAppStore.getState().feedState['nl-broken']).toBeUndefined();
    expect(useAppStore.getState().feedLog[0].message).toMatch(/skipped as exceptions/);
  });
});
