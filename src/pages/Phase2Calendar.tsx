import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';
import { PhaseBadge } from '@/components/PhaseBadge';

export function Phase2Calendar() {
  return (
    <div>
      <PageHeader title="Calendar view">
        <PhaseBadge />
      </PageHeader>
      <ComingSoon
        title="The month-grid calendar is a Phase 2 preview (Milestone 12)"
        milestone="Milestone 12 (Phase 2 previews)"
      />
    </div>
  );
}
