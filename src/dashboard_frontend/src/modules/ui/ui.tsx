import React from 'react';

/**
 * Shared UI module (design C3): one definition per component kind, so every
 * view renders the same look from the same code. Each component passes
 * every other prop through (Requirement 6.2) and stamps a `data-ui` locator
 * plus the attribute that drives its look.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

// --- Button ------------------------------------------------------------

// `outline-(--focus-ring)` is static (not conditional on focus) so the colour
// never changes value on focus; only `outline-style` does (via the global
// `:focus-visible` rule), which `transition-colors` does not animate. Without
// this, a focus read racing the `outline-color` fade (triggered because
// `transition-colors` lists it) can catch a low-contrast in-between colour.
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium outline-(--focus-ring) transition-colors disabled:opacity-(--disabled-opacity) disabled:cursor-not-allowed';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-(--accent-solid) text-(--text-on-accent) hover:bg-(--accent-solid-hover)',
  secondary: 'border border-(--border-strong) text-(--text-secondary) hover:bg-(--surface-hover)',
  danger: 'bg-(--danger-solid) text-(--text-on-accent) hover:bg-(--danger-solid-hover)',
  ghost: 'text-(--text-muted) hover:bg-(--surface-hover)',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Button({
  variant,
  size = 'md',
  className,
  type = 'button',
  ...rest
}: {
  variant: ButtonVariant;
  size?: ButtonSize;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      data-ui="button"
      data-variant={variant}
      data-size={size}
      className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...rest}
    />
  );
}

// --- Pill ----------------------------------------------------------------

const PILL_BASE = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

const PILL_TONE: Record<Tone, string> = {
  success: 'bg-(--tone-success-bg) text-(--tone-success-fg)',
  warning: 'bg-(--tone-warning-bg) text-(--tone-warning-fg)',
  danger: 'bg-(--tone-danger-bg) text-(--tone-danger-fg)',
  info: 'bg-(--tone-info-bg) text-(--tone-info-fg)',
  accent: 'bg-(--tone-accent-bg) text-(--tone-accent-fg)',
  neutral: 'bg-(--tone-neutral-bg) text-(--tone-neutral-fg)',
};

export function Pill({
  tone,
  className,
  ...rest
}: { tone: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-ui="pill"
      data-tone={tone}
      className={cx(PILL_BASE, PILL_TONE[tone], className)}
      {...rest}
    />
  );
}

// --- TextInput -------------------------------------------------------------

const TEXT_INPUT_CLASS =
  'w-full rounded-md border border-(--border-default) bg-(--surface-inset) px-3 py-1.5 text-sm text-(--text-primary)';

export function TextInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input data-ui="text-input" className={cx(TEXT_INPUT_CLASS, className)} {...rest} />
  );
}

// --- Tab ---------------------------------------------------------------

const TAB_BASE = 'rounded-md px-3 py-1.5 text-sm font-medium outline-(--focus-ring) transition-colors';
const TAB_SELECTED = 'bg-(--surface-selected) text-(--text-primary)';
const TAB_UNSELECTED = 'text-(--text-secondary) hover:bg-(--surface-hover)';

export function Tab({
  selected,
  className,
  type = 'button',
  ...rest
}: {
  selected: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      data-ui="tab"
      data-selected={selected}
      className={cx(TAB_BASE, selected ? TAB_SELECTED : TAB_UNSELECTED, className)}
      {...rest}
    />
  );
}

// --- Class constants (design C3) ----------------------------------------

export const ui = {
  panel: 'rounded-lg border border-(--border-default) bg-(--surface-panel)',
  popover: 'rounded-lg border border-(--border-default) bg-(--surface-panel) p-3 shadow-(--shadow-overlay)',
  dialog: 'w-full max-w-sm rounded-lg border border-(--border-default) bg-(--surface-panel) p-6 shadow-(--shadow-overlay)',
  scrim: 'fixed inset-0 z-50 bg-(--scrim)',
  drawer: 'bg-(--surface-panel) shadow-(--shadow-overlay)',
  tablist: 'flex gap-1 border-b border-(--border-default)',
  table: 'w-full text-sm',
  th: 'px-2 py-1.5 text-left text-xs font-semibold text-(--text-muted)',
  td: 'px-2 py-1.5 text-(--text-primary)',
  logView: 'rounded-md bg-(--surface-inset) p-3 font-mono text-xs text-(--text-primary) whitespace-pre-wrap',
  groupHeader: 'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm font-semibold text-(--text-secondary) hover:text-(--text-primary)',
  // No `transition-colors`: `ThemeProvider` toggles the `dark` class in an
  // effect after first paint, so a colour transition here would animate
  // from the light-painted value to the dark one on first dark-mode load,
  // which a focus read in that window (nav rows are the first tab stop)
  // would catch mid-fade.
  navRow(active: boolean): string {
    return cx(
      'flex items-center justify-between rounded-md px-3 py-2 text-sm outline-(--focus-ring)',
      active
        ? 'bg-(--surface-selected) text-(--text-primary) font-medium'
        : 'text-(--text-secondary) hover:bg-(--surface-hover)',
    );
  },
};
