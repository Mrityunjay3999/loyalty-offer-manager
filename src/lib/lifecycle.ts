// Lifecycle statuses (spec 7.2) and the main-path / side-state structure (7.3).
// Transition rules and guards are added in Milestone 7 (lifecycle bar).
import { dropdowns, reference } from './dataLoaders';
import type { LifecycleStatus, OfferRecord } from './types';

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
