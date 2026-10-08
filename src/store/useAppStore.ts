import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  freshSampleOffers,
  dropdowns as seedDropdowns,
  reference,
  checklistFields,
  fieldsByStep,
} from '@/lib/dataLoaders';
import { todayISO } from '@/lib/format';
import { computeNextOfferId } from '@/lib/offerId';
import { includedOffers, offerExceptions } from '@/lib/feed';
import databricksTablesJson from '@/data/databricksTables.json';
import type {
  OfferRecord,
  AuditEntry,
  Role,
  SavedView,
  FeedLogEntry,
  Dropdowns,
  CategorySubCategory,
  TieringDefinition,
  LifecycleStatus,
  OfferSetupCombo,
  SoftLockPlannerRow,
  ChildPromotion,
  GroupedChild,
  OfferValue,
} from '@/lib/types';

export const STORAGE_KEY = 'lom-prototype-v2';
const V1_KEY = 'lom-prototype-v1';

let idCounter = 0;
/** Small monotonic id generator (prototype-only; no crypto needed). */
export function nextId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** One "Imported from Loyalty Calendar" audit entry per seed offer (section 7.6). */
function seedAuditLog(offers: OfferRecord[]): AuditEntry[] {
  return offers.map((o) => ({
    id: nextId('audit'),
    offerId: String(o.offerId ?? ''),
    offerUid: o._uid,
    timestamp: new Date('2026-09-01T09:00:00').toISOString(),
    user: 'Admin' as Role,
    action: 'imported',
    comment: 'Imported from Loyalty Calendar',
  }));
}

/** Editable reference tables seeded from reference.json. Large static lookups
 *  (fiscalCalendar, softLockByStartDate, transactionTypes reference) stay in the
 *  imported JSON and are not persisted, since they are never edited. */
interface EditableReference {
  dropdowns: Dropdowns;
  categorySubCategory: CategorySubCategory[];
  tieringDefinitions: TieringDefinition[];
  lifecycle: LifecycleStatus[];
  offerSetupCombos: OfferSetupCombo[];
  softLockPlanner: SoftLockPlannerRow[];
  deactivationRules: string[];
  evergreenOffers: Array<Record<string, OfferValue>>;
  /** Set of dropdown "list::value" entries the Admin has retired (proposed rule). */
  retiredValues: string[];
}

function seedEditableReference(): EditableReference {
  return JSON.parse(
    JSON.stringify({
      dropdowns: seedDropdowns,
      categorySubCategory: reference.categorySubCategory,
      tieringDefinitions: reference.tieringDefinitions,
      lifecycle: reference.lifecycle,
      offerSetupCombos: reference.offerSetupCombos,
      softLockPlanner: reference.softLockPlanner,
      deactivationRules: reference.deactivationRules,
      evergreenOffers: reference.evergreenOffers,
      retiredValues: [],
    }),
  ) as EditableReference;
}

export interface AppState extends EditableReference {
  offers: OfferRecord[];
  auditLog: AuditEntry[];
  role: Role;
  savedViews: SavedView[];
  feedLog: FeedLogEntry[];
  groupedChildren: Record<string, ChildPromotion[]>;
  feedState: Record<string, { loadedAt?: string }>;
  databricksTableNames: { attributes: string | null; metrics: string | null };
  /** C6: editable per-field business definition + status. */
  fieldDefinitions: Record<string, { businessDefinition?: string; status?: 'Draft' | 'Confirmed' }>;

