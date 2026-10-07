import React, { useEffect, useRef, useState } from 'react';

/** Rows shown per page; the pager appears only above this count (design C9). */
export const ROWS_PER_PAGE = 20;

// --- Group: a collapsible section whose state persists per name ------------

function groupKey(name: string): string {
  return `shell.groups.${name}`;
}

export function Group({
  name,
  title,
  count,
  defaultCollapsed = false,
  children,
}: {
  name: string;
  title: React.ReactNode;
  count?: number;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(groupKey(name));
      return saved === null ? defaultCollapsed : saved === '1';
    } catch {
      return defaultCollapsed;
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(groupKey(name), next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <section className="mb-4" data-testid={`group-${name}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <span className="inline-block w-3 text-[var(--text-muted)]">{collapsed ? '▸' : '▾'}</span>
        <span>{title}</span>
        {typeof count === 'number' && (
          <span className="ml-1 rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{count}</span>
        )}
      </button>
      {!collapsed && <div className="mt-1">{children}</div>}
    </section>
  );
}

// --- Chips: toggle filter chips --------------------------------------------

export interface Chip {
  value: string;
  label: string;
  count?: number;
}

export function Chips({
  chips,
  active,
  onToggle,
}: {
  chips: Chip[];
  active: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const on = active.includes(chip.value);
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => onToggle(chip.value)}
            data-testid={`chip-${chip.value}`}
            aria-pressed={on}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              on
                ? 'border-transparent bg-[var(--accent-primary,#2563eb)] text-white'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {chip.label}
            {typeof chip.count === 'number' && <span className="ml-1 opacity-70">{chip.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// --- SearchBox: debounced text filter --------------------------------------

export function SearchBox({
  onChange,
  placeholder,
  debounceMs = 200,
}: {
  onChange: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [text, setText] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const id = setTimeout(() => onChangeRef.current(text), debounceMs);
    return () => clearTimeout(id);
  }, [text, debounceMs]);

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      data-testid="search-box"
      className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary,#2563eb)]"
    />
  );
}

// --- Pager: shown only above ROWS_PER_PAGE rows ----------------------------

export function Pager({
  total,
  page,
  onPage,
  pageSize = ROWS_PER_PAGE,
}: {
  total: number;
  page: number;
  onPage: (page: number) => void;
  pageSize?: number;
}) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  const clamp = (p: number) => Math.max(0, Math.min(pages - 1, p));

  return (
    <div className="flex items-center justify-end gap-2 px-2 py-2 text-xs text-[var(--text-muted)]" data-testid="pager">
      <button
        type="button"
        onClick={() => onPage(clamp(page - 1))}
        disabled={page <= 0}
        className="rounded border border-[var(--border-default)] px-2 py-0.5 disabled:opacity-40 hover:bg-[var(--surface-hover)]"
      >
        Prev
      </button>
      <span>{page + 1} / {pages}</span>
      <button
        type="button"
        onClick={() => onPage(clamp(page + 1))}
        disabled={page >= pages - 1}
        className="rounded border border-[var(--border-default)] px-2 py-0.5 disabled:opacity-40 hover:bg-[var(--surface-hover)]"
      >
        Next
      </button>
    </div>
  );
}

// --- Row: a single list row of height var(--row-h) that truncates ----------

export function Row({
  children,
  onClick,
  selected,
  testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  testId?: string;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      data-testid={testId}
      style={{ height: 'var(--row-h)' }}
      className={`flex items-center gap-3 overflow-hidden truncate whitespace-nowrap rounded px-2 text-sm ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`}
    >
      {children}
    </div>
  );
}
