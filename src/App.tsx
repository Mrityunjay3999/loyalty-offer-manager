import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Toasts } from '@/components/Toasts';
import { OffersList } from '@/pages/OffersList';
import { OfferWorkspace } from '@/pages/OfferWorkspace';
import { ApprovalsQueue } from '@/pages/ApprovalsQueue';
import { WbrView } from '@/pages/WbrView';
import { ReferenceAdmin } from '@/pages/ReferenceAdmin';
import { EvergreenOffers } from '@/pages/EvergreenOffers';
import { DataDictionary } from '@/pages/DataDictionary';
import { DataFeedPreview } from '@/pages/DataFeedPreview';
import { Phase2Calendar } from '@/pages/Phase2Calendar';
import { FieldPreview } from '@/pages/dev/FieldPreview';
import { NotFound } from '@/pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OffersList />} />
          <Route path="offers/new" element={<OfferWorkspace />} />
          <Route path="offers/:offerId" element={<OfferWorkspace />} />
          <Route path="approvals" element={<ApprovalsQueue />} />
          <Route path="wbr" element={<WbrView />} />
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
    </BrowserRouter>
  );
}
