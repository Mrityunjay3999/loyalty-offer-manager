import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Show a comment/reason textarea. */
  withInput?: boolean;
  inputLabel?: string;
  inputRequired?: boolean;
  inputPlaceholder?: string;
  destructive?: boolean;
  onConfirm: (inputValue: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  withInput = false,
  inputLabel,
  inputRequired = false,
  inputPlaceholder,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const blocked = withInput && inputRequired && value.trim() === '';

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-5 shadow-lg focus:outline-none">
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="mt-2 text-muted">
              {description}
            </Dialog.Description>
          )}

          {withInput && (
            <div className="mt-4">
              {inputLabel && (
                <label className="mb-1 block font-medium text-ink">
                  {inputLabel}
                  {inputRequired && <span className="ml-0.5 text-danger">*</span>}
                </label>
              )}
              <textarea
                className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                placeholder={inputPlaceholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-md border border-border px-3 py-1.5 text-ink hover:bg-surface"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              className={`rounded-md px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                destructive ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90'
              }`}
              disabled={blocked}
              onClick={() => onConfirm(value.trim())}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
