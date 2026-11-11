import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  dropdowns as seedDropdowns,
  reference,
  checklistFields,
  fieldsByStep,
} from '@/lib/dataLoaders';
import { todayISO } from '@/lib/format';
import { computeNextOfferId } from '@/lib/offerId';
import { includedOffers, offerExceptions, setFeedExemption } from '@/lib/feed';
import { buildDefaultMatrix, registerMatrixAccessor, capabilityMeta } from '@/lib/permissions';
import databricksTablesJson from '@/data/databricksTables.json';
import { getBase, baseOffer, isBaseUid, loadBaseData, importedOfferIds } from './importedBase';
import usersJson from '@/data/users.json';
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
  User,
  PermMatrix,
  ChangeLogEntry,
} from '@/lib/types';

export const STORAGE_KEY = 'lom-prototype-v3';
const V2_KEY = 'lom-prototype-v2';

let idCounter = 0;
/** Small monotonic id generator (prototype-only; no crypto needed). */
export function nextId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
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
  /** Merged offers (imported base + diffs + prototype-created). Not persisted. */
  offers: OfferRecord[];
  /** v3 A7: per-offer edits to imported offers (keyed by _uid). Persisted. */
  offerDiffs: Record<string, Partial<OfferRecord>>;
  /** v3 A7: offers created in the prototype. Persisted. */
  createdOffers: OfferRecord[];
  /** Imported offers removed in the prototype (rare; drafts only). Persisted. */
  deletedUids: string[];
  /** True once the imported base has loaded. Not persisted. */
  baseLoaded: boolean;
  /** Notes from the v2 -> v3 migration (e.g. re-assigned Offer IDs). */
  migrationLog: string[];
  auditLog: AuditEntry[];
  role: Role;
  savedViews: SavedView[];
  feedLog: FeedLogEntry[];
  groupedChildren: Record<string, ChildPromotion[]>;
  feedState: Record<string, { loadedAt?: string }>;
  databricksTableNames: { attributes: string | null; metrics: string | null };
  /** C6: editable per-field business definition + status. */
  fieldDefinitions: Record<string, { businessDefinition?: string; status?: 'Draft' | 'Confirmed' }>;
  // --- Part 2: users & roles ---
  users: User[];
  currentUserId: string;
  permissions: PermMatrix;
  userRoleLog: ChangeLogEntry[];

  // --- actions ---
  setRole: (role: Role) => void;
  /** Part 2: switch the active session user (no password — prototype only). */
  signInAs: (userId: string) => void;
  addUser: (u: { name: string; email: string; role: Role }) => string;
  updateUser: (id: string, patch: { name?: string; email?: string }) => void;
  setUserRole: (id: string, role: Role) => { ok: boolean; message?: string };
  setUserActive: (id: string, active: boolean) => { ok: boolean; message?: string };
  setPermission: (role: Role, cap: string, value: boolean) => { ok: boolean; message?: string };
  resetPermissions: () => void;
  /** Internal: append a user/permission change-log entry. */
  _logUserChange: (type: 'user' | 'permission', what: string, oldValue?: string, newValue?: string) => void;
  resetDemoData: () => void;
  /** Load the imported base (once) and merge it with the stored diffs. */
  loadBase: () => Promise<void>;
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
  offerDiffs: Record<string, Partial<OfferRecord>>;
  createdOffers: OfferRecord[];
  deletedUids: string[];
  baseLoaded: boolean;
  migrationLog: string[];
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
  users: User[];
  currentUserId: string;
  permissions: PermMatrix;
  userRoleLog: ChangeLogEntry[];
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

const DEFAULT_USER_ID = 'u-editor-1'; // Sample Editor 1 — matches the prior default role

function seedUsers(): User[] {
  return JSON.parse(JSON.stringify(usersJson)) as User[];
}

/** Display name of the acting user, for audit + change-log entries. */
function currentUserName(s: { users: User[]; currentUserId: string }): string {
  const u = s.users.find((x) => x.id === s.currentUserId);
  return u ? `${u.name} (${u.role})` : 'Unknown';
}

