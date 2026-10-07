// Lifecycle statuses (spec 7.2) and the main-path / side-state structure (7.3).
// Transition rules and guards are added in Milestone 7 (lifecycle bar).
import { dropdowns, reference } from './dataLoaders';
import { isNoValue, parseISO } from './format';
import { forecastNeeded } from './calculations';
import { can, type Capability } from './permissions';
import type { LifecycleStatus, OfferRecord, Role } from './types';

export const DRAFT = 'Draft';

/** The 12 dropdown statuses, plus the prototype-only Draft at the front. */
export const STATUS_ORDER: string[] = [DRAFT, ...dropdowns.status];

/** Main linear path shown in the lifecycle bar. */
export const MAIN_PATH: string[] = [
  'Draft',
  'Proposed',
  'Planning Phase',
  'Approved / Build Phase',
  'Pending MD',
  'Audited / Ready to go',
  'Live',
  'Completed',
  'Completed - Data Final',
];

/** Side states rendered as badges when active. */
export const SIDE_STATES: string[] = [
  'Forecast Only',
  'Pending SteerCo Approval',
  'Pending Points Upload',
  'Cancelled',
];

/** Pill colour classes per status (spec 7.2). Literal strings so Tailwind keeps them. */
const PILL: Record<string, string> = {
  Draft: 'border border-border bg-white text-muted',
  'Forecast Only': 'bg-gray-100 text-gray-700',
  'Pending SteerCo Approval': 'border border-warning bg-white text-warning',
  Proposed: 'bg-warning/15 text-warning',
  'Planning Phase': 'bg-blue-100 text-blue-700',
  'Approved / Build Phase': 'bg-indigo-100 text-indigo-700',
  'Pending MD': 'bg-warning/15 text-warning',
  'Audited / Ready to go': 'bg-primary/15 text-primary',
  Live: 'bg-success/15 text-success',
  Completed: 'bg-slate-100 text-slate-700',
  'Completed - Data Final': 'bg-success text-white',
  'Pending Points Upload': 'bg-warning/15 text-warning',
  Cancelled: 'bg-danger/15 text-danger',
};

export function statusPillClass(status: string): string {
  return PILL[status] ?? 'border border-border bg-white text-muted';
}

/** Statuses considered "earlier than Audited / Ready to go" (soft-lock red text). */
const PRE_AUDIT = new Set([
  'Draft',
  'Forecast Only',
  'Pending SteerCo Approval',
  'Proposed',
  'Planning Phase',
  'Approved / Build Phase',
  'Pending MD',
]);

export function isEarlierThanAudited(status: string): boolean {
  return PRE_AUDIT.has(status);
}

/** A4: a fully read-only offer (Completed - Data Final or Cancelled). */
export function isLocked(status: string): boolean {
  return status === 'Completed - Data Final' || status === 'Cancelled';
}

export function statusOf(o: OfferRecord): string {
  return String(o.buildStatus ?? DRAFT);
}

/** Definition + documented flag from the (editable) lifecycle reference. */
export function statusDefinition(
  status: string,
  lifecycle: LifecycleStatus[] = reference.lifecycle,
): { definition: string; documented: boolean } {
  if (status === DRAFT) {
    return { definition: 'Saved in the application but not yet submitted.', documented: true };
  }
  const row = lifecycle.find((l) => l.status === status);
  if (!row) return { definition: 'Definition not documented yet (confirm with business)', documented: false };
  return {
    definition: row.documented
      ? row.definition
      : 'Definition not documented yet (confirm with business)',
    documented: row.documented,
  };
}

// ---------------------------------------------------------------------------
// Transitions and guards (spec 7.3). Proposed rules derived from status
// definitions; surfaced with a ProposedRuleIcon in the UI.
// ---------------------------------------------------------------------------

export interface GuardMissing {
  message: string;
  fieldId?: string;
}
export interface GuardResult {
  ok: boolean;
  missing: GuardMissing[];
}

export interface Transition {
  from: string[];
  to: string;
  label: string;
  cap: Capability; // capability required
  commentRequired?: boolean;
  /** Hard guard: blocks with the listed missing items. */
  guard?: (o: OfferRecord) => GuardResult;
  /** Soft guard: returns a warning message; allowed if the user adds a comment. */
  softGuard?: (o: OfferRecord) => string | null;
  /** Extra fields to set alongside the status change. */
  extra?: (o: OfferRecord) => Partial<OfferRecord>;
  /** Marks the approval action (records approver name + timestamp in audit). */
  isApproval?: boolean;
}

const ok: GuardResult = { ok: true, missing: [] };

function has(o: OfferRecord, id: string): boolean {
  return !isNoValue(o[id]);
}
function isTargeted(o: OfferRecord): boolean {
  return o.broadVsTargeted === 'Targeted';
}
function memberDescriptorPresent(o: OfferRecord): boolean {
  return !isNoValue(o.memberDescriptor) && o.memberDescriptor !== 'N/A';
}
function forecastEntered(o: OfferRecord): boolean {
  return (
    has(o, 'activationByDayLow') &&
    has(o, 'activationByDayHigh') &&
    has(o, 'bonusRateLow') &&
    has(o, 'bonusRateHigh')
  );
}
function daysAfterEnd(o: OfferRecord): number | null {
  const e = parseISO(o.endDate);
  if (!e) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - e.getTime()) / 86_400_000);
}

