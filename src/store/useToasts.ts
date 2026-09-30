import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
}

let n = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    n += 1;
    const id = `toast-${Date.now()}-${n}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    // Auto-dismiss after 4s.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Non-hook helper so libs/actions can raise a toast. */
export const toast = {
  info: (m: string) => useToasts.getState().push(m, 'info'),
  success: (m: string) => useToasts.getState().push(m, 'success'),
  warning: (m: string) => useToasts.getState().push(m, 'warning'),
  error: (m: string) => useToasts.getState().push(m, 'error'),
};
