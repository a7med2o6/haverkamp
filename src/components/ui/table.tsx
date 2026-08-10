import * as React from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]',
        className
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-max border-collapse text-sm', className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-start text-[12px] font-semibold text-[var(--text-2)] whitespace-nowrap',
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('border-b border-[var(--line)] px-4 py-3 text-[var(--text-1)] align-middle', className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('transition-colors hover:bg-[var(--glass)]', className)} {...props} />;
}

export function EmptyState({
  title = 'لا توجد بيانات',
  description,
  action,
  colSpan = 99,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <p className="text-sm font-semibold text-[var(--text-1)]">{title}</p>
        {description && <p className="mt-1 text-[13px] text-[var(--text-2)]">{description}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  );
}
