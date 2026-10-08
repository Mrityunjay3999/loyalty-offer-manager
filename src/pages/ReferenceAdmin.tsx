import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Plus, Trash2, Save, Lock, Search, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { ProposedRuleIcon } from '@/components/ProposedRuleIcon';
import { reference } from '@/lib/dataLoaders';
import { parseISO } from '@/lib/format';
import { mergedCategoryDropdowns } from '@/lib/options';
import { can } from '@/lib/permissions';
import type { CategorySubCategory, TieringDefinition, LifecycleStatus, OfferSetupCombo, SoftLockPlannerRow } from '@/lib/types';

export function ReferenceAdmin() {
  const role = useAppStore((s) => s.role);
  const permissions = useAppStore((s) => s.permissions); // re-render when the matrix changes
  // Each area has its own capability so the permission matrix actually gates it.
  const canLists = can(role, 'addChangeListValues', permissions);
  const canStatuses = can(role, 'editStatusDefs', permissions);
  const canDbx = can(role, 'editDatabricksNames', permissions);
  const canAny = canLists || canStatuses || canDbx;
  const TABS = [
    'Categories', 'Offer tiering', 'Statuses', 'Dropdown lists', 'Offer setups',
    'Transaction types', 'Soft lock planner', 'Deactivation rules', 'Brands', 'Databricks tables',
  ];

  return (
    <div>
      <PageHeader title="Reference data">
        {!canAny && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted" title="You don't have permission to change reference data.">
            <Lock size={12} /> Read-only
          </span>
        )}
      </PageHeader>
      <div className="mb-3 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted" data-testid="reference-structure-banner">
        You can add or change list values here. Fields (columns) cannot be added or removed in the
        app. Lists usually change once a quarter to once a year.
      </div>
      <p className="mb-3 text-sm text-muted">
        Every change is logged and is immediately available in the dropdowns.
        {' '}Retiring a value keeps it on offers already using it (
        <span className="inline-flex items-center gap-1">proposed rule <ProposedRuleIcon /></span>).
        {!canLists && <span className="ml-1 italic">Changing list values needs the “Add or change list values” permission.</span>}
      </p>

      <Tabs.Root defaultValue="Categories">
        <Tabs.List className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t}
              value={t}
              className="border-b-2 border-transparent px-3 py-2 text-sm text-muted data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-primary"
            >
              {t}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="Categories"><CategoriesTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Offer tiering"><TieringTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Statuses"><StatusesTab readOnly={!canStatuses} /></Tabs.Content>
        <Tabs.Content value="Dropdown lists"><DropdownsTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Offer setups"><SetupsTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Transaction types"><TransactionTypesTab /></Tabs.Content>
        <Tabs.Content value="Soft lock planner"><SoftLockTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Deactivation rules"><DeactivationTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Brands"><BrandsTab readOnly={!canLists} /></Tabs.Content>
        <Tabs.Content value="Databricks tables"><DatabricksTablesTab readOnly={!canDbx} /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

const input = 'w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none disabled:bg-surface';
const saveBtn = 'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40';
const addBtn = 'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface';

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 flex items-center gap-2">{children}</div>;
}

