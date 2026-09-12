'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_SIZE } from '@/lib/constants';

function getPageNumbers(current: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }
  if (current >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', current - 1, current, current + 1, '...', totalPages];
}

export function Pagination({ page, total, pageSize = PAGE_SIZE }: { page: number; total: number; pageSize?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  function go(next: number) {
    const p = new URLSearchParams(params.toString());
    p.set('page', String(next));
    router.replace(`${pathname}?${p}`, { scroll: false });
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, pages);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="tnum text-[12px] text-[var(--text-2)]">
        عرض {from}–{to} من {total}
      </p>
      <div className="flex items-center gap-1.5">
        {/* في RTL: "السابق" يشير لليمين */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight />
          السابق
        </Button>

        <div className="hidden items-center gap-1.5 sm:flex">
          {pageNumbers.map((p, i) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${i}`} className="px-1 text-[var(--text-2)]">
                  &hellip;
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <Button
                key={p}
                variant={isCurrent ? 'primary' : 'ghost'}
                size="sm"
                className="tnum w-8 p-0"
                onClick={() => go(p as number)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`الصفحة ${p}`}
              >
                {p}
              </Button>
            );
          })}
        </div>

        {/* الشاشة الضيّقة لا تتسع للأرقام — يبقى العدّاد وحده */}
        <span className="tnum px-2 text-[12px] text-[var(--text-1)] sm:hidden">
          {page} / {pages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => go(page + 1)}
          disabled={page >= pages}
          aria-label="الصفحة التالية"
        >
          التالي
          <ChevronLeft />
        </Button>
      </div>
    </div>
  );
}
