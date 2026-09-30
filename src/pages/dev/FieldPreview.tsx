// Internal preview to verify the field system (Milestone 3). Not linked in the
// sidebar; reachable at /dev/fields. Renders one field per control type with
// real field definitions and the cascading Category -> Sub-Category.
import { useState } from 'react';
import { FieldRenderer } from '@/components/fields/FieldRenderer';
import { fieldsById, dropdowns, reference } from '@/lib/dataLoaders';
import { optionsForField } from '@/lib/options';
import type { OfferValue } from '@/lib/types';

const PREVIEW_IDS = [
  'submittedBy', // text
  'offerShortDescription', // textarea
  'fixedPoints', // number
  'avgSpendPerTxnLow', // currency
  'bonusRateLow', // percent
  'startDate', // date
  'earlyActivationDate', // dateOrNA (+ N/A toggle)
  'offerCardLinkUS', // url
  'country', // select
  'groupedOffer', // yesno
  'ppContact', // combobox (free text)
  'primaryBrand', // combobox (2,758 brands)
  'activationDescriptor', // text with char count
  'numberOfDays', // computed
];

export function FieldPreview() {
  const [values, setValues] = useState<Record<string, OfferValue>>({
    category: 'MERCH',
  });

  function set(id: string, v: OfferValue) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Field system preview (dev)</h1>
      <p className="mb-6 text-muted">
        One field per control type. Cascading Category → Sub-Category at the bottom.
      </p>

      <div className="space-y-5">
        {PREVIEW_IDS.map((id) => {
          const field = fieldsById[id];
          if (!field) return null;
          const opts = optionsForField(
            id,
            field.optionsKey,
            dropdowns,
            reference.categorySubCategory,
          );
          return (
            <FieldRenderer
              key={id}
              field={field}
              value={values[id]}
              onChange={(v) => set(id, v)}
              options={opts}
              computedValue={id === 'numberOfDays' ? 28 : undefined}
            />
          );
        })}

        <div className="rounded-lg border border-border bg-white p-4">
          <h2 className="mb-3 font-semibold">Cascading Category → Sub-Category</h2>
          <div className="space-y-4">
            <FieldRenderer
              field={fieldsById.category}
              value={values.category}
              onChange={(v) => {
                set('category', v);
                set('subCategory', ''); // reset child when parent changes
              }}
              options={optionsForField(
                'category',
                fieldsById.category.optionsKey,
                dropdowns,
                reference.categorySubCategory,
              )}
            />
            <FieldRenderer
              field={fieldsById.subCategory}
              value={values.subCategory}
              onChange={(v) => set('subCategory', v)}
              options={optionsForField(
                'subCategory',
                fieldsById.subCategory.optionsKey,
                dropdowns,
                reference.categorySubCategory,
                values.category,
              )}
            />
            <p className="text-xs text-muted">
              Sub-Category list filters to the chosen Category (MERCH →
              CONSUMABLES, HARDGOODS, SPECIALTY, ALL MERCH).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
