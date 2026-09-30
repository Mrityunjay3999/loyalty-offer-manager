import * as Tooltip from '@radix-ui/react-tooltip';

/**
 * "Phase 2" badge. Anything marked Phase 2 in the spec must be visible so the
 * business sees the roadmap, but stays non-functional. Default copy matches the
 * common tooltip; pass `note` to override.
 */
export function PhaseBadge({ note }: { note?: string }) {
  const text = note ?? 'Planned for Phase 2, not part of this MVP prototype.';
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-help items-center rounded-full border border-accent bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
          >
            Phase 2
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={5}
            className="z-50 max-w-[300px] rounded-md border border-border bg-white px-3 py-2 text-xs text-ink shadow-md"
          >
            {text}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
