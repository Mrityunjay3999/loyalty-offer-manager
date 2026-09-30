import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, X, AlertCircle, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ProposedRuleIcon } from '@/components/ProposedRuleIcon';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  MAIN_PATH,
  SIDE_STATES,
  statusOf,
  statusPillClass,
  allowedTransitions,
  canCancelFrom,
  type Transition,
  type GuardMissing,
} from '@/lib/lifecycle';
import type { OfferRecord } from '@/lib/types';

export interface ApplyArgs {
  to: string;
  comment: string;
  isApproval?: boolean;
  extra?: Partial<OfferRecord>;
  cancel?: boolean;
}

export function LifecycleBar({
  offer,
  onJump,
  onApply,
}: {
  offer: OfferRecord;
  onJump: (fieldId: string) => void;
  onApply: (args: ApplyArgs) => void;
}) {
  const role = useAppStore((s) => s.role);

  const status = statusOf(offer);

  const [guardMissing, setGuardMissing] = useState<GuardMissing[] | null>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const transitions = allowedTransitions(status, role);
  const showCancel = canCancelFrom(status, role);

  const currentMainIndex = MAIN_PATH.indexOf(status);
  const activeSide = SIDE_STATES.includes(status) ? status : null;

  function pick(t: Transition) {
    const guard = t.guard?.(offer) ?? { ok: true, missing: [] };
    if (!guard.ok) {
      setGuardMissing(guard.missing);
      return;
    }
    setSoftWarning(t.softGuard?.(offer) ?? null);
    setPending(t);
  }

  function applyTransition(comment: string) {
    if (!pending) return;
    onApply({
      to: pending.to,
      comment,
      isApproval: pending.isApproval,
      extra: pending.extra?.(offer),
    });
    setPending(null);
    setSoftWarning(null);
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-white p-3">
      <div className="flex items-start justify-between gap-4">
        {/* Stepper */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {MAIN_PATH.map((st, i) => {
            const done = currentMainIndex > -1 && i < currentMainIndex;
            const isCurrent = st === status;
            return (
              <div key={st} className="flex items-center">
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                    isCurrent
                      ? statusPillClass(st)
                      : done
                        ? 'bg-success/15 text-success'
                        : 'bg-surface text-muted'
                  }`}
                >
                  {st}
                </span>
                {i < MAIN_PATH.length - 1 && <span className="mx-0.5 text-muted">›</span>}
              </div>
            );
          })}
          {activeSide && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${statusPillClass(activeSide)}`}>
              {activeSide}
            </span>
          )}
        </div>

        {/* Change status */}
        <div className="flex shrink-0 items-center gap-1.5">
          <ProposedRuleIcon text="These status rules are derived from today's status definitions and need business confirmation." />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={transitions.length === 0 && !showCancel}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40"
              >
                Change status <ChevronDown size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="z-50 min-w-[220px] rounded-md border border-border bg-white py-1 shadow-lg">
                {transitions.length === 0 && !showCancel && (
                  <div className="px-3 py-2 text-xs text-muted">No status changes available for this role.</div>
                )}
                {transitions.map((t, i) => (
                  <DropdownMenu.Item
                    key={i}
                    onSelect={() => pick(t)}
                    className="cursor-pointer px-3 py-1.5 text-sm outline-none hover:bg-surface"
                  >
                    {t.label} <span className="text-muted">→ {t.to}</span>
                  </DropdownMenu.Item>
                ))}
                {showCancel && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item
                      onSelect={() => setCancelOpen(true)}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-danger outline-none hover:bg-surface"
                    >
                      <XCircle size={14} /> Cancel offer
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Guard-block dialog */}
      <Dialog.Root open={guardMissing !== null} onOpenChange={(o) => !o && setGuardMissing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-5 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-danger">
                <AlertCircle size={18} /> Can’t change status yet
              </Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Close" className="text-muted hover:text-ink">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <p className="mb-3 text-muted">Complete these first:</p>
            <ul className="space-y-1.5">
              {(guardMissing ?? []).map((m, i) => (
                <li key={i}>
                  {m.fieldId ? (
                    <button
                      onClick={() => {
                        onJump(m.fieldId!);
                        setGuardMissing(null);
                      }}
                      className="text-left text-primary hover:underline"
                    >
                      {m.message} →
                    </button>
                  ) : (
                    <span className="text-ink">{m.message}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setGuardMissing(null)} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Confirm transition (with optional/required comment) */}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? 'Change status'}
        description={
          (pending ? `Move this offer to “${pending.to}”. ` : '') +
          (softWarning ?? '')
        }
        confirmLabel={pending?.label ?? 'Confirm'}
        withInput
        inputLabel={pending?.commentRequired || softWarning ? 'Comment (required)' : 'Comment (optional)'}
        inputRequired={Boolean(pending?.commentRequired) || Boolean(softWarning)}
        onConfirm={applyTransition}
        onCancel={() => {
          setPending(null);
          setSoftWarning(null);
        }}
      />

      {/* Cancel */}
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel offer"
        description="The record is kept and shown as Cancelled."
        confirmLabel="Cancel offer"
        cancelLabel="Keep offer"
        destructive
        withInput
        inputLabel="Reason"
        inputRequired
        onConfirm={(reason) => {
          onApply({ to: 'Cancelled', comment: reason, cancel: true });
          setCancelOpen(false);
        }}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
