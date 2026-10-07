import React from 'react';

/**
 * The list-plus-panel page frame. The panel sits to the right of the list from
 * the Tailwind `xl` breakpoint (80rem, 1280px at the default root size) and
 * stacks below it otherwise (design C9, D14). Both columns carry `min-w-0` so a
 * wide child cannot push the page wider than the viewport.
 */
export function PageLayout({
  list,
  panel,
}: {
  list: React.ReactNode;
  panel?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1" data-testid="page-list">
        {list}
      </div>
      {panel !== undefined && (
        <aside className="min-w-0 xl:w-96 xl:flex-shrink-0" data-testid="page-panel">
          {panel}
        </aside>
      )}
    </div>
  );
}

/** Wrap a wide table so it scrolls inside its own box rather than the page. */
export function ScrollBox({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}
