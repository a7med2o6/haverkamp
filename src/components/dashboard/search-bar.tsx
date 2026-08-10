'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** حقل بحث يكتب في الـ query string مع تأخير بسيط (debounce) */
export function SearchBar({
  placeholder = 'بحث…',
  paramName = 'q',
  className,
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(params.get(paramName) ?? '');

  useEffect(() => {
    const current = params.get(paramName) ?? '';
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(paramName, value);
      else next.delete(paramName);
      next.delete('page');
      startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--text-2)]" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] ps-9 pe-9 text-sm text-[var(--text-0)] placeholder:text-[var(--text-2)] focus:border-accent focus:outline-none"
      />
      <div className="absolute inset-y-0 end-3 flex items-center">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-[var(--text-2)]" />
        ) : value ? (
          <button
            onClick={() => setValue('')}
            aria-label="مسح البحث"
            className="text-[var(--text-2)] hover:text-[var(--text-0)]"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
