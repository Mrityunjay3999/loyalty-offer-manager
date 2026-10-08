// One-time migration (Part 2): personal grid layouts used to be keyed by role
// (lom-offerview-<role>), now they are keyed by user id so each user keeps their
// own view. Copy each old per-role layout to the first sample user of that role.
const ROLE_TO_FIRST_USER: Record<string, string> = {
  'Offer Team Editor': 'u-editor-1',
  'Loyalty & Pricing': 'u-analyst',
  'Approver (TBC)': 'u-approver',
  'View-only': 'u-viewer',
  Admin: 'u-admin',
};
const PREFIXES = ['lom-offerview-', 'lom-rf-', 'lom-colpick-'];
const FLAG = 'lom-layout-migrated-v3';

export function migrateLayoutsToUsers(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(FLAG)) return;
    for (const prefix of PREFIXES) {
      for (const [role, userId] of Object.entries(ROLE_TO_FIRST_USER)) {
        const oldKey = `${prefix}${role}`;
        const newKey = `${prefix}${userId}`;
        const val = localStorage.getItem(oldKey);
        if (val != null && localStorage.getItem(newKey) == null) {
          localStorage.setItem(newKey, val);
        }
      }
    }
    localStorage.setItem(FLAG, '1');
  } catch {
    /* ignore — layouts are a convenience, not critical state */
  }
}
