import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';
import { metadataFields } from '@/lib/dataLoaders';

export function DataFeedPreview() {
  return (
    <div>
      <PageHeader title="Data feed (Databricks)" count={metadataFields.length} />
      <ComingSoon
        title="The metadata feed preview and simulations are coming in Milestone 11"
        milestone="Milestone 11 (Data feed preview with simulations)"
      />
    </div>
  );
}
