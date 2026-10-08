import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/** The v2 end-to-end demo script (prompt section 7). */
const DEMO_STEPS: string[] = [
  'Role = Offer Team Editor. Offers (Edit) → New offer. The header shows Offer ID "Assigned on first save" (no typed ID).',
  'Step 1: enter Offer Request Date, Submitted By, P&P Contact, Start and End dates. There is no Offer ID input and no Offer due date. Save draft with missing fields: it saves and shows "Saved as draft. Fix n item(s) before you can submit." The Offer ID appears with the Auto-generated tag.',
  'Steps 2–6: fill category, sub-category, tiering, country, Broad vs Targeted, Offer Design = Multiplier, Multiplier = 3X and the rest.',
  'Step 7: enter Activation by day Low 1,000 / High 1,500, Bonus rate 8% / 12%, Avg spend $40 / $55. The right panel and the 6 calculated fields fill in from Results & Forecast. Forecast needed flips from Yes to No.',
  'Submit offer. Status = Proposed. The header chip reads "Waiting for next load".',
  'Open Results & Forecast: the offer is there (no reference number), forecast filled, results blank. Open the drawer and check an "fx" breakdown.',
  'Role = Admin. Data feed → Load log → Simulate nightly load. The chip becomes "Loaded". Record preview shows values in both tables; Table view shows the row; Column mapping shows Databricks names.',
  'Role = Editor. Results & Forecast → drawer → Enter results: Audience size, Activations, Bonused members, Bonus Pts Issued. Results, WBR strings and Colour code fill in. Step 9 on the offer shows the same values.',
  'Role = View-only. Lands on Offer View. Set a filter and freeze 3 columns. Switch to Editor: the Editor’s view is unchanged. No edit controls; Cancelled and Draft offers are not listed.',
  'Role = Admin. Move the offer to Completed - Data Final: it is locked for everyone. Cancel a different offer with a reason: it disappears from Offer View, Results & Forecast and the feed.',
  'Role = Admin. Reference data → P&P Contact → Add value. It appears in the Step 1 dropdown immediately. There is no control to add a field.',
  'Role = Editor. Select 2 offers → Submission form → MFP → Download: 2 files, 1 per offer.',
  'Submit a new offer, then click "View on calendar" in its header. The calendar opens on its start month with the offer highlighted.',
  'On the calendar, switch between Month, Week and Timeline. Read the summary strip, then click the busiest day to see every offer running that day.',
  'Sign in as Sample Admin → Users & roles → Roles & permissions. Untick a permission (e.g. Enter results for Offer Team Editor). Sign in as Sample Editor 1 and open Results & Forecast: that button is now gone.',
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
