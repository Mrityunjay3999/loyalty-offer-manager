import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/** The end-to-end demo script, verbatim from spec section 12. */
const DEMO_STEPS: string[] = [
  'Offers list. Show status chips and counts. Filter Country = CAN and Status = Completed - Data Final. Save the view as "CAN completed". Switch role to View-only: the saved view is per role; buttons are disabled.',
  'New offer (role: Offer Team Editor). Step 1: Offer ID 9001, Request Date today, Submitted By "Merch Team", P&P Contact "Victoria Burt", Start 11/02/2026, End 11/29/2026. Show Fiscal Week, Soft Lock Date and # of Days fill in. Try End before Start to show the error.',
  'Step 2: Offer Name 20261102_DOGTREATS_25_2500, Category MERCH (Sub-Category list filters to CONSUMABLES, HARDGOODS, SPECIALTY, ALL MERCH), Tier D (show tier definition), Country "USPR, CAN", Broad. Note that Canada fields appear in later steps.',
  'Step 3: Product, Every time, Transactional, Threshold "24 (25)", Per Transaction, Fixed points 2500 (Multiplier hidden because design will be Fixed Point).',
  'Step 5: Offer Design Fixed Point, click a "Common setup" to fill setup types. Enter Activation Descriptor and show the character count. Enter CAN descriptor "Using same code as USPR".',
  'Leave the page, come back: autosave kept everything. Step 7: enter forecast (activation/day 300 to 400, bonus rate 60% to 70%, spend $30 to $35) and show the calculated totals and redeemable dollars.',
  'Review: fix any required-field errors, Submit offer (Proposed). Show History.',
  'Switch role to Approver (TBC). Approvals queue shows the offer with its waiting time. Approve offer and forecast (Planning Phase). Point out the "SKUs to Promo Advisor within 7 days" reminder.',
  'Switch back to Editor. Step 8 checklist: Submission Form Made = Yes, Submitted to Kognitiv = Yes, then Mark submitted to loyalty platform (Approved / Build Phase). Try Mark audited and ready before Offer Card and Audit are done: guard message. Complete them, move to Audited / Ready to go, then Mark live.',
  'Open sample offer 20251229_BETTA_2500 (Completed - Data Final) and show step 9 results, calculated bonus rate and redeemable dollars. Open WBR and show forecast vs actual strings and colour codes.',
  'Open 20260323_TIERA_50_5000: Grouped Offer = Yes, show the Child promotions tab with 7 daily children and totals.',
  'Copy an offer; Cancel another with a reason; show it stays visible as Cancelled and disappears from the WBR and the data feed count.',
  'Switch to Admin. Reference data: add sub-category "PUPPY" under MERCH; go back to an offer and see it in the dropdown. Show the soft lock planner rows flagged as inconsistent.',
  'Data feed (Databricks): pick an offer, show the 169 metadata columns with values, run Simulate daily load, then Simulate failed load and show that nothing was blanked.',
  'Data dictionary: filter "Draft definitions" to show which tooltips the business must confirm.',
  'Phase 2 previews: show the disabled Forecast pre-fill and LOPD buttons, the Inspire submission form preview populated from the offer, and the Calendar view.',
];

export function HelpDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-lg flex-col border-l border-border bg-white shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="text-base font-semibold text-ink">
              Demo walkthrough script
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-5 pt-3 text-muted">
            Follow these steps to walk the business through the product end to end.
          </Dialog.Description>
          <ol className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {DEMO_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
