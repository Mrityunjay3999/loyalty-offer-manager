import { Fragment, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Lock, Info, Plus, Pencil, X, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { TagPill } from '@/components/TagPill';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ROLES, CAPABILITIES, can } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import type { Role, User } from '@/lib/types';

const ROLE_PILL: Record<Role, string> = {
  'Offer Team Editor': 'bg-primary/10 text-primary',
  'Loyalty & Pricing': 'bg-accent/10 text-accent',
  'Approver (TBC)': 'bg-warning/10 text-warning',
  'View-only': 'bg-slate-100 text-slate-600',
  Admin: 'bg-emerald-100 text-emerald-700',
};
function RolePill({ role }: { role: Role }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_PILL[role]}`}>{role}</span>;
}

export function UsersAndRoles() {
  return (
    <div>
      <PageHeader title="Users & roles" />
      <p className="-mt-1 mb-3 text-sm text-muted">
        Manage who can use each area of the tool. Sign-in here is a prototype only — no passwords.
      </p>
      <Tabs.Root defaultValue="users">
        <Tabs.List className="mb-4 flex gap-1 border-b border-border">
          {[['users', 'Users'], ['matrix', 'Roles & permissions'], ['log', 'Change log']].map(([v, label]) => (
            <Tabs.Trigger key={v} value={v}
              className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted data-[state=active]:border-primary data-[state=active]:text-primary">
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="users"><UsersTab /></Tabs.Content>
        <Tabs.Content value="matrix"><MatrixTab /></Tabs.Content>
        <Tabs.Content value="log"><ChangeLogTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

/* --------------------------------- Tab A ---------------------------------- */
function UsersTab() {
  const users = useAppStore((s) => s.users);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const addUser = useAppStore((s) => s.addUser);
  const updateUser = useAppStore((s) => s.updateUser);
  const setUserRole = useAppStore((s) => s.setUserRole);
  const setUserActive = useAppStore((s) => s.setUserActive);
  const push = useToasts((s) => s.push);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)) && (!roleFilter || u.role === roleFilter),
    );
  }, [users, search, roleFilter]);

  function tryRole(u: User, role: Role) {
    const r = setUserRole(u.id, role);
    push(r.ok ? `${u.name} is now ${role}.` : r.message ?? 'Could not change role.', r.ok ? 'success' : 'error');
  }
  function tryActive(u: User) {
    const r = setUserActive(u.id, !u.active);
    if (!r.ok) push(r.message ?? 'Could not change.', 'error');
    else push(`${u.name} ${u.active ? 'deactivated' : 'reactivated'}.`, 'success');
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="min-w-[200px] flex-1 rounded border border-border px-2 py-1 text-sm" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded border border-border px-2 py-1 text-xs" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Role: All</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
          <Plus size={15} /> Add user
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Last changed by</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={`border-b border-border/50 ${u.active ? '' : 'opacity-60'}`}>
                <td className="px-3 py-2 font-medium text-ink">
                  {u.name}{u.id === currentUserId && <span className="ml-1.5 rounded bg-primary/10 px-1 text-[10px] text-primary">you</span>}
                </td>
                <td className="px-3 py-2 text-muted">{u.email}</td>
                <td className="px-3 py-2"><RolePill role={u.role} /></td>
                <td className="px-3 py-2">
                  <button onClick={() => tryActive(u)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted">{formatDate(u.createdAt.slice(0, 10))}</td>
                <td className="px-3 py-2 text-muted">{u.lastChangedBy ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEditing(u)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"><Pencil size={12} /> Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">No delete — users are deactivated, keeping the change history intact. The last active Admin cannot be deactivated or re-roled, and you cannot deactivate yourself.</p>

      {adding && <UserDialog title="Add user" onClose={() => setAdding(false)} onSave={(v) => { addUser(v as { name: string; email: string; role: Role }); push(`Added ${v.name}.`, 'success'); setAdding(false); }} />}
      {editing && <UserDialog title="Edit user" user={editing} onClose={() => setEditing(null)} onSave={(v) => { updateUser(editing.id, { name: v.name, email: v.email }); if (v.role !== editing.role) tryRole(editing, v.role as Role); push('User updated.', 'success'); setEditing(null); }} />}
    </div>
  );
}

function UserDialog({ title, user, onClose, onSave }: { title: string; user?: User; onClose: () => void; onSave: (v: { name: string; email: string; role: Role }) => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'View-only');
  const valid = name.trim() && /.+@.+\..+/.test(email);
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild><button aria-label="Close" className="text-muted hover:text-ink"><X size={18} /></button></Dialog.Close>
          </div>
          <label className="mb-2 block text-sm">Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 w-full rounded border border-border px-2 py-1.5" />
          </label>
          <label className="mb-2 block text-sm">Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-0.5 w-full rounded border border-border px-2 py-1.5" />
          </label>
          <label className="mb-3 block text-sm">Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-0.5 w-full rounded border border-border px-2 py-1.5">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface">Cancel</button>
            <button disabled={!valid} onClick={() => onSave({ name: name.trim(), email: email.trim(), role })} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Save</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* --------------------------------- Tab B ---------------------------------- */
function MatrixTab() {
  const permissions = useAppStore((s) => s.permissions);
  const setPermission = useAppStore((s) => s.setPermission);
  const resetPermissions = useAppStore((s) => s.resetPermissions);
  const push = useToasts((s) => s.push);
  const [confirmReset, setConfirmReset] = useState(false);

  // Group capabilities by area, preserving first-appearance order.
  const groups: Array<{ area: string; caps: typeof CAPABILITIES }> = [];
  for (const cap of CAPABILITIES) {
    let g = groups.find((x) => x.area === cap.area);
    if (!g) { g = { area: cap.area, caps: [] }; groups.push(g); }
    g.caps.push(cap);
  }

  function toggle(role: Role, capId: string, value: boolean) {
    const r = setPermission(role, capId, value);
    if (!r.ok) push(r.message ?? 'Could not change.', 'error');
    else push('Permission updated.', 'success');
  }

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
        <TagPill kind="Confirm with business" />
        <p className="text-ink">
          These defaults are a starting point. The business confirmed 3 rules only: the edit area is for the
          operations team, the view area is for everyone, and only certain people can change list values.
          All other permissions are to be confirmed.
        </p>
      </div>

      <div className="mb-2 flex justify-end">
        <button onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface">
          <RotateCcw size={13} /> Reset to defaults
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-[11px] uppercase tracking-wide text-muted">Capability</th>
              {ROLES.map((r) => (
                <th key={r} className="px-2 py-2 text-center text-[11px] font-medium text-muted">
                  <span className="inline-flex items-center gap-1">
                    {r}
                    {r === 'Approver (TBC)' && (
                      <Tooltip.Provider delayDuration={150}><Tooltip.Root>
                        <Tooltip.Trigger asChild><button className="text-accent"><Info size={12} /></button></Tooltip.Trigger>
                        <Tooltip.Portal><Tooltip.Content side="bottom" className="z-50 max-w-[240px] rounded border border-border bg-white p-2 text-[11px] shadow-md">Who approves offers is not yet confirmed.</Tooltip.Content></Tooltip.Portal>
                      </Tooltip.Root></Tooltip.Provider>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.area}>
                <tr><td colSpan={ROLES.length + 1} className="bg-surface/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.area}</td></tr>
                {g.caps.map((cap) => (
                  <tr key={cap.id} className="border-b border-border/40">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        {cap.label}
                        {cap.locked && (
                          <Tooltip.Provider delayDuration={150}><Tooltip.Root>
                            <Tooltip.Trigger asChild><button className="text-muted"><Lock size={12} /></button></Tooltip.Trigger>
                            <Tooltip.Portal><Tooltip.Content side="top" className="z-50 max-w-[260px] rounded border border-border bg-white p-2 text-[11px] shadow-md">{cap.lockedTooltip}</Tooltip.Content></Tooltip.Portal>
                          </Tooltip.Root></Tooltip.Provider>
                        )}
                      </span>
                    </td>
                    {ROLES.map((role) => {
                      const checked = can(role, cap.id, permissions);
                      const readOnly = cap.locked || role === 'Admin';
                      return (
                        <td key={role} className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readOnly}
                            onChange={(e) => toggle(role, cap.id, e.target.checked)}
                            className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            title={readOnly ? (cap.locked ? cap.lockedTooltip : 'Admin always has every permission.') : ''}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface/40 p-3 text-sm">
        <TagPill kind="Confirm with business" />
        <p className="text-muted">
          In the product, sign-in and group membership will likely come from the company’s identity system.
          Whether roles are assigned inside this app or outside it depends on the platform chosen. This screen
          shows the rules, not the final mechanism.
        </p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all permissions to defaults?"
        description="This restores every role’s permissions to the starting defaults. Locked rules are unaffected."
        confirmLabel="Reset to defaults"
        onConfirm={() => { resetPermissions(); push('Permissions reset to defaults.', 'success'); setConfirmReset(false); }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

/* --------------------------------- Tab C ---------------------------------- */
function ChangeLogTab() {
  const log = useAppStore((s) => s.userRoleLog);
  const [type, setType] = useState<'all' | 'user' | 'permission'>('all');
  const rows = log.filter((e) => type === 'all' || e.type === type);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted">Filter:</span>
        {(['all', 'user', 'permission'] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full border px-2.5 py-1 text-xs capitalize ${type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface'}`}>{t}</button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-white p-6 text-center text-sm text-muted">No changes recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2">When</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Change</th>
                <th className="px-3 py-2">Old</th><th className="px-3 py-2">New</th><th className="px-3 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border/40">
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted">{new Date(e.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-1.5 capitalize">{e.type}</td>
                  <td className="px-3 py-1.5 text-ink">{e.what}</td>
                  <td className="px-3 py-1.5 text-muted">{e.oldValue ?? '—'}</td>
                  <td className="px-3 py-1.5 text-muted">{e.newValue ?? '—'}</td>
                  <td className="px-3 py-1.5 text-muted">{e.changedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
