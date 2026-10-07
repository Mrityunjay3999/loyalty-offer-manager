import { describe, it, expect } from 'vitest';
import {
  routeTable, attributeColumns, metricColumns, notLoadedColumns,
  includedOffers, offerExceptions, feedChip, formatByDatatype,
} from '@/lib/feed';
import { metadataFields, reference } from '@/lib/dataLoaders';
import type { OfferRecord } from '@/lib/types';

describe('C2 feed routing', () => {
  it('routes 169 columns to 101 attributes / 54 metrics / 14 not loaded', () => {
    expect(metadataFields.length).toBe(169);
    expect(attributeColumns.length).toBe(101);
    expect(metricColumns.length).toBe(54);
    expect(notLoadedColumns.length).toBe(14);
  });
  it('includeInDatalake=No goes to notLoaded; CM to metrics; MA to attributes', () => {
    const notLoaded = metadataFields.find((m) => m.includeInDatalake === 'No')!;
    expect(routeTable(notLoaded)).toBe('notLoaded');
    const cm = metadataFields.find((m) => m.type === 'CM' && m.includeInDatalake !== 'No')!;
    expect(routeTable(cm)).toBe('metrics');
  });
});

describe('C3 inclusion', () => {
  it('excludes Draft and Cancelled; includes IMP only', () => {
    const offers: OfferRecord[] = [
      { _uid: 'a', buildStatus: 'Draft' },
      { _uid: 'b', buildStatus: 'Cancelled' },
      { _uid: 'c', buildStatus: 'Live', offerDesign: 'IMP only' },
      { _uid: 'd', buildStatus: 'Proposed' },
    ];
    const inc = includedOffers(offers).map((o) => o._uid);
    expect(inc).toContain('c');
    expect(inc).toContain('d');
    expect(inc).not.toContain('a');
    expect(inc).not.toContain('b');
  });
});

describe('C5 exceptions', () => {
  it('a missing required field creates an exception', () => {
    const o: OfferRecord = { _uid: 'x', buildStatus: 'Proposed', offerName: 'N' };
    const ex = offerExceptions(o, reference.categorySubCategory);
    expect(ex.some((e) => e.fieldId === 'startDate')).toBe(true);
  });
  it('invalid sub-category for category is an exception', () => {
    const o: OfferRecord = { _uid: 'x', buildStatus: 'Proposed', category: 'MERCH', subCategory: 'HOTEL' };
    const ex = offerExceptions(o, reference.categorySubCategory);
    expect(ex.some((e) => e.fieldId === 'subCategory')).toBe(true);
  });
});

describe('C4 chip + C2 datatype formatting', () => {
  it('chip reflects draft / cancelled / loaded / waiting', () => {
    expect(feedChip({ buildStatus: 'Draft' }, undefined, [])).toBe('Not in feed (Draft)');
    expect(feedChip({ buildStatus: 'Cancelled' }, undefined, [])).toBe('Not in feed (Cancelled)');
  });
  it('datatype: Date / 6-decimals / N/A blank', () => {
    expect(formatByDatatype('Decimal X.XXXXXX', '0.88', true)).toBe('0.880000');
    expect(formatByDatatype('Text', 'N/A', true)).toBe('');
    expect(formatByDatatype('Text', 'Not captured in the calendar form', false)).toBe('Not captured in the calendar form');
  });
});
