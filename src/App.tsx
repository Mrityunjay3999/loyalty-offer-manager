import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, type ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { Toasts } from '@/components/Toasts';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
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
import { UsersAndRoles } from '@/pages/UsersAndRoles';
import { FieldPreview } from '@/pages/dev/FieldPreview';
import { NotFound } from '@/pages/NotFound';

/** Route guard: redirect to Offer View (with a toast) when the role lacks `cap`. */
function RequireCap({ cap, children }: { cap: string; children: ReactElement }) {
  const role = useAppStore((s) => s.role);
  const permissions = useAppStore((s) => s.permissions);
  const push = useToasts((s) => s.push);
  const allowed = can(role, cap, permissions);
  useEffect(() => {
    if (!allowed) push("You don't have access to that page.", 'info');
  }, [allowed, push]);
  return allowed ? children : <Navigate to="/view" replace />;
}

/** A5: the Offers (Edit) area is only for Editor and Admin; others go to Offer View. */
function RequireEdit({ children }: { children: ReactElement }) {
  return <RequireCap cap="openEditArea">{children}</RequireCap>;
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
          <Route path="results-forecast" element={<RequireCap cap="openResultsForecast"><ResultsForecast /></RequireCap>} />
          <Route path="evergreen" element={<EvergreenOffers />} />
          <Route path="reference" element={<RequireCap cap="openReference"><ReferenceAdmin /></RequireCap>} />
          <Route path="admin/users" element={<RequireCap cap="manageUsers"><UsersAndRoles /></RequireCap>} />
          <Route path="dictionary" element={<DataDictionary />} />
          <Route path="data-feed" element={<RequireCap cap="openDataFeed"><DataFeedPreview /></RequireCap>} />
          <Route path="calendar" element={<Phase2Calendar />} />
          <Route path="dev/fields" element={<FieldPreview />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toasts />
    </HashRouter>
  );
}
