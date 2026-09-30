import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fieldsById } from '@/lib/dataLoaders';
import type { Issue } from '@/lib/validation';

/** Lists validation errors and warnings; each row jumps to the field. */
export function ValidationSummary({
  errors,
  warnings,
  onJump,
}: {
  errors: Issue[];
  warnings: Issue[];
  onJump?: (fieldId: string) => void;
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-success">
        <CheckCircle2 size={16} /> No errors or warnings.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-medium text-danger">
            <AlertCircle size={15} /> {errors.length} error{errors.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <Row key={`e${i}`} issue={e} onJump={onJump} kind="error" />
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-medium text-warning">
            <AlertTriangle size={15} /> {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <Row key={`w${i}`} issue={w} onJump={onJump} kind="warning" />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  issue,
  onJump,
  kind,
}: {
  issue: Issue;
  onJump?: (fieldId: string) => void;
  kind: 'error' | 'warning';
}) {
  const f = fieldsById[issue.fieldId];
  return (
    <li>
      <button
        onClick={() => onJump?.(issue.fieldId)}
        className={`block w-full rounded px-2 py-1 text-left hover:bg-surface ${
          kind === 'error' ? 'text-danger' : 'text-warning'
        }`}
      >
        <span className="font-medium">{f?.label ?? issue.fieldId}:</span>{' '}
        <span className="text-ink">{issue.message}</span>
        {f?.step && <span className="ml-1 text-xs text-muted">({f.step})</span>}
      </button>
    </li>
  );
}
