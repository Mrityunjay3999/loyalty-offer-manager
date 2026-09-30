import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center">
      {Icon && <Icon size={28} className="mb-3 text-muted" />}
      <div className="font-medium text-ink">{title}</div>
      {message && <div className="mt-1 max-w-md text-muted">{message}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder used by pages that arrive in a later milestone. */
export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <EmptyState
      title={title}
      message={`This screen is part of ${milestone}. The navigation, layout and permissions around it are in place now.`}
    />
  );
}
