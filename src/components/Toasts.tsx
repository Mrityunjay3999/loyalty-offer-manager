import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useToasts, type ToastKind } from '@/store/useToasts';

const config: Record<
  ToastKind,
  { icon: typeof Info; className: string }
> = {
  info: { icon: Info, className: 'border-primary/40 bg-white text-primary' },
  success: { icon: CheckCircle2, className: 'border-success/40 bg-white text-success' },
  warning: { icon: AlertTriangle, className: 'border-warning/40 bg-white text-warning' },
  error: { icon: XCircle, className: 'border-danger/40 bg-white text-danger' },
};

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, className } = config[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-sm ${className}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-ink">{t.message}</span>
            <button
              aria-label="Dismiss"
              className="shrink-0 text-muted hover:text-ink"
              onClick={() => dismiss(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
