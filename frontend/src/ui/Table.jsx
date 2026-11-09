import React from 'react';
import { cn } from './cn';
import { DataState } from './Feedback';

/**
 * Data table with consistent styling plus loading/empty/error states.
 * columns: [{ key, header, align?: 'left'|'right'|'center', render?: (row) => node, className? }]
 * <Table caption="Scan history" columns={cols} rows={rows} rowKey="id" loading={l} error={e} onRetry={reload} />
 */
export function Table({
  columns, rows = [], rowKey = 'id', caption, loading, error, onRetry, emptyTitle = 'No records', emptyDescription,
  onRowClick, dense = false, className,
}) {
  const state = (loading || error || rows.length === 0) && (
    <div className="h-56">
      <DataState loading={loading} error={error} empty={!rows.length} onRetry={onRetry} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
    </div>
  );

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-line bg-surface', className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-4 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap border-b border-line',
                  dense ? 'py-2' : 'py-3',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        {!state && (
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={typeof rowKey === 'function' ? rowKey(row, i) : row[rowKey] ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'border-b border-line last:border-0 transition-colors duration-fast',
                  onRowClick && 'cursor-pointer hover:bg-surface-2',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 text-fg',
                      dense ? 'py-2' : 'py-3',
                      c.align === 'right' ? 'text-right tabular' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.className,
                    )}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {state}
    </div>
  );
}
