import { HelpCircle } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

/**
 * Small "Proposed rule" info icon. Placed next to any rule the spec marks
 * "(proposed rule)" — behaviour is implemented but still needs business
 * confirmation. Default copy can be overridden per use.
 */
export function ProposedRuleIcon({ text }: { text?: string }) {
  const content =
    text ??
    'Proposed rule: derived from today’s spreadsheet and definitions. Needs business confirmation.';
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label="Proposed rule"
            className="inline-flex items-center text-accent hover:text-accent/80"
          >
            <HelpCircle size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={5}
            className="z-50 max-w-[320px] rounded-md border border-accent/40 bg-white px-3 py-2 text-xs text-ink shadow-md"
          >
            <span className="mb-1 block font-medium text-accent">Proposed rule</span>
            {content}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
