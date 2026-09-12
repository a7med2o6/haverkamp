import * as React from 'react';
import { cn } from '@/lib/utils';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-skeleton rounded-[var(--radius-sm)] bg-[var(--surface-2)]',
        className
      )}
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 8, cols }: { rows?: number; cols: number }) {
  return (
    <div role="status" aria-label="جارٍ التحميل" aria-busy="true">
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <Th key={i}>
                  <Skeleton className="h-4 w-full max-w-[100px]" />
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <Tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <Td key={c}>
                    <Skeleton className="h-4 w-full" />
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
