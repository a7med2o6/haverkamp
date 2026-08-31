import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-[var(--accent-ink)] hover:bg-accent-soft shadow-[0_6px_20px_-8px_rgba(94,184,255,0.6)]',
        secondary:
          'bg-[var(--glass-strong)] text-[var(--text-0)] border border-[var(--line)] hover:border-[var(--line-strong)]',
        outline:
          'border border-[var(--line-strong)] text-[var(--text-0)] hover:bg-[var(--glass)]',
        ghost: 'text-[var(--text-1)] hover:bg-[var(--glass-strong)] hover:text-[var(--text-0)]',
        danger: 'bg-danger text-[var(--danger-ink)] hover:brightness-110',
        success: 'bg-ok text-[var(--ok-ink)] hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';

export { buttonVariants };