  // --- actions ---
  setRole: (role: Role) => void;
  resetDemoData: () => void;
  addAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  createDraft: () => string; // returns new _uid
  updateOffer: (uid: string, patch: Partial<OfferRecord>) => void;
  deleteOffer: (uid: string) => void;
  copyOffer: (uid: string) => string | null; // returns new _uid
  cancelOffer: (uid: string, reason: string, dateISO?: string) => void;
  changeStatus: (uid: string, newStatus: string, comment?: string, extra?: Partial<OfferRecord>) => void;
  /** A4: return a locked offer to its previous status (Admin, comment). */
  reopenOffer: (uid: string, comment?: string) => void;
  addSavedView: (view: Omit<SavedView, 'id'>) => void;
  deleteSavedView: (id: string) => void;
  addFeedLog: (entry: Omit<FeedLogEntry, 'id' | 'timestamp'>) => void;
  setGroupedChildren: (uid: string, children: ChildPromotion[]) => void;
  /** Patch any editable reference slice and log it to the audit trail. */
  editReference: (patch: Partial<EditableReference>, summary: string) => void;
  /** Next auto-generated Offer ID = max(existing numeric offerId) + 1 (A1). */
  nextOfferId: () => number;
  /** C4: nightly load — stamp included offers without exceptions, log counts. */
  simulateNightlyLoad: () => void;
  setDatabricksTableName: (key: 'attributes' | 'metrics', name: string) => void;
  /** C6: set a field's business definition / status (Admin). */
  setFieldDefinition: (fieldId: string, patch: { businessDefinition?: string; status?: 'Draft' | 'Confirmed' }) => void;
}

const RESULT_FIELD_IDS = fieldsByStep['9. Results'].map((f) => f.id);
const CHECKLIST_FIELD_IDS = checklistFields.map((f) => f.id);

type AppData = EditableReference & {
  offers: OfferRecord[];
  auditLog: AuditEntry[];
  role: Role;
  savedViews: SavedView[];
  feedLog: FeedLogEntry[];
  groupedChildren: Record<string, ChildPromotion[]>;
  /** C4: per-offer last Databricks load timestamp (keyed by _uid). */
  feedState: Record<string, { loadedAt?: string }>;
  /** C2: editable Databricks table names. */
  databricksTableNames: { attributes: string | null; metrics: string | null };
  /** C6: editable per-field business definition + status. */
  fieldDefinitions: Record<string, { businessDefinition?: string; status?: 'Draft' | 'Confirmed' }>;
};

/** Map a seed grouped child (verbose spreadsheet keys) to an editable row. */
function toChild(g: GroupedChild, i: number): ChildPromotion {
  const val = (k: string) => (g[k] === null || g[k] === undefined ? '' : g[k]);
  return {
    id: `child-seed-${i}`,
    offerName: String(val('Offer Name')),
    startDate: String(val('Start Date')).slice(0, 10),
    endDate: String(val('End Date')).slice(0, 10),
    numberOfDays: (g['# of Days Offer Ran'] as number) ?? '',
    transactionExternalRefId: String(val('Transaction External Ref ID')),
    activationDescriptor: String(val('Activation Descriptor (External Reference ID)')),
    activations: (g['Activations'] as number) ?? '',
    bonusedMembers: (g['Bonused Members'] as number) ?? '',
    bonusPtsIssued: (g['Bonus Pts Issued'] as number) ?? '',
  };
}

/** Seed child promotions for the two documented grouped sample offers. */
function seedGroupedChildren(offers: OfferRecord[]): Record<string, ChildPromotion[]> {
  const out: Record<string, ChildPromotion[]> = {};
  const samples = reference.groupedChildrenSamples;
  for (const o of offers) {
    const name = String(o.offerName ?? '');
    if (o._uid && samples[name]) {
      out[o._uid] = samples[name].map((g, i) => toChild(g, i));
    }
  }
  return out;
}

function initialState(): AppData {
  const offers = freshSampleOffers();
  return {
    offers,
    auditLog: seedAuditLog(offers),
    role: 'Offer Team Editor',
    savedViews: [],
    feedLog: [],
    groupedChildren: seedGroupedChildren(offers),
    feedState: {},
    databricksTableNames: {
      attributes: databricksTablesJson.attributes.tableName,
      metrics: databricksTablesJson.metrics.tableName,
    },
    fieldDefinitions: {},
    ...seedEditableReference(),
  };
}

