'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-8 text-center">
      <AlertTriangle className="size-12 text-warn" />
      <h2 className="mt-4 text-lg font-bold text-[var(--text-0)]">تعذّر عرض المحتوى</h2>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--text-1)]">
        حدث خطأ أثناء تحميل بيانات هذه الصفحة. يرجى المحاولة مرة أخرى أو العودة إلى لوحة التحكم.
      </p>
      {error.digest && (
        <p className="tnum mt-2 text-[11px] text-[var(--text-2)]" dir="ltr">
          {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>
          <RotateCw />
          حاول مرة أخرى
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: 'secondary' })}>
          لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
