import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';

export function OffersList() {
  const offers = useAppStore((s) => s.offers);
  return (
    <div>
      <PageHeader title="Offers" count={offers.length} />
      <ComingSoon
        title="The offers grid is coming in Milestone 5"
        milestone="Milestone 5 (Offers list: filters, saved views, columns, export, copy)"
      />
    </div>
  );
}
