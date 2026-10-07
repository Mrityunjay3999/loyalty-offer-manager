// Role capabilities, spec section 5. Loyalty & Pricing create/edit is a proposed rule.
import type { Role } from './types';

export type Capability =
  | 'createEditCopy'
  | 'deleteDraft'
  | 'cancel'
  | 'changeStatus'
  | 'approve'
  | 'editChecklist'
  | 'enterResults'
  | 'editReference'
  | 'runSimulations'
  | 'openEditArea';

const MATRIX: Record<Capability, Role[]> = {
  // A5: the Offers (Edit) area is only for Editor and Admin.
  openEditArea: ['Offer Team Editor', 'Admin'],
  createEditCopy: ['Offer Team Editor', 'Loyalty & Pricing', 'Admin'],
  deleteDraft: ['Offer Team Editor', 'Admin'],
  cancel: ['Offer Team Editor', 'Admin'],
  changeStatus: ['Offer Team Editor', 'Admin'],
  approve: ['Approver (TBC)', 'Admin'],
  editChecklist: ['Offer Team Editor', 'Admin'],
  enterResults: ['Offer Team Editor', 'Admin'],
  editReference: ['Admin'],
  runSimulations: ['Admin'],
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[cap].includes(role);
}

/** Proposed-rule capabilities (show a proposed-rule icon near the control). */
export const PROPOSED_CAPS: Partial<Record<Capability, Role>> = {
  createEditCopy: 'Loyalty & Pricing',
};

/** Human hint about who can do something (for disabled-control tooltips). */
export function whoCan(cap: Capability): string {
  return MATRIX[cap].join(', ');
}
