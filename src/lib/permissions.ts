// Role capabilities (Part 2). The matrix now lives in src/data/permissions.json
// and is editable + persisted in the store; code reads it through can().
import type { Role, PermMatrix, CapabilityMeta } from './types';
import permissionsJson from '@/data/permissions.json';

export const ROLES = permissionsJson.roles as Role[];
export const CAPABILITIES = permissionsJson.capabilities as CapabilityMeta[];
const DEFAULTS = permissionsJson.defaults as Record<string, Record<string, boolean>>;

/** Any capability id string (kept as a widened string so the matrix is data-driven). */
export type Capability = string;

const CAP_META: Record<string, CapabilityMeta> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
);

export function capabilityMeta(cap: Capability): CapabilityMeta | undefined {
  return CAP_META[cap];
}

/** Build the full default matrix (role -> cap -> boolean) from the JSON defaults. */
export function buildDefaultMatrix(): PermMatrix {
  const matrix = {} as PermMatrix;
  for (const role of ROLES) {
    const row: Record<string, boolean> = {};
    for (const cap of CAPABILITIES) {
      if (cap.locked) row[cap.id] = !!cap.lockedValue;
      else if (role === 'Admin') row[cap.id] = true;
      else row[cap.id] = !!DEFAULTS[role]?.[cap.id];
    }
    matrix[role] = row;
  }
  return matrix;
}

// The live, editable matrix is supplied by the store via this accessor, so this
// module never imports the store (avoids a circular import). Falls back to the
// defaults before the store registers (e.g. in isolated unit tests).
let matrixAccessor: (() => PermMatrix) | null = null;
export function registerMatrixAccessor(fn: () => PermMatrix): void {
  matrixAccessor = fn;
}
function liveMatrix(): PermMatrix {
  try {
    return matrixAccessor?.() ?? buildDefaultMatrix();
  } catch {
    return buildDefaultMatrix();
  }
}

/**
 * Can this role use this capability? Locked rows are fixed for every role
 * (including Admin). Admin is otherwise always allowed. `matrix` may be passed
 * to make a React component re-render when the matrix changes; otherwise the
 * live store matrix is read.
 */
export function can(role: Role, cap: Capability, matrix?: PermMatrix): boolean {
  const meta = CAP_META[cap];
  if (meta?.locked) return !!meta.lockedValue;
  if (role === 'Admin') return true;
  const m = matrix ?? liveMatrix();
  return !!m?.[role]?.[cap];
}

/** Names of the roles that currently hold a capability (for disabled tooltips). */
export function whoCan(cap: Capability, matrix?: PermMatrix): string {
  const m = matrix ?? liveMatrix();
  const holders = ROLES.filter((r) => can(r, cap, m));
  return holders.join(', ');
}

/** Proposed-rule capabilities (show a proposed-rule icon near the control). */
export const PROPOSED_CAPS: Partial<Record<string, Role>> = {
  editOffer: 'Loyalty & Pricing',
  createOffer: 'Loyalty & Pricing',
};
