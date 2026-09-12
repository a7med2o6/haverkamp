import * as React from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({ className, maxHeight, style, ...props }: React.ComponentProps<'div'> & { maxHeight?: string }) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]',
        maxHeight && 'overflow-y-auto',
        className
      )}
      style={maxHeight ? { maxHeight, ...style } : style}
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
        'sticky top-0 z-10 bg-[var(--surface-2)] px-4 py-3 text-start text-[12px] font-semibold text-[var(--text-2)] whitespace-nowrap shadow-[inset_0_-1px_0_var(--line)]',
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
  return <tr className={cn('transition-colors hover:bg-[var(--glass)] focus-within:bg-[var(--glass)]', className)} {...props} />;
}

export function EmptyState({
  title = 'لا توجد بيانات',
  description,
  action,
  colSpan = 99,
  icon,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  colSpan?: number;
  icon?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        {icon && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-2)]">
            {icon}
          </div>
        )}
        <p className="text-sm font-semibold text-[var(--text-1)]">{title}</p>
        {description && <p className="mt-1 text-[13px] text-[var(--text-2)]">{description}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  );
}
