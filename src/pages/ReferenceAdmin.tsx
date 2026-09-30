import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { ComingSoon, EmptyState } from '@/components/EmptyState';
import { Lock } from 'lucide-react';

export function ReferenceAdmin() {
  const role = useAppStore((s) => s.role);
  const isAdmin = role === 'Admin';
  return (
    <div>
      <PageHeader title="Reference data">
        {!isAdmin && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
            <Lock size={12} /> Read-only
          </span>
        )}
      </PageHeader>
      {isAdmin ? (
        <ComingSoon
          title="Reference data editing is coming in Milestone 10"
          milestone="Milestone 10 (Reference data admin, Evergreen offers, Data dictionary)"
        />
      ) : (
        <EmptyState
          icon={Lock}
          title="Reference data is read-only for this role"
          message="Switch to Admin (business owner) to edit categories, tiers, statuses, dropdown lists and more."
        />
      )}
    </div>
  );
}
