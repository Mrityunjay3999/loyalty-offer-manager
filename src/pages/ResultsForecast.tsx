// Results & Forecast page. The Grid and "How it is calculated" tabs are built in
// Milestone 5; for now the WBR tab (reading from rf.*) is available here and the
// legacy WBR nav item is absorbed into this page.
import * as Tabs from '@radix-ui/react-tabs';
import { PageHeader } from '@/components/PageHeader';
import { PhaseBadge } from '@/components/PhaseBadge';
import { ComingSoon } from '@/components/EmptyState';
import { WbrView } from '@/pages/WbrView';

export function ResultsForecast() {
  return (
    <div>
      <PageHeader title="Results & Forecast">
        <PhaseBadge note="Interim calculation. The analytics team's forecast and results models will replace these formulas after MVP." />
      </PageHeader>
      <p className="mb-3 text-sm text-muted">
        Calculated from each offer. Nothing is typed on this page. Forecast inputs and actual
        results are entered on the offer (Step 7 and Step 9).
      </p>
      <Tabs.Root defaultValue="grid">
        <Tabs.List className="mb-4 flex gap-1 border-b border-border">
          {[['grid', 'Grid'], ['wbr', 'WBR'], ['how', 'How it is calculated']].map(([v, l]) => (
            <Tabs.Trigger key={v} value={v}
              className="border-b-2 border-transparent px-3 py-2 text-sm text-muted data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-primary">
              {l}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="grid">
          <ComingSoon title="The full Results & Forecast grid is coming in Milestone 5" milestone="Milestone 5 (Results & Forecast page)" />
        </Tabs.Content>
        <Tabs.Content value="wbr"><WbrView /></Tabs.Content>
        <Tabs.Content value="how">
          <ComingSoon title="The How-it-is-calculated reference is coming in Milestone 5" milestone="Milestone 5" />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
