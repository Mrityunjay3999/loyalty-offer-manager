// Milestone 1 (Scaffold) landing screen.
// Proves the seed data loads, the Zustand store is wired with persistence, and
// "Reset demo data" works. The full app shell, routing and pages arrive in
// Milestone 2 onward.
import { useState } from 'react';
import { RotateCcw, Database, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  fields,
  systemFields,
  checklistFields,
  dropdowns,
  metadataFields,
  reference,
  STEP_ORDER,
  fieldsByStep,
} from '@/lib/dataLoaders';
import type { Role } from '@/lib/types';

const ROLES: Role[] = [
  'Offer Team Editor',
  'Loyalty & Pricing',
  'Approver (TBC)',
  'View-only',
  'Admin',
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <div className="text-2xl font-semibold text-ink tabular-nums">{value}</div>
      <div className="text-muted">{label}</div>
    </div>
  );
}

export default function App() {
  const offers = useAppStore((s) => s.offers);
  const auditLog = useAppStore((s) => s.auditLog);
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const editableDropdowns = useAppStore((s) => s.dropdowns);

  const [justReset, setJustReset] = useState(false);

  const formFieldCount = fields.length - systemFields.length;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-ink">Loyalty Offer Manager</span>
          <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-medium text-accent">
            Prototype
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted">Viewing as:</label>
          <select
            className="rounded-md border border-border bg-white px-2 py-1"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-ink hover:bg-surface"
            onClick={() => {
              resetDemoData();
              setJustReset(true);
              setTimeout(() => setJustReset(false), 2500);
            }}
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-4 py-3 text-success">
          <CheckCircle2 size={18} />
          <span className="font-medium">
            Milestone 1 (Scaffold) is running. Data and store are wired.
          </span>
        </div>

        {justReset && (
          <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-primary">
            Demo data reset to the seed values.
          </div>
        )}

        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Database size={18} className="text-primary" /> Seed data loaded
        </h2>
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fields (fields.json)" value={fields.length} />
          <Stat label="Offers (in store)" value={offers.length} />
          <Stat label="Dropdown lists" value={Object.keys(editableDropdowns).length} />
          <Stat label="Metadata columns" value={metadataFields.length} />
          <Stat label="Form fields" value={formFieldCount} />
          <Stat label="System (hidden)" value={systemFields.length} />
          <Stat label="Checklist fields" value={checklistFields.length} />
          <Stat label="Audit entries" value={auditLog.length} />
        </div>

        <h3 className="mb-2 font-semibold">Fields per step</h3>
        <div className="mb-8 overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-surface text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Step</th>
                <th className="px-4 py-2 text-right font-medium">Fields</th>
              </tr>
            </thead>
            <tbody>
              {STEP_ORDER.map((step) => (
                <tr key={step} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{step}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fieldsByStep[step].length}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface">
                <td className="px-4 py-2 font-medium">System (hidden)</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {systemFields.length}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-muted">
          Reference tables loaded: {reference.lifecycle.length} lifecycle statuses,{' '}
          {reference.categorySubCategory.length} category/sub-category pairs,{' '}
          {reference.tieringDefinitions.length} tier definitions,{' '}
          {Object.keys(dropdowns).length} dropdown lists. Edits and role persist to
          localStorage key <code className="rounded bg-surface px-1">lom-prototype-v1</code>.
        </p>
      </main>
    </div>
  );
}
