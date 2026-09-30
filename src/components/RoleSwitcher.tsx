import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import type { Role } from '@/lib/types';

export const ROLES: Role[] = [
  'Offer Team Editor',
  'Loyalty & Pricing',
  'Approver (TBC)',
  'View-only',
  'Admin',
];

export function RoleSwitcher() {
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const push = useToasts((s) => s.push);

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="role" className="whitespace-nowrap text-muted">
        Viewing as:
      </label>
      <select
        id="role"
        className="rounded-md border border-border bg-white px-2 py-1 focus:border-primary focus:outline-none"
        value={role}
        onChange={(e) => {
          setRole(e.target.value as Role);
          push(`Now viewing as ${e.target.value}`, 'info');
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {role === 'Approver (TBC)' && (
        <Tooltip.Provider delayDuration={150}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button aria-label="About the Approver role" className="text-accent">
                <Info size={14} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={5}
                className="z-50 max-w-[280px] rounded-md border border-border bg-white px-3 py-2 text-xs text-ink shadow-md"
              >
                Who approves offers is not yet confirmed (steering committee?).
                <Tooltip.Arrow className="fill-white" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </div>
  );
}
