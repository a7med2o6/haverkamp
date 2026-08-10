'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // نقل التركيز داخل النافذة لإمكانية الوصول
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative my-auto w-full rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] shadow-2xl outline-none',
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-[var(--text-0)]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12px] text-[var(--text-2)]">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="-me-1 rounded-full p-1.5 text-[var(--text-2)] hover:bg-[var(--glass-strong)] hover:text-[var(--text-0)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
