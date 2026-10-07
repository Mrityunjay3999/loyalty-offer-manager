import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutList,
  Eye,
  CheckSquare,
  BarChart3,
  Repeat,
  Table2,
  BookOpen,
  Database,
  CalendarDays,
  RotateCcw,
  HelpCircle,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { can } from '@/lib/permissions';
import { useToasts } from '@/store/useToasts';
import { RoleSwitcher } from './RoleSwitcher';
import { HelpDrawer } from './HelpDrawer';
import { PhaseBadge } from './PhaseBadge';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: 'approvals';
  phase2?: boolean;
  adminNote?: boolean;
}

interface NavItemX extends NavItem {
  editOnly?: boolean;
}
const NAV: NavItemX[] = [
  { to: '/', label: 'Offers (Edit)', icon: LayoutList, end: true, editOnly: true },
  { to: '/view', label: 'Offer View', icon: Eye },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare, badge: 'approvals' },
  { to: '/results-forecast', label: 'Results & Forecast', icon: BarChart3 },
  { to: '/evergreen', label: 'Evergreen offers', icon: Repeat },
  { to: '/reference', label: 'Reference data', icon: Table2, adminNote: true },
  { to: '/dictionary', label: 'Data dictionary', icon: BookOpen },
  { to: '/data-feed', label: 'Data feed (Databricks)', icon: Database },
  { to: '/calendar', label: 'Calendar view', icon: CalendarDays, phase2: true },
];

export function AppShell() {
  const navigate = useNavigate();
  const offers = useAppStore((s) => s.offers);
  const role = useAppStore((s) => s.role);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const push = useToasts((s) => s.push);
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState('');

  const approvalsCount = offers.filter(
    (o) =>
      o.buildStatus === 'Proposed' || o.buildStatus === 'Pending SteerCo Approval',
  ).length;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-ink">Loyalty Offer Manager</span>
            <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-medium text-accent">
              Prototype
            </span>
          </NavLink>
        </div>

        <form onSubmit={submitSearch} className="relative hidden flex-1 md:block md:max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            className="w-full rounded-md border border-border bg-white py-1.5 pl-8 pr-3 focus:border-primary focus:outline-none"
            placeholder="Search offer name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Global search"
          />
        </form>

        <div className="flex items-center gap-3">
          <RoleSwitcher />
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-ink hover:bg-surface"
            onClick={() => {
              resetDemoData();
              push('Demo data reset to the seed values.', 'success');
            }}
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
          <button
            aria-label="Help"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-ink hover:bg-surface"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle size={15} /> Help
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-60 shrink-0 border-r border-border bg-white px-2 py-3">
          <ul className="space-y-0.5">
            {NAV.filter((item) => !item.editOnly || can(role, 'openEditArea')).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-2 ${
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-ink hover:bg-surface'
                    }`
                  }
                >
                  <item.icon size={17} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === 'approvals' && approvalsCount > 0 && (
                    <span className="rounded-full bg-warning px-1.5 py-0.5 text-xs font-medium text-white">
                      {approvalsCount}
                    </span>
                  )}
                  {item.phase2 && <PhaseBadge />}
                </NavLink>
                {item.adminNote && role !== 'Admin' && (
                  <div className="px-3 pb-1 pl-10 text-xs text-muted">Read-only</div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1 bg-surface px-6 py-5">
          <Outlet />
        </main>
      </div>

      <HelpDrawer open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
