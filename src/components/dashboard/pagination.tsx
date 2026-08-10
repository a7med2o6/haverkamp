'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_SIZE } from '@/lib/constants';

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
        <span className="tnum px-2 text-[12px] text-[var(--text-1)]">
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