// ---- Categories & sub-categories ----
function CategoriesTab({ readOnly }: { readOnly: boolean }) {
  const rows = useAppStore((s) => s.categorySubCategory);
  const dropdowns = useAppStore((s) => s.dropdowns);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const [draft, setDraft] = useState<CategorySubCategory[]>(() => rows.map((r) => ({ ...r })));

  function up(i: number, patch: Partial<CategorySubCategory>) {
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function save() {
    // Single source of truth: saving here also makes every category/sub-category
    // selectable by syncing the planningCategory / planningSubCategory dropdown
    // lists. Additive only — existing values are never removed (retire them in
    // the Dropdown lists tab instead), so offers already using a value are safe.
    const { planningCategory, planningSubCategory } = mergedCategoryDropdowns(draft, dropdowns);
    const addedCats = planningCategory.length - (dropdowns.planningCategory ?? []).length;
    const addedSubs = planningSubCategory.length - (dropdowns.planningSubCategory ?? []).length;
    editReference(
      {
        categorySubCategory: draft,
        dropdowns: { ...dropdowns, planningCategory, planningSubCategory },
      },
      `Edited category/sub-category list (${draft.length} pairs${addedCats || addedSubs ? `; +${addedCats} category, +${addedSubs} sub-category options` : ''})`,
    );
    push(
      addedCats || addedSubs
        ? `Categories saved. ${addedCats} new category and ${addedSubs} new sub-category option(s) are now selectable.`
        : 'Categories saved.',
      'success',
    );
  }

  return (
    <div>
      <Toolbar>
        {!readOnly && (
          <button className={addBtn} onClick={() => setDraft((d) => [...d, { category: '', subCategory: '', example: '', isNew: true }])}>
            <Plus size={14} /> Add pair
          </button>
        )}
        {!readOnly && (
          <button className={saveBtn} onClick={save}>
            <Save size={14} /> Save changes
          </button>
        )}
      </Toolbar>
      {!readOnly && (
        <p className="mb-2 text-xs text-muted">
          This is the single place to manage categories and sub-categories. Saving adds any new
          category or sub-category to the offer form dropdowns automatically — no second step.
        </p>
      )}
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-border bg-surface text-muted">
            <tr><th className="px-2 py-2">Category</th><th className="px-2 py-2">Sub-Category</th><th className="px-2 py-2">Example</th><th className="px-2 py-2">Active/new</th>{!readOnly && <th />}</tr>
          </thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-2 py-1"><input className={input} disabled={readOnly} value={r.category} onChange={(e) => up(i, { category: e.target.value })} /></td>
                <td className="px-2 py-1"><input className={input} disabled={readOnly} value={r.subCategory} onChange={(e) => up(i, { subCategory: e.target.value })} /></td>
                <td className="px-2 py-1"><input className={input} disabled={readOnly} value={r.example ?? ''} onChange={(e) => up(i, { example: e.target.value })} /></td>
                <td className="px-2 py-1"><input type="checkbox" disabled={readOnly} checked={r.isNew} onChange={(e) => up(i, { isNew: e.target.checked })} /></td>
                {!readOnly && <td className="px-2 py-1 text-right"><button className="text-muted hover:text-danger" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Offer tiering ----
function TieringTab({ readOnly }: { readOnly: boolean }) {
  const rows = useAppStore((s) => s.tieringDefinitions);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const [draft, setDraft] = useState<TieringDefinition[]>(() => rows.map((r) => ({ ...r })));
  return (
    <div>
      {!readOnly && <Toolbar><button className={saveBtn} onClick={() => { editReference({ tieringDefinitions: draft }, 'Edited offer tiering definitions'); push('Tiering saved.', 'success'); }}><Save size={14} /> Save changes</button></Toolbar>}
      <div className="overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-muted"><tr><th className="px-2 py-2">Tier</th><th className="px-2 py-2">Description</th><th className="px-2 py-2">Example</th></tr></thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={r.tier} className="border-b border-border last:border-0">
                <td className="px-2 py-1 font-medium">{r.tier}</td>
                <td className="px-2 py-1"><input className={input} disabled={readOnly} value={r.description} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></td>
                <td className="px-2 py-1"><input className={input} disabled={readOnly} value={r.example ?? ''} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, example: e.target.value } : x)))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{reference.tieringNote}</p>
    </div>
  );
}

// ---- Statuses ----
function StatusesTab({ readOnly }: { readOnly: boolean }) {
  const rows = useAppStore((s) => s.lifecycle);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const [draft, setDraft] = useState<LifecycleStatus[]>(() => rows.map((r) => ({ ...r })));
  return (
    <div>
      {!readOnly && <Toolbar><button className={saveBtn} onClick={() => { editReference({ lifecycle: draft }, 'Edited status definitions'); push('Statuses saved.', 'success'); }}><Save size={14} /> Save changes</button></Toolbar>}
      <div className="overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-muted"><tr><th className="px-2 py-2">Status</th><th className="px-2 py-2">Definition</th><th className="px-2 py-2">Documented</th><th className="px-2 py-2">Business definition confirmed</th></tr></thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={r.status} className="border-b border-border last:border-0">
                <td className="px-2 py-1 font-medium">{r.status}</td>
                <td className="px-2 py-1"><textarea className={input} rows={2} disabled={readOnly} value={r.definition} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, definition: e.target.value } : x)))} /></td>
                <td className="px-2 py-1">{r.documented ? 'Yes' : <span className="text-warning">No</span>}</td>
                <td className="px-2 py-1"><input type="checkbox" disabled={readOnly} checked={r.confirmed ?? false} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Dropdown lists ----
