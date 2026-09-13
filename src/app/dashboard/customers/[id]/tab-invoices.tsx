import Link from 'next/link';
import { db } from '@/lib/db';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatKWD, toNumber } from '@/lib/utils';
import {
  ORDER_EVENT_SELECT,
  PAGE_CAP,
  PAGE_STEP,
  customerHref,
  invoiceEvent,
  newestFirst,
} from './profile-data';
import { EmptyPanel, MonthGroups, PanelLink } from './profile-parts';

export async function InvoicesTab({
  customerId,
  here,
  from,
  limit,
}: {
  customerId: string;
  here: string;
  from?: string;
  limit: number;
}) {
  const [money, total, orders] = await Promise.all([
    db.order.aggregate({
      where: { customerId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { total: true, paidAmount: true },
    }),
    db.order.count({ where: { customerId } }),
    db.order.findMany({
      where: { customerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: ORDER_EVENT_SELECT,
    }),
  ]);

  if (total === 0) return <EmptyPanel text="لا فواتير لهذا العميل بعد." />;

  const invoiced = toNumber(money._sum.total ?? 0);
  const paid = toNumber(money._sum.paidAmount ?? 0);
  const remaining = Math.max(0, Math.round((invoiced - paid) * 1000) / 1000);
  const events = orders.map((order) => invoiceEvent(order, here)).sort(newestFirst);
  const invoicesList = `/dashboard/invoices?customer=${customerId}`;

  return (
    <div className="space-y-4">
      <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] sm:grid-cols-3">
        <Figure label={`إجمالي الفواتير (${total})`} value={formatKWD(invoiced)} className="border-b sm:border-b-0 sm:border-e" />
        <Figure label="المدفوع" value={formatKWD(paid)} className="border-b sm:border-b-0 sm:border-e" />
        <Figure
          label="المتبقي على العميل"
          value={formatKWD(remaining)}
          danger={remaining > 0}
        />
      </div>

      <MonthGroups
        events={events}
        footer={
          total > events.length ? (
            limit < PAGE_CAP ? (
              <Link
                href={customerHref(customerId, { tab: 'invoices', limit: limit + PAGE_STEP, from })}
                scroll={false}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                عرض {Math.min(PAGE_STEP, total - events.length)} أخرى
              </Link>
            ) : (
              <PanelLink href={invoicesList}>كل الفواتير</PanelLink>
            )
          ) : (
            <PanelLink href={invoicesList}>فتح في صفحة الفواتير</PanelLink>
          )
        }
      />
    </div>
  );
}

function Figure({
  label,
  value,
  danger,
  className,
}: {
  label: string;
  value: string;
  danger?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('border-[var(--line)] p-4', danger && 'bg-danger/8', className)}>
      <p className={cn('text-[11px]', danger ? 'text-danger' : 'text-[var(--text-2)]')}>{label}</p>
      <p className={cn('tnum mt-1 text-[15px] font-bold', danger ? 'text-danger' : 'text-[var(--text-0)]')}>
        {value}
      </p>
    </div>
  );
}
