import { Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { FieldDef } from '@/lib/types';
import { reference } from '@/lib/dataLoaders';

/**
 * Info icon shown after every field label (spec 11.3).
 * Content: tooltip text; then grey lines for "Today: Excel column X 'header'"
 * and "Source: ...". DRAFT sources get an amber "Draft definition" tag. Select
 * fields show the option count; Offer tiering shows the selected tier's
 * definition; computed fields show the formula.
 */
export function FieldTooltip({
  field,
  optionCount,
  selectedValue,
}: {
  field: FieldDef;
  optionCount?: number;
  selectedValue?: unknown;
}) {
  const isDraft = field.tooltipSource?.startsWith('DRAFT');

  const tierDef =
    field.id === 'offerTiering' && selectedValue
      ? reference.tieringDefinitions.find((t) => t.tier === selectedValue)
      : undefined;

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={`About ${field.label}`}
            className="inline-flex align-middle text-muted hover:text-primary focus:text-primary focus:outline-none"
          >
            <Info size={13} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="start"
            sideOffset={5}
            className="z-50 max-w-[360px] rounded-md border border-border bg-white p-3 text-xs leading-relaxed text-ink shadow-md"
          >
            <p className="text-ink">{field.tooltip}</p>

            {isDraft && (
              <span className="mt-1.5 inline-block rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                Draft definition
              </span>
            )}

            {field.computed && (
              <p className="mt-1.5 text-muted">
                <span className="font-medium">Formula:</span> {field.computed}
              </p>
            )}

            {typeof optionCount === 'number' && optionCount > 0 && (
              <p className="mt-1.5 text-muted">{optionCount} options</p>
            )}

            {tierDef && (
              <p className="mt-1.5 text-muted">
                <span className="font-medium">Tier {tierDef.tier}:</span>{' '}
                {tierDef.description}
                {tierDef.example ? ` (e.g. ${tierDef.example})` : ''}
              </p>
            )}

            <div className="mt-2 space-y-0.5 border-t border-border pt-1.5 text-[11px] text-muted">
              <p>
                Today: Excel column {field.excelColumn} “{field.excelHeader}”
              </p>
              <p>Source: {field.tooltipSource}</p>
            </div>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