function DropdownsTab({ readOnly }: { readOnly: boolean }) {
  const dropdowns = useAppStore((s) => s.dropdowns);
  const offers = useAppStore((s) => s.offers);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const keys = useMemo(() => Object.keys(dropdowns).filter((k) => k !== 'brands' && k !== 'transactionTypes'), [dropdowns]);
  const [key, setKey] = useState(keys[0]);
  const [values, setValues] = useState<string[]>(() => [...(dropdowns[keys[0]] ?? [])]);
  const [newVal, setNewVal] = useState('');

  function pick(k: string) { setKey(k); setValues([...(dropdowns[k] ?? [])]); }
  const usedValues = useMemo(() => new Set(offers.map((o) => String(o[key] ?? ''))), [offers, key]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm text-muted">List:</label>
        <select className="rounded-md border border-border px-2 py-1 text-sm" value={key} onChange={(e) => pick(e.target.value)}>
          {keys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        {!readOnly && (
          <>
            <input className="rounded-md border border-border px-2 py-1 text-sm" placeholder="New value" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
            <button className={addBtn} onClick={() => { if (newVal.trim()) { setValues((v) => [...v, newVal.trim()]); setNewVal(''); } }}><Plus size={14} /> Add</button>
            <button className={saveBtn} onClick={() => { editReference({ dropdowns: { ...dropdowns, [key]: values } }, `Edited dropdown list "${key}"`); push(`List "${key}" saved.`, 'success'); }}><Save size={14} /> Save</button>
          </>
        )}
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-border bg-surface text-muted"><tr><th className="px-2 py-2">Value</th><th className="px-2 py-2">In use</th>{!readOnly && <th />}</tr></thead>
          <tbody>
            {values.map((v, i) => {
              const used = usedValues.has(v);
              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2 py-1"><input className={input} disabled={readOnly} value={v} onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))} /></td>
                  <td className="px-2 py-1 text-muted">{used ? 'Yes' : 'No'}</td>
                  {!readOnly && (
                    <td className="px-2 py-1 text-right">
                      <button
                        title={used ? 'Value in use — cannot hard-delete' : 'Remove'}
                        disabled={used}
                        className="text-muted hover:text-danger disabled:opacity-30"
                        onClick={() => setValues((vs) => vs.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Values in use cannot be hard-deleted (rename to retire them instead).</p>
    </div>
  );
}

// ---- Offer setups ----
function SetupsTab({ readOnly }: { readOnly: boolean }) {
  const rows = useAppStore((s) => s.offerSetupCombos);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const [draft, setDraft] = useState<OfferSetupCombo[]>(() => rows.map((r) => ({ ...r })));
  const cols: Array<[keyof OfferSetupCombo, string]> = [['offerDesign', 'Offer Design'], ['activationSetupType', 'Activation Setup'], ['offerSetupType', 'Offer Setup'], ['optInMethod', 'Opt-In']];
  return (
    <div>
      {!readOnly && <Toolbar>
        <button className={addBtn} onClick={() => setDraft((d) => [...d, { offerDesign: '', activationSetupType: '', offerSetupType: '', optInMethod: '' }])}><Plus size={14} /> Add</button>
        <button className={saveBtn} onClick={() => { editReference({ offerSetupCombos: draft }, 'Edited offer setup combinations'); push('Setups saved.', 'success'); }}><Save size={14} /> Save</button>
      </Toolbar>}
      <div className="overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-muted"><tr>{cols.map(([, l]) => <th key={l} className="px-2 py-2">{l}</th>)}{!readOnly && <th />}</tr></thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {cols.map(([k]) => <td key={k} className="px-2 py-1"><input className={input} disabled={readOnly} value={r[k]} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} /></td>)}
                {!readOnly && <td className="px-2 py-1 text-right"><button className="text-muted hover:text-danger" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Transaction types (searchable) ----
function TransactionTypesTab() {
  const [q, setQ] = useState('');
  const rows = reference.transactionTypes;
  const cols = Object.keys(rows[0] ?? {});
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(s)) : rows).slice(0, 100);
  }, [q, rows]);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" /><input className="rounded-md border border-border py-1 pl-7 pr-2 text-sm" placeholder="Search transaction types" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-muted">{rows.length.toLocaleString()} rows (showing up to 100)</span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 border-b border-border bg-surface text-muted"><tr>{cols.map((c) => <th key={c} className="px-2 py-2">{c}</th>)}</tr></thead>
          <tbody>
            {filtered.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{cols.map((c) => <td key={c} className="px-2 py-1">{String((r as Record<string, unknown>)[c] ?? '')}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Soft lock planner ----
function SoftLockTab({ readOnly }: { readOnly: boolean }) {
  const rows = useAppStore((s) => s.softLockPlanner);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const [draft, setDraft] = useState<SoftLockPlannerRow[]>(() => rows.map((r) => ({ ...r })));

  function issues(r: SoftLockPlannerRow): string[] {
    const out: string[] = [];
    const s = parseISO(r.plannerStart), e = parseISO(r.plannerEnd), sl = parseISO(r.softLock);
    if (s && e && e < s) out.push('End before Start');
    if (sl && e && sl > e) out.push('Soft lock after planner month');
    return out;
  }
  const cols: Array<[keyof SoftLockPlannerRow, string]> = [['month', 'Month'], ['plannerStart', 'Planner Start'], ['plannerEnd', 'Planner End'], ['softLock', 'Soft Lock']];
  return (
    <div>
      {!readOnly && <Toolbar><button className={saveBtn} onClick={() => { editReference({ softLockPlanner: draft }, 'Edited soft lock planner'); push('Soft lock planner saved.', 'success'); }}><Save size={14} /> Save</button></Toolbar>}
      <div className="overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-muted"><tr>{cols.map(([, l]) => <th key={l} className="px-2 py-2">{l}</th>)}<th className="px-2 py-2">Flags</th></tr></thead>
          <tbody>
            {draft.map((r, i) => {
              const flags = issues(r);
              return (
                <tr key={i} className={`border-b border-border last:border-0 ${flags.length ? 'bg-warning/5' : ''}`}>
                  {cols.map(([k]) => <td key={k} className="px-2 py-1"><input className={input} disabled={readOnly} value={String(r[k])} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} /></td>)}
                  <td className="px-2 py-1">{flags.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle size={13} /> {flags.join('; ')}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Deactivation rules ----
function DeactivationTab({ readOnly }: { readOnly: boolean }) {
  const rules = useAppStore((s) => s.deactivationRules);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const [text, setText] = useState(() => rules.join('\n'));
  return (
    <div>
      <textarea className="min-h-[220px] w-full rounded-lg border border-border p-3 text-sm focus:border-primary focus:outline-none disabled:bg-surface" disabled={readOnly} value={text} onChange={(e) => setText(e.target.value)} />
      {!readOnly && <div className="mt-2"><button className={saveBtn} onClick={() => { editReference({ deactivationRules: text.split('\n').filter(Boolean) }, 'Edited deactivation code rules'); push('Deactivation rules saved.', 'success'); }}><Save size={14} /> Save</button></div>}
    </div>
  );
}

// ---- Brands ----
function BrandsTab({ readOnly }: { readOnly: boolean }) {
  const dropdowns = useAppStore((s) => s.dropdowns);
  const editReference = useAppStore((s) => s.editReference);
  const push = useToasts((s) => s.push);
  const brands = dropdowns.brands ?? [];
  const [q, setQ] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? brands.filter((b) => b.toLowerCase().includes(s)) : brands).slice(0, 100);
  }, [q, brands]);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" /><input className="rounded-md border border-border py-1 pl-7 pr-2 text-sm" placeholder="Search brands" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-muted">{brands.length.toLocaleString()} brands</span>
        {!readOnly && <>
          <input className="rounded-md border border-border px-2 py-1 text-sm" placeholder="New brand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
          <button className={addBtn} onClick={() => { if (newBrand.trim()) { editReference({ dropdowns: { ...dropdowns, brands: [...brands, newBrand.trim()] } }, `Added brand "${newBrand.trim()}"`); push('Brand added.', 'success'); setNewBrand(''); } }}><Plus size={14} /> Add brand</button>
        </>}
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-white">
        <ul className="divide-y divide-border text-sm">
          {filtered.map((b, i) => <li key={i} className="px-3 py-1.5">{b}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ---- Databricks tables (C2) ----
function DatabricksTablesTab({ readOnly }: { readOnly: boolean }) {
  const names = useAppStore((s) => s.databricksTableNames);
  const setName = useAppStore((s) => s.setDatabricksTableName);
  const push = useToasts((s) => s.push);
  const [attr, setAttr] = useState(names.attributes ?? '');
  const [metric, setMetric] = useState(names.metrics ?? '');
  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-muted">The metadata load writes to two Databricks tables. Exact names are to be confirmed by the business.</p>
      <div>
        <label className="mb-1 block text-sm font-medium">Features metadata (attributes · MA)</label>
        <input className={input} disabled={readOnly} placeholder="catalog.schema.table" value={attr} onChange={(e) => setAttr(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Features metadata metrics (CM)</label>
        <input className={input} disabled={readOnly} placeholder="catalog.schema.table" value={metric} onChange={(e) => setMetric(e.target.value)} />
      </div>
      {!readOnly && (
        <button className={saveBtn} onClick={() => { if (attr.trim()) setName('attributes', attr.trim()); if (metric.trim()) setName('metrics', metric.trim()); push('Databricks table names saved.', 'success'); }}>
          <Save size={14} /> Save
        </button>
      )}
    </div>
  );
}
