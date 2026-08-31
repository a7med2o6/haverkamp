import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--glass-strong)] text-[var(--text-1)] border border-[var(--line)]',
        accent: 'bg-[var(--mark-accent)]/18 text-accent',
        ok: 'bg-[var(--mark-ok)]/18 text-ok',
        warn: 'bg-[var(--mark-warn)]/18 text-warn',
        danger: 'bg-[var(--mark-danger)]/18 text-danger',
        info: 'bg-info/18 text-info',
        violet: 'bg-[var(--mark-violet)]/18 text-violet',
        /* حالة منتهية بلا لون قضية — رمادي مُعلَّم لا رمادي خافت */
        muted:
          'bg-[var(--mark-muted)]/18 text-[var(--text-1)] border border-[var(--line-strong)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
