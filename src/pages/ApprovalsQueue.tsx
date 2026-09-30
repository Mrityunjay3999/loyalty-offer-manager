import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';

export function ApprovalsQueue() {
  const offers = useAppStore((s) => s.offers);
  const count = offers.filter(
    (o) =>
      o.buildStatus === 'Proposed' || o.buildStatus === 'Pending SteerCo Approval',
  ).length;
  return (
    <div>
      <PageHeader title="Approvals" count={count} />
      <ComingSoon
        title="The approvals queue is coming in Milestone 9"
        milestone="Milestone 9 (Approvals queue, WBR view)"
      />
    </div>
  );
}
