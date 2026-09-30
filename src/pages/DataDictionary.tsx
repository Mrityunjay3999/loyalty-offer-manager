import { PageHeader } from '@/components/PageHeader';
import { ComingSoon } from '@/components/EmptyState';
import { fields } from '@/lib/dataLoaders';

export function DataDictionary() {
  return (
    <div>
      <PageHeader title="Data dictionary" count={fields.length} />
      <ComingSoon
        title="The searchable field dictionary is coming in Milestone 10"
        milestone="Milestone 10 (Reference data admin, Evergreen offers, Data dictionary)"
      />
    </div>
  );
}
