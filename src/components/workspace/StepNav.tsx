import { Check, Circle, CircleDot, AlertCircle } from 'lucide-react';

export type StepStatus = 'notStarted' | 'inProgress' | 'complete' | 'errors';

export interface StepInfo {
  name: string;
  label: string;
  status: StepStatus;
  errorCount: number;
}

export function StepNav({
  steps,
  current,
  onSelect,
}: {
  steps: StepInfo[];
  current: string;
  onSelect: (name: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {steps.map((s, i) => {
        const active = s.name === current;
        return (
          <button
            key={s.name}
            onClick={() => onSelect(s.name)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
              active ? 'bg-primary/10 font-medium text-primary' : 'text-ink hover:bg-surface'
            }`}
          >
            <StepIcon status={s.status} index={i} />
            <span className="flex-1 text-sm">{s.label}</span>
            {s.status === 'errors' && (
              <span className="rounded-full bg-danger px-1.5 text-xs font-medium text-white">
                {s.errorCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function StepIcon({ status, index }: { status: StepStatus; index: number }) {
  if (status === 'complete') return <Check size={16} className="shrink-0 text-success" />;
  if (status === 'errors') return <AlertCircle size={16} className="shrink-0 text-danger" />;
  if (status === 'inProgress')
    return <CircleDot size={16} className="shrink-0 text-accent" />;
  return (
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <Circle size={16} className="text-muted" />
      <span className="absolute text-[9px] text-muted">{index + 1}</span>
    </span>
  );
}
