import Link from 'next/link';
import { X } from 'lucide-react';
import { db } from '@/lib/db';

/**
 * شريط يوضّح أن القائمة مقصورة على عميل واحد، مع رابط لإزالة التصفية.
 * بدونه يظن الموظف أن باقي السجلات اختفت.
 */
export async function CustomerFilterBar({
  customerId,
  clearHref,
}: {
  customerId: string;
  clearHref: string;
}) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { name: true, code: true },
  });

  if (!customer) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-[13px]">
      <span className="text-[var(--text-2)]">مقصورة على العميل</span>
      <Link
        href={`/dashboard/customers/${customerId}`}
        className="font-semibold text-accent-soft hover:underline"
      >
        {customer.name}
      </Link>
      <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
        {customer.code}
      </span>
      <Link
        href={clearHref}
        className="ms-auto inline-flex items-center gap-1 text-[12px] text-[var(--text-2)] hover:text-[var(--text-0)]"
      >
        <X className="size-3.5" />
        إزالة التصفية
      </Link>
    </div>
  );
}