/** Is `id` the only active Admin left? (guards against locking everyone out) */
function isLastActiveAdmin(users: User[], id: string): boolean {
  const activeAdmins = users.filter((u) => u.active && u.role === 'Admin');
  return activeAdmins.length === 1 && activeAdmins[0].id === id;
}

type OfferSlices = Pick<AppData, 'createdOffers' | 'offerDiffs' | 'deletedUids'>;

/** Merge the imported base with the stored diffs and the prototype-created offers. */
export function mergeOffers(s: OfferSlices): OfferRecord[] {
  const deleted = new Set(s.deletedUids);
  const merged: OfferRecord[] = [...s.createdOffers];
  for (const b of getBase()) {
    const uid = b._uid as string;
    if (deleted.has(uid)) continue;
    const d = s.offerDiffs[uid];
    merged.push(d ? { ...b, ...d } : b); // unchanged offers keep their identity (memo)
  }
  return merged;
}

const isBlank = (v: unknown) => v === undefined || v === null || v === '';
const sameValue = (a: unknown, b: unknown) => a === b || (isBlank(a) && isBlank(b));

/** v3 A7: true when an imported offer was edited in the prototype. */
export function isChangedSinceImport(uid: string | undefined, diffs: Record<string, Partial<OfferRecord>>): boolean {
  if (!uid) return false;
  const d = diffs[uid];
  return !!d && Object.keys(d).some((k) => k !== '_updatedAt');
}

/**
 * v3 A6: imported offers do not create approval tasks. An offer is in the
 * Approvals queue only when it was created in the prototype, or its status was
 * changed in the prototype.
 */
export function submittedInPrototype(o: OfferRecord, diffs: Record<string, Partial<OfferRecord>>): boolean {
  if (!isBaseUid(o._uid)) return true;
  const d = diffs[o._uid as string];
  return !!d && 'buildStatus' in d;
}

function initialState(): AppData {
  const slices: OfferSlices = { createdOffers: [], offerDiffs: {}, deletedUids: [] };
  const offers = mergeOffers(slices);
  const users = seedUsers();
  const currentUserId = DEFAULT_USER_ID;
  const role = users.find((u) => u.id === currentUserId)?.role ?? 'Offer Team Editor';
  return {
    offers,
    ...slices,
    baseLoaded: getBase().length > 0,
    migrationLog: [],
    auditLog: [],
    role,
    savedViews: [],
    feedLog: [],
    groupedChildren: seedGroupedChildren(offers),
    feedState: {},
    databricksTableNames: {
      attributes: databricksTablesJson.attributes.tableName,
      metrics: databricksTablesJson.metrics.tableName,
    },
    fieldDefinitions: {},
    users,
    currentUserId,
    permissions: buildDefaultMatrix(),
    userRoleLog: [],
    ...seedEditableReference(),
  };
}

/**
 * v3 A7 migration from v2: keep offers created in the prototype, the audit log
 * and saved views (plus users, permissions and reference edits); drop the v2
 * seed copies of offers that now come from the import. Offer ID collisions with
 * the import are fixed when the base loads (see loadBase).
 */
