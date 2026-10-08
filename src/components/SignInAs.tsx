import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info, UserCircle2, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { ROLES } from '@/lib/permissions';

/**
 * Prototype sign-in control (replaces the old role switcher). Lists active users
 * grouped by role; picking one switches the session with no password. Personal
 * layouts are keyed by user id, so each user keeps their own filters/columns.
 */
export function SignInAs() {
  const users = useAppStore((s) => s.users);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const signInAs = useAppStore((s) => s.signInAs);
  const push = useToasts((s) => s.push);

  const me = users.find((u) => u.id === currentUserId);
  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-ink hover:bg-surface">
            <UserCircle2 size={16} className="text-primary" />
            <span className="text-sm">
              Signed in as <span className="font-medium">{me?.name ?? 'Unknown'}</span>
              <span className="text-muted"> ({me?.role})</span>
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 max-h-[70vh] min-w-[260px] overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg"
          >
            <div className="px-3 py-1 text-[11px] text-muted">Prototype only. No real sign-in.</div>
            {ROLES.map((role) => {
              const inRole = activeUsers.filter((u) => u.role === role);
              if (inRole.length === 0) return null;
              return (
                <div key={role}>
                  <div className="px-3 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{role}</div>
                  {inRole.map((u) => (
                    <DropdownMenu.Item
                      key={u.id}
                      onSelect={() => {
                        signInAs(u.id);
                        push(`Signed in as ${u.name} (${u.role})`, 'info');
                      }}
                      className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm outline-none hover:bg-surface data-[highlighted]:bg-surface"
                    >
                      <span>{u.name}</span>
                      {u.id === currentUserId && <Check size={14} className="text-primary" />}
                    </DropdownMenu.Item>
                  ))}
                </div>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {me?.role === 'Approver (TBC)' && (
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
