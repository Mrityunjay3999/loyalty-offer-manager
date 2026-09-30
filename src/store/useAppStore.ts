import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  freshSampleOffers,
  dropdowns as seedDropdowns,
  reference,
} from '@/lib/dataLoaders';
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
} from '@/lib/types';

export const STORAGE_KEY = 'lom-prototype-v1';

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

  // --- actions ---
  setRole: (role: Role) => void;
  resetDemoData: () => void;
}

function initialState(): Omit<AppState, 'setRole' | 'resetDemoData'> {
  const offers = freshSampleOffers();
  return {
    offers,
    auditLog: seedAuditLog(offers),
    role: 'Offer Team Editor',
    savedViews: [],
    feedLog: [],
    ...seedEditableReference(),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState(),
      setRole: (role) => set({ role }),
      resetDemoData: () => {
        // Rebuild every seeded slice from the source JSON, keeping the chosen role.
        set((state) => ({ ...initialState(), role: state.role }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
    },
  ),
);