function migrateV2ToV3(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return; // already on v3
    const raw = localStorage.getItem(V2_KEY);
    if (!raw) return;
    const v2 = JSON.parse(raw)?.state ?? {};
    const { offers: v2offers, ...rest } = v2 as { offers?: OfferRecord[] } & Record<string, unknown>;
    const createdOffers = (Array.isArray(v2offers) ? v2offers : []).filter(
      (o) => !String(o._uid ?? '').startsWith('seed-'),
    );
    const auditLog = (Array.isArray(rest.auditLog) ? (rest.auditLog as AuditEntry[]) : []).filter(
      (a) => a.action !== 'imported',
    );
    const state = {
      ...rest,
      createdOffers,
      offerDiffs: {},
      deletedUids: [],
      auditLog,
      groupedChildren: {},
      feedState: {},
      migrationLog: [`Migrated from v2: kept ${createdOffers.length} prototype-created offer(s).`],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 3 }));
  } catch {
    /* ignore — fall back to fresh seed */
  }
}
migrateV2ToV3();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      // --- Part 2: users & roles ---------------------------------------------
      setRole: (role) => {
        // Back-compat: switch to the first active user holding this role.
        const s = get();
        const u = s.users.find((x) => x.active && x.role === role) ?? s.users.find((x) => x.role === role);
        if (u) set({ currentUserId: u.id, role });
        else set({ role });
      },

      signInAs: (userId) => {
        const u = get().users.find((x) => x.id === userId);
        if (!u) return;
        set({ currentUserId: userId, role: u.role });
      },

      addUser: ({ name, email, role }) => {
        const id = nextId('user');
        const u: User = {
          id, name, email, role, active: true,
          createdAt: new Date().toISOString(),
          lastChangedBy: currentUserName(get()),
        };
        set((s) => ({ users: [...s.users, u] }));
        get()._logUserChange('user', `Added user ${name} (${role})`, undefined, 'created');
        return id;
      },

      updateUser: (id, patch) => {
        const who = currentUserName(get());
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch, lastChangedBy: who } : u)),
        }));
        get()._logUserChange('user', `Edited user ${patch.name ?? id}`, undefined, JSON.stringify(patch));
      },

      setUserRole: (id, role) => {
        const s = get();
        const u = s.users.find((x) => x.id === id);
        if (!u) return { ok: false, message: 'User not found.' };
        if (u.role === 'Admin' && role !== 'Admin' && isLastActiveAdmin(s.users, id)) {
          return { ok: false, message: 'This is the last active Admin. Make another user an Admin first.' };
        }
        const oldRole = u.role;
        set((st) => ({
          users: st.users.map((x) => (x.id === id ? { ...x, role, lastChangedBy: currentUserName(st) } : x)),
          // keep the active session role in sync if we re-roled ourselves
          role: st.currentUserId === id ? role : st.role,
        }));
        get()._logUserChange('user', `Changed role of ${u.name}`, oldRole, role);
        return { ok: true };
      },

      setUserActive: (id, active) => {
        const s = get();
        const u = s.users.find((x) => x.id === id);
        if (!u) return { ok: false, message: 'User not found.' };
        if (!active && id === s.currentUserId) {
          return { ok: false, message: 'You cannot deactivate yourself.' };
        }
        if (!active && u.role === 'Admin' && isLastActiveAdmin(s.users, id)) {
          return { ok: false, message: 'This is the last active Admin and cannot be deactivated.' };
        }
        set((st) => ({
          users: st.users.map((x) => (x.id === id ? { ...x, active, lastChangedBy: currentUserName(st) } : x)),
        }));
        get()._logUserChange('user', `${active ? 'Reactivated' : 'Deactivated'} ${u.name}`, u.active ? 'Active' : 'Inactive', active ? 'Active' : 'Inactive');
        return { ok: true };
      },

      setPermission: (role, cap, value) => {
        const meta = capabilityMeta(cap);
        if (meta?.locked) return { ok: false, message: 'This rule is fixed and cannot be changed.' };
        if (role === 'Admin') return { ok: false, message: 'Admin always has every permission.' };
        const old = !!get().permissions[role]?.[cap];
        set((s) => ({
          permissions: { ...s.permissions, [role]: { ...s.permissions[role], [cap]: value } },
        }));
        get()._logUserChange('permission', `${meta?.label ?? cap} — ${role}`, old ? 'On' : 'Off', value ? 'On' : 'Off');
        return { ok: true };
      },

      resetPermissions: () => {
        set({ permissions: buildDefaultMatrix() });
        get()._logUserChange('permission', 'Reset all permissions to defaults', undefined, undefined);
      },

      _logUserChange: (type: 'user' | 'permission', what: string, oldValue?: string, newValue?: string) =>
        set((s) => ({
          userRoleLog: [
            { id: nextId('chg'), timestamp: new Date().toISOString(), changedBy: currentUserName(s), type, what, oldValue, newValue },
            ...s.userRoleLog,
          ],
        })),

      resetDemoData: () => {
        // Rebuild every seeded slice, keeping the current user. Clears all diffs and
        // prototype-created offers and returns to the imported seed (A7).
        set((state) => {
          const fresh = initialState();
          return {
            ...fresh,
            groupedChildren: seedGroupedChildren(getBase()),
            currentUserId: state.currentUserId,
            role: state.role,
          };
        });
      },

      loadBase: async () => {
        await loadBaseData();
        const s = get();
        // Offer ID collisions between kept prototype offers and the import (A7).
        const ids = importedOfferIds();
        const log: string[] = [];
        let next = computeNextOfferId([...getBase(), ...s.createdOffers]);
        const createdOffers = s.createdOffers.map((o) => {
          if (typeof o.offerId === 'number' && ids.has(o.offerId)) {
            log.push(`Offer "${String(o.offerName ?? '')}" had Offer ID ${o.offerId}, which an imported offer uses. New Offer ID: ${next}.`);
            return { ...o, offerId: next++ };
          }
          return o;
        });
        // Child promotions: keep entries whose offer exists, seed the documented samples.
        const uids = new Set([...createdOffers, ...getBase()].map((o) => o._uid));
        const kept = Object.fromEntries(Object.entries(s.groupedChildren).filter(([uid]) => uids.has(uid)));
        const groupedChildren = { ...seedGroupedChildren(getBase()), ...kept };
        set({
          createdOffers,
          groupedChildren,
          migrationLog: [...s.migrationLog, ...log],
          baseLoaded: true,
          offers: mergeOffers({ ...s, createdOffers }),
        });
      },

      addAudit: (entry) =>
        set((s) => ({
          auditLog: [
            {
              id: nextId('audit'),
              timestamp: entry.timestamp ?? new Date().toISOString(),
              ...entry,
              // Stamp the acting user (name + role) regardless of what the caller passed.
              user: currentUserName(s),
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
        set((s) => {
          const createdOffers = [offer, ...s.createdOffers];
          return { createdOffers, offers: mergeOffers({ ...s, createdOffers }) };
        });
        get().addAudit({ offerId: '', offerUid: uid, user: get().role, action: 'created', comment: 'New draft created' });
        return uid;
      },

      updateOffer: (uid, patch) =>
        set((s) => {
          const now = new Date().toISOString();
          const b = baseOffer(uid);
          if (b) {
            // Imported offer: store only the fields that differ from the import (A7).
            const next: Partial<OfferRecord> = { ...(s.offerDiffs[uid] ?? {}) };
            delete next._updatedAt;
            for (const [k, v] of Object.entries(patch)) {
              if (k === '_updatedAt') continue;
              if (sameValue(b[k], v)) delete next[k];
              else next[k] = v;
            }
            const offerDiffs = { ...s.offerDiffs };
            if (Object.keys(next).length) offerDiffs[uid] = { ...next, _updatedAt: now };
            else delete offerDiffs[uid];
            return { offerDiffs, offers: mergeOffers({ ...s, offerDiffs }) };
          }
          const createdOffers = s.createdOffers.map((o) =>
            o._uid === uid ? { ...o, ...patch, _updatedAt: now } : o,
          );
          return { createdOffers, offers: mergeOffers({ ...s, createdOffers }) };
        }),

      deleteOffer: (uid) =>
        set((s) => {
          if (isBaseUid(uid)) {
            const deletedUids = [...s.deletedUids, uid];
            return { deletedUids, offers: mergeOffers({ ...s, deletedUids }) };
          }
          const createdOffers = s.createdOffers.filter((o) => o._uid !== uid);
          return { createdOffers, offers: mergeOffers({ ...s, createdOffers }) };
        }),

      copyOffer: (uid) => {
        const src = get().offers.find((o) => o._uid === uid);
        if (!src) return null;
        const newUid = nextId('offer');
        const copy: OfferRecord = { ...src };
        copy._uid = newUid;
        copy._updatedAt = new Date().toISOString();
        delete copy._sampleReason;
        delete copy._demoSample;
        copy.offerId = ''; // blank per 11.2
        copy.offerName = `COPY OF ${src.offerName ?? ''}`.trim();
        copy.buildStatus = 'Draft';
        for (const id of CHECKLIST_FIELD_IDS) copy[id] = ''; // checklist reset
        for (const id of RESULT_FIELD_IDS) copy[id] = ''; // results cleared
        // forecast kept (not touched)
        set((s) => {
          const createdOffers = [copy, ...s.createdOffers];
          return { createdOffers, offers: mergeOffers({ ...s, createdOffers }) };
        });
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
      version: 3,
      // v3 A7: never persist the merged offers (2,425 imported records); only the
      // diffs, prototype-created offers, views and settings.
      partialize: (s) => {
        const { offers: _offers, baseLoaded: _loaded, ...rest } = s;
        void _offers;
        void _loaded;
        return rest;
      },
      // Older persisted state (before Part 2) lacks users/permissions/currentUserId.
      // The default shallow merge keeps those fresh slices; here we only reconcile
      // the active role with the current user so can() stays correct.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const u = state.users?.find((x) => x.id === state.currentUserId);
        if (u && u.role !== state.role) state.role = u.role;
        if (!u && state.users?.length) {
          const first = state.users.find((x) => x.active && x.role === state.role) ?? state.users[0];
          state.currentUserId = first.id;
          state.role = first.role;
        }
        if (!state.permissions) state.permissions = buildDefaultMatrix();
      },
    },
  ),
);

// Let can()/whoCan() read the live, editable matrix without a circular import.
registerMatrixAccessor(() => useAppStore.getState().permissions);
// v3 A6: unchanged imported offers are not validated at load (see feed.ts).
setFeedExemption((o) => isBaseUid(o._uid) && !isChangedSinceImport(o._uid, useAppStore.getState().offerDiffs));

// Storage is synchronous, so hydration is done here: rebuild the merged offers
// from the stored slices (the imported base joins in when loadBase resolves).
/**
 * v3 A5: make sure the statuses and category pairs found in the imported data
 * are in the (possibly older, persisted) reference lists. Additive only, so any
 * Admin edits are kept.
 */
function withImportedReference(s: AppState): Partial<AppState> {
  const status = [...(s.dropdowns.status ?? [])];
  for (const v of seedDropdowns.status ?? []) {
    if (status.includes(v)) continue;
    const at = (seedDropdowns.status ?? []).indexOf(v);
    const prev = (seedDropdowns.status ?? [])[at - 1];
    const i = prev ? status.indexOf(prev) : -1;
    status.splice(i >= 0 ? i + 1 : status.length, 0, v);
  }
  const lifecycle = [...s.lifecycle];
  for (const row of reference.lifecycle) {
    if (lifecycle.some((l) => l.status === row.status)) continue;
    const at = reference.lifecycle.indexOf(row);
    const prev = reference.lifecycle[at - 1]?.status;
    const i = lifecycle.findIndex((l) => l.status === prev);
    lifecycle.splice(i >= 0 ? i + 1 : lifecycle.length, 0, { ...row });
  }
  const pairs = [...s.categorySubCategory];
  for (const p of reference.categorySubCategory) {
    if (!pairs.some((x) => x.category === p.category && x.subCategory === p.subCategory)) pairs.push({ ...p });
  }
  return { dropdowns: { ...s.dropdowns, status }, lifecycle, categorySubCategory: pairs };
}

useAppStore.setState((s) => ({
  ...withImportedReference(s),
  createdOffers: s.createdOffers ?? [],
  offerDiffs: s.offerDiffs ?? {},
  deletedUids: s.deletedUids ?? [],
  migrationLog: s.migrationLog ?? [],
  offers: mergeOffers({
    createdOffers: s.createdOffers ?? [],
    offerDiffs: s.offerDiffs ?? {},
    deletedUids: s.deletedUids ?? [],
  }),
}));

/** Load the imported base once (app start, tests). */
export function ensureBaseLoaded(): Promise<void> {
  return useAppStore.getState().baseLoaded ? Promise.resolve() : useAppStore.getState().loadBase();
}
