import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--glass-strong)] text-[var(--text-1)] border border-[var(--line)]',
        accent: 'bg-accent/15 text-accent-soft',
        ok: 'bg-ok/15 text-ok',
        warn: 'bg-warn/15 text-warn',
        danger: 'bg-danger/15 text-danger',
        info: 'bg-info/15 text-info',
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
