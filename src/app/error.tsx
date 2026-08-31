'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * حدّ الأخطاء العام.
 * لم يكن في المشروع أيّ حدّ، فأي خطأ خادم — كمَعلمة تصفية غير صالحة —
 * يُخرج للمستخدم شاشة Next الخام بالإنجليزية. هذه تُبقيه داخل النظام
 * وتمنحه طريق رجوع.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--surface-0)] px-4">
      <div className="w-full max-w-sm text-center">
        <AlertTriangle className="mx-auto size-10 text-warn" />
        <h1 className="mt-4 text-lg font-bold text-[var(--text-0)]">
          حدث خطأ غير متوقّع
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-1)]">
          تعذّر عرض هذه الصفحة. حاول مرة أخرى، وإن تكرّر الأمر فأبلغ الدعم
          {error.digest ? ' بالرمز أدناه' : ''}.
        </p>
        {error.digest && (
          <p className="tnum mt-2 text-[11px] text-[var(--text-2)]" dir="ltr">
            {error.digest}
          </p>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>
            <RotateCw />
            إعادة المحاولة
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--line-strong)] px-4 text-sm font-semibold text-[var(--text-0)] hover:bg-[var(--glass)]"
          >
            الرجوع إلى اللوحة
          </Link>
        </div>
      </div>
    </main>
  );
}
