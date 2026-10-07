import { Lock } from 'lucide-react';

// Shared tag pills (spec ground rule 7). One component, one style per meaning.
export type TagKind =
  | 'Typed'
  | 'Dropdown'
  | 'Calculated'
  | 'Fixed number'
  | 'Auto-generated'
  | 'Locked'
  | 'Confirm with business'
  | 'Provisional'
  | 'Phase 2'
  | 'MVP scope to confirm';

const STYLES: Record<TagKind, string> = {
  Typed: 'border border-blue-400 text-blue-700 bg-white',
  Dropdown: 'bg-blue-600 text-white',
  Calculated: 'bg-success/15 text-success',
  'Fixed number': 'bg-gray-100 text-gray-600',
  'Auto-generated': 'bg-purple-100 text-purple-700',
  Locked: 'bg-slate-200 text-slate-700',
  'Confirm with business': 'border border-warning text-warning bg-white',
  Provisional: 'border border-dashed border-warning text-warning bg-white',
  'Phase 2': 'border border-accent bg-accent/10 text-accent',
  'MVP scope to confirm': 'border border-warning text-warning bg-white',
};

export function TagPill({ kind, title }: { kind: TagKind; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium ${STYLES[kind]}`}
    >
      {kind === 'Locked' && <Lock size={10} />}
      {kind}
    </span>
  );
}