export const TRANSITIONS: Transition[] = [
  {
    from: ['Draft'],
    to: 'Proposed',
    label: 'Submit offer',
    cap: 'changeStatus',
    // Full required-field validation is enforced by the workspace Submit button.
    guard: () => ok,
  },
  {
    from: ['Draft', 'Proposed'],
    to: 'Forecast Only',
    label: 'Mark as forecast only',
    cap: 'changeStatus',
  },
  {
    from: ['Proposed'],
    to: 'Pending SteerCo Approval',
    label: 'Send to SteerCo',
    cap: 'changeStatus',
  },
  {
    from: ['Proposed', 'Pending SteerCo Approval'],
    to: 'Planning Phase',
    label: 'Approve offer and forecast',
    cap: 'approve',
    isApproval: true,
    guard: (o) =>
      forecastEntered(o) || forecastNeeded(o) === 'No'
        ? ok
        : {
            ok: false,
            missing: [
              { message: 'Enter Activation by day (Low & High) and Bonus rate (Low & High)', fieldId: 'activationByDayLow' },
              { message: 'or set the offer so a forecast is not needed' },
            ],
          },
  },
  {
    from: ['Proposed', 'Pending SteerCo Approval'],
    to: 'Proposed',
    label: 'Return for changes',
    cap: 'approve',
    commentRequired: true,
  },
  {
    from: ['Planning Phase'],
    to: 'Approved / Build Phase',
    label: 'Mark submitted to loyalty platform',
    cap: 'changeStatus',
    guard: (o) => {
      const missing: GuardMissing[] = [];
      if (o.submissionFormMade !== 'Yes')
        missing.push({ message: 'Submission Form Made must be Yes', fieldId: 'submissionFormMade' });
      if (o.submittedToKognitiv !== 'Yes')
        missing.push({ message: 'Offer Submitted to Kognitiv must be Yes', fieldId: 'submittedToKognitiv' });
      return { ok: missing.length === 0, missing };
    },
  },
  {
    from: ['Approved / Build Phase'],
    to: 'Pending MD',
    label: 'Mark pending member descriptor',
    cap: 'changeStatus',
    guard: (o) =>
      isTargeted(o) && !memberDescriptorPresent(o)
        ? ok
        : {
            ok: false,
            missing: [
              { message: 'Only for Targeted offers whose Member Descriptor is empty or N/A', fieldId: 'memberDescriptor' },
            ],
          },
  },
  {
    from: ['Approved / Build Phase', 'Pending MD'],
    to: 'Audited / Ready to go',
    label: 'Mark audited and ready',
    cap: 'changeStatus',
    guard: (o) => {
      const missing: GuardMissing[] = [];
      if (o.offerCardBuilt !== 'Yes')
        missing.push({ message: 'Offer Card Built must be Yes', fieldId: 'offerCardBuilt' });
      if (!(o.offerAudited === 'Yes' || o.offerAudited === 'Partially'))
        missing.push({ message: 'Offer Audited must be Yes or Partially', fieldId: 'offerAudited' });
      if (isTargeted(o) && !memberDescriptorPresent(o))
        missing.push({ message: 'Targeted offers need a Member Descriptor', fieldId: 'memberDescriptor' });
      if (!(o.skuList === 'Yes' || o.skuList === 'N/A'))
        missing.push({ message: 'SKU List must be Yes or N/A', fieldId: 'skuList' });
      return { ok: missing.length === 0, missing };
    },
  },
  {
    from: ['Audited / Ready to go'],
    to: 'Live',
    label: 'Mark live',
    cap: 'changeStatus',
  },
  {
    from: ['Live'],
    to: 'Completed',
    label: 'Mark completed',
    cap: 'changeStatus',
    softGuard: (o) => {
      const d = daysAfterEnd(o);
      return d !== null && d < 0 ? 'Today is before the End Date. Add a comment to override.' : null;
    },
  },
  {
    from: ['Live', 'Completed'],
    to: 'Pending Points Upload',
    label: 'Mark pending points upload',
    cap: 'changeStatus',
  },
  {
    from: ['Completed', 'Pending Points Upload'],
    to: 'Completed - Data Final',
    label: 'Mark data final',
    cap: 'changeStatus',
    guard: (o) => {
      const missing: GuardMissing[] = [];
      if (!has(o, 'activations')) missing.push({ message: 'Activations required', fieldId: 'activations' });
      if (!has(o, 'bonusedMembers')) missing.push({ message: 'Bonused members required', fieldId: 'bonusedMembers' });
      if (!has(o, 'bonusPtsIssued')) missing.push({ message: 'Bonus Pts Issued required', fieldId: 'bonusPtsIssued' });
      return { ok: missing.length === 0, missing };
    },
    softGuard: (o) => {
      const d = daysAfterEnd(o);
      return d !== null && d < 5 ? 'Data is usually final at least 5 days after the End Date. Add a comment to override.' : null;
    },
  },
  {
    from: ['Cancelled'],
    to: 'Proposed', // reinstated to a prior working status (simplified)
    label: 'Reinstate',
    cap: 'editReference', // Admin-only capability stands in for reinstate
    commentRequired: true,
  },
];

/** Transitions allowed from the current status for this role. Cancel handled separately. */
export function allowedTransitions(status: string, role: Role): Transition[] {
  return TRANSITIONS.filter((t) => t.from.includes(status) && can(role, t.cap));
}

/** Can this role cancel the offer (any status except Cancelled)? */
export function canCancelFrom(status: string, role: Role): boolean {
  return status !== 'Cancelled' && can(role, 'cancel');
}
