import { describe, it, expect } from 'vitest';
import { allowedTransitions, TRANSITIONS, canCancelFrom, isLocked } from '@/lib/lifecycle';
import type { OfferRecord } from '@/lib/types';

function tx(from: string, to: string) {
  return TRANSITIONS.find((t) => t.from.includes(from) && t.to === to)!;
}

describe('lifecycle transitions & guards (section 7.3)', () => {
  it('Editor can submit a draft; approver cannot', () => {
    expect(allowedTransitions('Draft', 'Offer Team Editor').map((t) => t.to)).toContain('Proposed');
    expect(allowedTransitions('Draft', 'Approver (TBC)').map((t) => t.to)).not.toContain('Proposed');
  });

  it('Approve is only available to Approver and Admin', () => {
    expect(allowedTransitions('Proposed', 'Approver (TBC)').map((t) => t.label)).toContain(
      'Approve offer and forecast',
    );
    expect(allowedTransitions('Proposed', 'Admin').map((t) => t.label)).toContain(
      'Approve offer and forecast',
    );
    expect(allowedTransitions('Proposed', 'Offer Team Editor').map((t) => t.label)).not.toContain(
      'Approve offer and forecast',
    );
  });

  it('Approve guard needs forecast entered OR forecast not needed', () => {
    const t = tx('Proposed', 'Planning Phase');
    const noForecast: OfferRecord = { category: 'MERCH', offerDesign: 'Fixed Point' };
    expect(t.guard!(noForecast).ok).toBe(false);
    const withForecast: OfferRecord = {
      ...noForecast,
      activationByDayLow: 100,
      activationByDayHigh: 200,
      bonusRateLow: 0.5,
      bonusRateHigh: 0.6,
    };
    expect(t.guard!(withForecast).ok).toBe(true);
    // Activation Only - Internal Reward => forecast not needed => ok even without forecast
    expect(t.guard!({ offerDesign: 'Activation Only - Internal Reward' }).ok).toBe(true);
  });

  it('Planning -> Approved/Build needs submission form and Kognitiv = Yes', () => {
    const t = tx('Planning Phase', 'Approved / Build Phase');
    expect(t.guard!({}).ok).toBe(false);
    expect(t.guard!({ submissionFormMade: 'Yes', submittedToKognitiv: 'Yes' }).ok).toBe(true);
  });

  it('Audited guard checks card, audit, SKU list and targeted MD', () => {
    const t = tx('Approved / Build Phase', 'Audited / Ready to go');
    const base = { offerCardBuilt: 'Yes', offerAudited: 'Partially', skuList: 'N/A' };
    expect(t.guard!(base).ok).toBe(true);
    expect(t.guard!({ ...base, broadVsTargeted: 'Targeted', memberDescriptor: 'N/A' }).ok).toBe(false);
    expect(
      t.guard!({ ...base, broadVsTargeted: 'Targeted', memberDescriptor: 'VIP_LIST' }).ok,
    ).toBe(true);
  });

  it('Data Final needs the three actuals', () => {
    const t = tx('Completed', 'Completed - Data Final');
    expect(t.guard!({}).ok).toBe(false);
    expect(t.guard!({ activations: 100, bonusedMembers: 50, bonusPtsIssued: 5000 }).ok).toBe(true);
  });

  it('cancel available except when already Cancelled', () => {
    expect(canCancelFrom('Live', 'Offer Team Editor')).toBe(true);
    expect(canCancelFrom('Cancelled', 'Admin')).toBe(false);
    expect(canCancelFrom('Live', 'View-only')).toBe(false);
  });

  it('reinstate is Admin-only from Cancelled', () => {
    expect(allowedTransitions('Cancelled', 'Admin').map((t) => t.label)).toContain('Reinstate');
    expect(allowedTransitions('Cancelled', 'Offer Team Editor')).toEqual([]);
  });
});

describe('A4 lock', () => {
  it('Completed - Data Final and Cancelled are locked; others are not', () => {
    expect(isLocked('Completed - Data Final')).toBe(true);
    expect(isLocked('Cancelled')).toBe(true);
    expect(isLocked('Live')).toBe(false);
    expect(isLocked('Draft')).toBe(false);
  });
  it('a locked status has no onward lifecycle transition for Editor', () => {
    expect(allowedTransitions('Completed - Data Final', 'Offer Team Editor')).toEqual([]);
  });
});