/** Best-effort v1 -> v2 migration (ground rule 8): keep offers + audit log,
 *  drop the removed "Offer due date" value. Runs once, before the store reads
 *  storage. Fresh seed is used if anything is missing. */
function migrateV1ToV2(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return; // already on v2
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return;
    const v1 = JSON.parse(raw);
    const v1offers = v1?.state?.offers;
    const v1audit = v1?.state?.auditLog;
    const seeded = initialState();
    const offers = Array.isArray(v1offers) && v1offers.length
      ? v1offers.map((o: OfferRecord) => {
          const c = { ...o };
          delete (c as Record<string, unknown>).offerDueDate;
          return c;
        })
      : seeded.offers;
    const auditLog = Array.isArray(v1audit) && v1audit.length ? v1audit : seeded.auditLog;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { ...seeded, offers, auditLog }, version: 2 }),
    );
  } catch {
    /* ignore — fall back to fresh seed */
  }
}
migrateV1ToV2();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState(),
      setRole: (role) => set({ role }),
      resetDemoData: () => {
        // Rebuild every seeded slice from the source JSON, keeping the chosen role.
        set((state) => ({ ...initialState(), role: state.role }));
      },

      addAudit: (entry) =>
        set((s) => ({
          auditLog: [
            {
              id: nextId('audit'),
              timestamp: entry.timestamp ?? new Date().toISOString(),
              ...entry,
            } as AuditEntry,
            ...s.auditLog,
          ],
        })),

      createDraft: () => {
        const uid = nextId('offer');
        const offer: OfferRecord = {
          _uid: uid,
          _updatedAt: new Date().toISOString(),
          buildStatus: 'Draft',
        };
        set((s) => ({ offers: [offer, ...s.offers] }));
        get().addAudit({ offerId: '', offerUid: uid, user: get().role, action: 'created', comment: 'New draft created' });
        return uid;
      },

      updateOffer: (uid, patch) =>
        set((s) => ({
          offers: s.offers.map((o) =>
            o._uid === uid ? { ...o, ...patch, _updatedAt: new Date().toISOString() } : o,
          ),
        })),

      deleteOffer: (uid) =>
        set((s) => ({ offers: s.offers.filter((o) => o._uid !== uid) })),

      copyOffer: (uid) => {
        const src = get().offers.find((o) => o._uid === uid);
        if (!src) return null;
        const newUid = nextId('offer');
        const copy: OfferRecord = { ...src };
        copy._uid = newUid;
        copy._updatedAt = new Date().toISOString();
        delete copy._sampleReason;
        copy.offerId = ''; // blank per 11.2
        copy.offerName = `COPY OF ${src.offerName ?? ''}`.trim();
        copy.buildStatus = 'Draft';
        for (const id of CHECKLIST_FIELD_IDS) copy[id] = ''; // checklist reset
        for (const id of RESULT_FIELD_IDS) copy[id] = ''; // results cleared
        // forecast kept (not touched)
        set((s) => ({ offers: [copy, ...s.offers] }));
        const role = get().role;
        get().addAudit({
          offerId: String(src.offerId ?? ''),
          offerUid: uid,
          user: role,
          action: 'copied from',
          comment: `Copied to new draft "${copy.offerName}"`,
        });
        get().addAudit({
          offerId: '',
          offerUid: newUid,
          user: role,
          action: 'copied from',
          comment: `Copied from "${src.offerName ?? src.offerId}"`,
        });
        return newUid;
      },

      cancelOffer: (uid, reason, dateISO) => {
        const src = get().offers.find((o) => o._uid === uid);
        const prev = src?.buildStatus;
        get().updateOffer(uid, {
          buildStatus: 'Cancelled',
          _prevStatus: String(prev ?? ''),
          dateOfChangeCancel: dateISO ?? todayISO(),
        });
        get().addAudit({
          offerId: String(src?.offerId ?? ''),
          offerUid: uid,
          user: get().role,
          action: 'cancelled',
          fieldLabel: 'Status',
          oldValue: prev ?? null,
          newValue: 'Cancelled',
          comment: reason,
        });
      },

      changeStatus: (uid, newStatus, comment, extra) => {
        const src = get().offers.find((o) => o._uid === uid);
        const prev = src?.buildStatus;
        get().updateOffer(uid, {
          buildStatus: newStatus,
          _prevStatus: String(prev ?? ''),
          ...(extra ?? {}),
        });
        get().addAudit({
          offerId: String(src?.offerId ?? ''),
          offerUid: uid,
          user: get().role,
          action: 'status changed',
          fieldLabel: 'Status',
          oldValue: prev ?? null,
          newValue: newStatus,
          comment,
        });
      },

      reopenOffer: (uid, comment) => {
        const src = get().offers.find((o) => o._uid === uid);
        if (!src) return;
        const prev = String(src.buildStatus ?? '');
        const to = src._prevStatus && src._prevStatus !== '' ? src._prevStatus : 'Proposed';
        get().updateOffer(uid, { buildStatus: to, _prevStatus: prev });
        get().addAudit({
          offerId: String(src.offerId ?? ''),
          offerUid: uid,
          user: get().role,
          action: 'status changed',
          fieldLabel: 'Status',
          oldValue: prev,
          newValue: to,
          comment: comment ? `Reopened: ${comment}` : 'Reopened',
        });
      },

      addSavedView: (view) =>
        set((s) => ({ savedViews: [...s.savedViews, { id: nextId('view'), ...view }] })),
      deleteSavedView: (id) =>
        set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id) })),

      addFeedLog: (entry) =>
        set((s) => ({
          feedLog: [
            { id: nextId('feed'), timestamp: new Date().toISOString(), ...entry },
            ...s.feedLog,
          ],
        })),

      setGroupedChildren: (uid, children) =>
        set((s) => ({ groupedChildren: { ...s.groupedChildren, [uid]: children } })),

      nextOfferId: () => computeNextOfferId(get().offers),

      simulateNightlyLoad: () => {
        const s = get();
        const included = includedOffers(s.offers);
        const now = new Date().toISOString();
        const cleanUids: string[] = [];
        let skipped = 0;
        for (const o of included) {
          if (offerExceptions(o, s.categorySubCategory).length === 0 && o._uid) cleanUids.push(o._uid);
          else skipped += 1;
        }
        const feedState = { ...s.feedState };
        for (const uid of cleanUids) feedState[uid] = { loadedAt: now };
        set({ feedState });
        get().addFeedLog({
          records: cleanUids.length,
          status: 'Success',
          message: `Nightly load: ${cleanUids.length} to attributes, ${cleanUids.length} to metrics, ${skipped} skipped as exceptions.`,
        });
      },

      setDatabricksTableName: (key, name) => {
        set((st) => ({ databricksTableNames: { ...st.databricksTableNames, [key]: name } }));
        get().addAudit({ offerId: 'REFERENCE', user: get().role, action: 'reference edited', comment: `Set Databricks ${key} table name to "${name}"` });
      },

      setFieldDefinition: (fieldId, patch) => {
        set((st) => ({ fieldDefinitions: { ...st.fieldDefinitions, [fieldId]: { ...st.fieldDefinitions[fieldId], ...patch } } }));
        get().addAudit({ offerId: 'REFERENCE', user: get().role, action: 'reference edited', comment: `Edited business definition for ${fieldId}` });
      },

      editReference: (patch, summary) => {
        set((s) => ({ ...s, ...patch }));
        get().addAudit({
          offerId: 'REFERENCE',
          user: get().role,
          action: 'reference edited',
          comment: summary,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 2,
    },
  ),
);
