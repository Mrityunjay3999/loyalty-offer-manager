import type { ReactNode } from 'react';

export function PageHeader({
  title,
  count,
  children,
  right,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          {title}
          {count !== undefined && (
            <span className="text-base font-normal text-muted">({count})</span>
          )}
          {children}
        </h1>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
