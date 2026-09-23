import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight, CircleDollarSign } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { withFrom } from '@/lib/back-link';
import { cn, formatDateOnly, formatKWD, todayDateOnly, toNumber } from '@/lib/utils';
import { loadRenewalBoard } from '../renewal-service';
import { RenewalBoard } from './renewals';

export const metadata: Metadata = { title: 'تحصيل اشتراكات الغسيل' };
export const dynamic = 'force-dynamic';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function fils(value: number) {
  return Math.round(value * 1000) / 1000;
}

function monthName(year: number, month: number) {
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function billingHref(year: number, month: number) {
  return `/dashboard/wash/billing?year=${year}&month=${month}`;
}

function adjacentMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export default async function WashBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await requirePermission('wash:read');
  const params = await searchParams;
  const today = todayDateOnly();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;

  /*
    قيم الرابط غير موثوقة: نقبل أرقاماً عشرية صريحة فقط، ثم نحصرها في
    مدى شاشة التحصيل حتى لا تتحول قيمة شاذة إلى تاريخ أو استعلام غير صالح.
  */
  const requestedYear = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : currentYear;
  const requestedMonth = params.month && /^\d{1,2}$/.test(params.month) ? Number(params.month) : currentMonth;
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, requestedYear));
  const month = Math.min(12, Math.max(1, requestedMonth));
  const label = monthName(year, month);
  const previous = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);
  const hasPrevious = previous.year >= MIN_YEAR;
  const hasNext = next.year <= MAX_YEAR;
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const canWrite = can(session.user.role, 'wash:write');

  const renewalRows = await loadRenewalBoard(today);

  const periods = await db.washSubscriptionPeriod.findMany({
    where: { year, month },
    orderBy: { createdAt: 'asc' },
    include: {
      subscription: {
        select: {
          area: true,
          customer: { select: { name: true } },
          vehicle: { select: { make: true, model: true, plateNo: true } },
        },
      },
      order: {
        select: { id: true, number: true, total: true, paidAmount: true },
      },
      _count: {
        select: { visits: { where: { status: 'PLANNED' } } },
      },
    },
  });

  const totals = periods.reduce(
    (sum, period) => {
      const due = toNumber(period.order?.total ?? period.priceSnapshot);
      const paid = toNumber(period.order?.paidAmount);
      return { due: fils(sum.due + due), paid: fils(sum.paid + paid) };
    },
    { due: 0, paid: 0 }
  );
  const remaining = fils(Math.max(0, totals.due - totals.paid));
  const collectionRate = totals.due > 0 ? Math.min(100, Math.round((totals.paid / totals.due) * 100)) : 0;

  return (
    <>
      <PageHeader
        title="تحصيل اشتراكات الغسيل"
        description={label}
        actions={
          <nav aria-label="التنقل بين أشهر التحصيل" className="flex items-center gap-1.5">
            <Link
              href={
                hasPrevious
                  ? billingHref(previous.year, previous.month)
                  : billingHref(year, month)
              }
              aria-disabled={!hasPrevious}
              tabIndex={hasPrevious ? undefined : -1}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'sm' }),
                !hasPrevious && 'pointer-events-none opacity-50'
              )}
            >
              <ChevronRight />
              السابق
            </Link>
            <Link
              href={billingHref(currentYear, currentMonth)}
              aria-current={isCurrentMonth ? 'page' : undefined}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              الشهر الحالي
            </Link>
            <Link
              href={hasNext ? billingHref(next.year, next.month) : billingHref(year, month)}
              aria-disabled={!hasNext}
              tabIndex={hasNext ? undefined : -1}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'sm' }),
                !hasNext && 'pointer-events-none opacity-50'
              )}
            >
              التالي
              <ChevronLeft />
            </Link>
          </nav>
        }
      />

      <div className="mb-6 space-y-5">
        <RenewalBoard rows={renewalRows} canWrite={canWrite} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="عدد المشتركين" value={periods.length} icon="Users" />
          <StatCard label="المستحق" value={formatKWD(totals.due)} icon="ReceiptText" tone="warn" />
          <StatCard
            label="المحصّل"
            value={formatKWD(totals.paid)}
            hint={`نسبة التحصيل ${collectionRate}%`}
            icon="BadgeCheck"
            tone="ok"
          />
          <StatCard
            label="المتبقّي"
            value={formatKWD(remaining)}
            icon="CircleAlert"
            tone={remaining > 0 ? 'danger' : 'neutral'}
          />
        </div>
      </div>

      <TableWrap>
        <Table className="min-w-[1080px]">
          <caption className="sr-only">تحصيل اشتراكات الغسيل لشهر {label}</caption>
          <thead>
            <tr>
              <Th>العميل</Th>
              <Th>السيارة</Th>
              <Th>المنطقة</Th>
              <Th>الفترة</Th>
              <Th>الفاتورة</Th>
              <Th>المستحق</Th>
              <Th>المحصّل</Th>
              <Th>الحالة</Th>
              <Th>عدد الغسلات المفتوحة</Th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <EmptyState
                title="لا فترات لهذا الشهر"
                description="العقود تتجدّد من قائمة التجديدات أعلاه."
                colSpan={9}
                icon={<CircleDollarSign className="size-6 text-[var(--text-2)]" />}
              />
            ) : (
              periods.map((period) => {
                const due = toNumber(period.order?.total ?? period.priceSnapshot);
                const paid = toNumber(period.order?.paidAmount);
                const paymentStatus =
                  paid >= due
                    ? { label: 'مدفوع', tone: 'ok' as const }
                    : paid > 0
                      ? { label: 'جزئي', tone: 'warn' as const }
                      : { label: 'غير مدفوع', tone: 'danger' as const };

                return (
                  <Tr key={period.id}>
                    <Td className="whitespace-nowrap font-medium text-[var(--text-0)]">
                      {period.subscription.customer.name}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {period.subscription.vehicle.make} {period.subscription.vehicle.model}
                      {period.subscription.vehicle.plateNo && (
                        <span className="tnum ms-2 text-[12px] text-[var(--text-2)]" dir="ltr">
                          {period.subscription.vehicle.plateNo}
                        </span>
                      )}
                    </Td>
                    <Td>{period.subscription.area}</Td>
                    <Td className="tnum whitespace-nowrap text-[13px] text-[var(--text-1)]">
                      {formatDateOnly(period.fromDate)} — {formatDateOnly(period.toDate)}
                    </Td>
                    <Td className="tnum whitespace-nowrap" dir="ltr">
                      {period.order ? (
                        <Link
                          href={withFrom(
                            `/dashboard/invoices/${period.order.id}`,
                            billingHref(year, month)
                          )}
                          className="font-medium text-accent hover:underline"
                        >
                          {period.order.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="tnum whitespace-nowrap font-semibold">{formatKWD(due)}</Td>
                    <Td className="tnum whitespace-nowrap">{formatKWD(paid)}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={paymentStatus.tone}>{paymentStatus.label}</Badge>
                    </Td>
                    <Td className="tnum text-center font-semibold">{period._count.visits}</Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}

