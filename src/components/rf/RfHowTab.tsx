import type { OfferRecord } from '@/lib/types';

/** How it is calculated (v3 C6). Filled in fully in M5. */
export function RfHowTab({ offers, asOf }: { offers: OfferRecord[]; asOf: Date }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted">
      {offers.length.toLocaleString()} offers, as of {asOf.toLocaleDateString('en-US')}.
    </div>
  );
}
