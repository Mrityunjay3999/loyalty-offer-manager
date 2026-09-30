import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';

export function WbrView() {
  return (
    <div>
      <PageHeader title="Weekly business review" />
      <ComingSoon
        title="The WBR view is coming in Milestone 9"
        milestone="Milestone 9 (Approvals queue, WBR view)"
      />
    </div>
  );
}
