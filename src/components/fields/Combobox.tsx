import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * Searchable combobox for large lists (brands: 2,758; transactionTypes: 454) and
 * for P&P Contact (which also allows free text). Shows up to 50 matches.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Search…',
  allowFreeText = false,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  allowFreeText?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;
    return list.slice(0, 50);
  }, [query, options]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-left disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
        >
          <span className={value ? 'text-ink' : 'text-muted'}>
            {value || placeholder}
          </span>
          <ChevronDown size={15} className="shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-border bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search size={14} className="text-muted" />
            <input
              autoFocus
              className="w-full text-ink focus:outline-none"
              placeholder={allowFreeText ? 'Type or search…' : 'Search…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && allowFreeText && query.trim()) {
                  choose(query.trim());
                }
              }}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {allowFreeText && query.trim() && !options.includes(query.trim()) && (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface"
                  onClick={() => choose(query.trim())}
                >
                  Use “{query.trim()}”
                  <span className="ml-auto text-xs text-muted">free text</span>
                </button>
              </li>
            )}
            {matches.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface"
                  onClick={() => choose(o)}
                >
                  {value === o && <Check size={14} className="text-primary" />}
                  <span className={value === o ? 'font-medium text-primary' : ''}>
                    {o}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-2 text-muted">No matches.</li>
            )}
            {options.length > 50 && (
              <li className="border-t border-border px-3 py-1.5 text-xs text-muted">
                Showing first 50 of {options.length.toLocaleString()}. Keep typing to
                narrow.
              </li>
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
