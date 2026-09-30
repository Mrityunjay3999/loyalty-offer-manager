import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';
import { reference } from '@/lib/dataLoaders';

export function EvergreenOffers() {
  // referenced so the count is real even before the full table lands
  useAppStore((s) => s.role);
  return (
    <div>
      <PageHeader title="Evergreen offers" count={reference.evergreenOffers.length} />
      <div className="mb-4 rounded-lg border border-border bg-white px-4 py-2.5 text-muted">
        Always-on offers tracked separately today.
      </div>
      <ComingSoon
        title="The evergreen offers table is coming in Milestone 10"
        milestone="Milestone 10 (Reference data admin, Evergreen offers, Data dictionary)"
      />
    </div>
  );
}
