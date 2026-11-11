import { useState } from 'react';

/** Compact multi-select filter. A value with commas (e.g. "Aug 26, Sep 26") is 1 value. */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded border px-2 py-1 text-xs hover:bg-surface ${value.length ? 'border-primary text-primary' : 'border-border'}`}
        aria-label={`${label} filter`}
      >
        {label}
        {value.length ? ` (${value.length})` : ': All'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-64 rounded border border-border bg-white p-1 shadow-lg">
            {options.length > 8 && (
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="mb-1 w-full rounded border border-border px-1.5 py-0.5 text-xs"
              />
            )}
            <div className="max-h-60 overflow-y-auto">
              {shown.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={value.includes(s)}
                    onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))}
                  />
                  {s}
                </label>
              ))}
            </div>
            {value.length > 0 && (
              <button onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-muted hover:bg-surface">
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
