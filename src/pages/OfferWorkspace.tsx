import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';

export function OfferWorkspace() {
  const { offerId } = useParams();
  return (
    <div>
      <PageHeader title={offerId ? `Offer ${offerId}` : 'New offer'} />
      <ComingSoon
        title="The 9-step offer workspace is coming in Milestone 6"
        milestone="Milestone 6 (Offer workspace: steps 1–9, Review, right panel, autosave, submit)"
      />
    </div>
  );
}
