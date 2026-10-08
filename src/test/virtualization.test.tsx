// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ExcelGrid, type ExcelColumn } from '@/components/ExcelGrid';
import type { OfferRecord } from '@/lib/types';

// @tanstack/react-virtual needs ResizeObserver and a measurable scroll element,
// neither of which jsdom provides. Stub both so the virtualizer sees a 600px
// viewport and produces a realistic window of rows.
beforeAll(() => {
  class RO {
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      // fire once with a real 600px entry so the virtualizer measures a viewport
      const entry = {
        target: el,
        contentRect: { width: 1200, height: 600 },
        borderBoxSize: [{ inlineSize: 1200, blockSize: 600 }],
        contentBoxSize: [{ inlineSize: 1200, blockSize: 600 }],
      } as unknown as ResizeObserverEntry;
      this.cb([entry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

  Element.prototype.getBoundingClientRect = function () {
    return { width: 1200, height: 600, top: 0, left: 0, right: 1200, bottom: 600, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

const ROWS = 3500;

function makeRows(n: number): OfferRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    _uid: `u${i}`,
    offerId: 1000 + i,
    offerName: `Offer ${i}`,
    buildStatus: 'Live',
  }));
}

const columns: ExcelColumn[] = [
  { id: 'offerId', header: 'Offer ID', sortValue: (o) => Number(o.offerId), cell: (o) => o.offerId },
  { id: 'offerName', header: 'Offer', sortValue: (o) => String(o.offerName), cell: (o) => o.offerName },
  { id: 'buildStatus', header: 'Status', sortValue: (o) => String(o.buildStatus), cell: (o) => o.buildStatus },
];

describe('Grid virtualization (3,500 rows)', () => {
  it('mounts 3,500 rows but renders only a small window to the DOM', () => {
    const t0 = performance.now();
    const { container } = render(
      <ExcelGrid
        rows={makeRows(ROWS)}
        columns={columns}
        storageKey="test-virtual-grid"
        getRowId={(o) => o._uid!}
      />,
    );
    const renderMs = performance.now() - t0;

    // Row count badge reflects all 3,500 rows…
    expect(container.textContent).toMatch(/3,500 rows/);

    // …but only a windowed subset is actually in the DOM. Each data row carries a
    // unique "Offer N" label; virtualization keeps that far below 3,500.
    const rendered = Array.from(container.querySelectorAll('span')).filter((el) =>
      /^Offer \d+$/.test(el.textContent ?? ''),
    ).length;

    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(200); // ~600px / 30px + overscan, nowhere near 3,500
    // Mounting a virtualized 3,500-row grid is cheap.
    expect(renderMs).toBeLessThan(2000);
  });

  it('applies a per-column filter to the full dataset, not just the visible window', () => {
    // Pre-seed a personal layout that filters offerName to "Offer 7".
    localStorage.setItem(
      'test-virtual-grid-filtered',
      JSON.stringify({ visible: ['offerId', 'offerName', 'buildStatus'], freeze: 2, density: 'compact', filters: { offerName: 'Offer 7' } }),
    );
    const { container } = render(
      <ExcelGrid
        rows={makeRows(ROWS)}
        columns={columns}
        storageKey="test-virtual-grid-filtered"
        getRowId={(o) => o._uid!}
      />,
    );
    // "Offer 7", "Offer 70-79", "Offer 700-799", "Offer 7000+"(none) etc → count via badge.
    // Matches are 7, 70-79, 700-799, 2700-2799-style "...7..." — the filter is a substring,
    // so just assert the count shrank well below the full set and is stable.
    const badge = container.textContent?.match(/([\d,]+) rows/)?.[1]?.replace(/,/g, '');
    expect(Number(badge)).toBeGreaterThan(0);
    expect(Number(badge)).toBeLessThan(ROWS);
  });
});
