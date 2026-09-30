import * as Tooltip from '@radix-ui/react-tooltip';
import { statusPillClass, statusDefinition } from '@/lib/lifecycle';
import { useAppStore } from '@/store/useAppStore';

export function StatusPill({ status, withTooltip = true }: { status: string; withTooltip?: boolean }) {
  const lifecycle = useAppStore((s) => s.lifecycle);
  const pill = (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(
        status,
      )}`}
    >
      {status}
    </span>
  );
  if (!withTooltip) return pill;
  const { definition } = statusDefinition(status, lifecycle);
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span tabIndex={0} className="cursor-help">
            {pill}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={5}
            className="z-50 max-w-[320px] rounded-md border border-border bg-white px-3 py-2 text-xs text-ink shadow-md"
          >
            {definition}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
