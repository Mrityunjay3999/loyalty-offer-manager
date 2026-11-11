// v3 A7: the imported offers are a read-only base loaded once with a dynamic
// import (so the 2,425 records do not slow down first paint). The store keeps
// only per-offer diffs and prototype-created offers in localStorage and merges
// them over this base. Import metadata (_import) is kept beside each record.
import { freshSampleOffers } from '@/lib/dataLoaders';
import type { ImportMeta, OfferRecord } from '@/lib/types';

let BASE: OfferRecord[] = [];
let BY_UID = new Map<string, OfferRecord>();
let META = new Map<string, ImportMeta>();
let IMPORTED_IDS = new Set<number>();
let loaded = false;
let loading: Promise<void> | null = null;

/** Imported offers + demo samples, in seed order. Empty until loaded. */
export function getBase(): OfferRecord[] {
  return BASE;
}
export function baseOffer(uid: string | undefined): OfferRecord | undefined {
  return uid ? BY_UID.get(uid) : undefined;
}
export function isBaseUid(uid: string | undefined): boolean {
  return !!uid && BY_UID.has(uid);
}
export function importMetaOf(uid: string | undefined): ImportMeta | undefined {
  return uid ? META.get(uid) : undefined;
}
export function importedOfferIds(): Set<number> {
  return IMPORTED_IDS;
}
export function isBaseLoaded(): boolean {
  return loaded;
}

/** Load the generated base once. Resolves immediately when already loaded. */
export function loadBaseData(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = import('@/data/imported/offers.base.json').then((mod) => {
      const raw = (mod.default ?? mod) as unknown as Array<OfferRecord & { _import?: ImportMeta }>;
      const meta = new Map<string, ImportMeta>();
      const imported: OfferRecord[] = raw.map((r) => {
        const { _import, ...rest } = r;
        if (_import && rest._uid) meta.set(rest._uid, _import);
        return rest as OfferRecord;
      });
      const ids = new Set(imported.map((o) => o.offerId).filter((x): x is number => typeof x === 'number'));
      const names = new Set(imported.map((o) => String(o.offerName ?? '')));
      // Demo samples not in the Excel files stay in the seed (only 1570 today).
      const demo = freshSampleOffers()
        .filter((s) => !(typeof s.offerId === 'number' && ids.has(s.offerId)) && !names.has(String(s.offerName ?? '')))
        .map((s) => ({ ...s, _demoSample: true }));
      BASE = [...demo, ...imported];
      BY_UID = new Map(BASE.map((o) => [o._uid as string, o]));
      META = meta;
      IMPORTED_IDS = ids;
      loaded = true;
    });
  }
  return loading;
}
