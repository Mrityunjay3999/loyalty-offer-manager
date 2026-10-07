import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { Toasts } from '@/components/Toasts';
import { useAppStore } from '@/store/useAppStore';
import { can } from '@/lib/permissions';
import { OffersList } from '@/pages/OffersList';
import { OfferView } from '@/pages/OfferView';
import { OfferWorkspace } from '@/pages/OfferWorkspace';
import { ApprovalsQueue } from '@/pages/ApprovalsQueue';
import { ResultsForecast } from '@/pages/ResultsForecast';
import { ReferenceAdmin } from '@/pages/ReferenceAdmin';
import { EvergreenOffers } from '@/pages/EvergreenOffers';
import { DataDictionary } from '@/pages/DataDictionary';
import { DataFeedPreview } from '@/pages/DataFeedPreview';
import { Phase2Calendar } from '@/pages/Phase2Calendar';
import { FieldPreview } from '@/pages/dev/FieldPreview';
import { NotFound } from '@/pages/NotFound';

/** A5: the Offers (Edit) area is only for Editor and Admin; others go to Offer View. */
function RequireEdit({ children }: { children: ReactElement }) {
  const role = useAppStore((s) => s.role);
  return can(role, 'openEditArea') ? children : <Navigate to="/view" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<RequireEdit><OffersList /></RequireEdit>} />
          <Route path="view" element={<OfferView />} />
          <Route path="offers/new" element={<RequireEdit><OfferWorkspace /></RequireEdit>} />
          <Route path="offers/:offerId" element={<RequireEdit><OfferWorkspace /></RequireEdit>} />
          <Route path="approvals" element={<ApprovalsQueue />} />
          <Route path="results-forecast" element={<ResultsForecast />} />
          <Route path="evergreen" element={<EvergreenOffers />} />
          <Route path="reference" element={<ReferenceAdmin />} />
          <Route path="dictionary" element={<DataDictionary />} />
          <Route path="data-feed" element={<DataFeedPreview />} />
          <Route path="calendar" element={<Phase2Calendar />} />
          <Route path="dev/fields" element={<FieldPreview />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toasts />
    </HashRouter>
  );
}
