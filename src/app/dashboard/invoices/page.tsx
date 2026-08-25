import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { CustomerFilterBar } from '@/components/dashboard/customer-filter';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS, PAYMENT_METHOD } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { formatDateTime, formatKWD, toNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'الفواتير' };
export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; customer?: string }>;
}) {
  await requirePermission('pos:read');
  const { q, page: pageParam, status, customer } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: 'insensitive' as const } },
            { customer: { name: { contains: q, mode: 'insensitive' as const } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : {}),
    ...(status && status in ORDER_STATUS
      ? { status: status as keyof typeof ORDER_STATUS }
      : {}),
    // تصفية بعميل واحد — من رابط «عرض الكل» في ملف العميل
    ...(customer ? { customerId: customer } : {}),
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [orders, total, todayAgg, unpaidAgg] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        cashier: { select: { name: true } },
        payments: { select: { method: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { createdAt: { gte: todayStart }, status: { in: ['COMPLETED', 'PARTIAL'] } },
    }),
    db.order.findMany({
      where: { status: { in: ['PARTIAL', 'DRAFT'] } },
      select: { total: true, paidAmount: true },
    }),
  ]);

  const outstanding = unpaidAgg.reduce(
    (sum, o) => sum + (toNumber(o.total) - toNumber(o.paidAmount)),
    0
  );

  return (
    <>
      <PageHeader title="الفواتير" description={`${total} فاتورة`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="مبيعات اليوم"
          value={formatKWD(toNumber(todayAgg._sum.total))}
          hint={`${todayAgg._count} فاتورة`}
          icon="Wallet"
          tone="ok"
        />
        <StatCard
          label="مبالغ مستحقة"
          value={formatKWD(outstanding)}
          icon="CircleAlert"
          tone={outstanding > 0 ? 'warn' : 'neutral'}
          href="/dashboard/invoices?status=PARTIAL"
        />
        <StatCard label="إجمالي الفواتير" value={total} icon="Receipt" />
      </div>

      {customer && (
        <CustomerFilterBar
          customerId={customer}
          clearHref={`/dashboard/invoices${status ? `?status=${status}` : ''}`}
        />
      )}

      <SearchBar placeholder="ابحث برقم الفاتورة أو اسم العميل…" className="mb-4 max-w-md" />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>رقم الفاتورة</Th>
              <Th>العميل</Th>
              <Th>الأصناف</Th>
              <Th>الإجمالي</Th>
              <Th>المدفوع</Th>
              <Th>المتبقي</Th>
              <Th>الدفع</Th>
              <Th>الحالة</Th>
              <Th>الكاشير</Th>
              <Th>التاريخ</Th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <EmptyState
                title={q ? 'لا توجد نتائج مطابقة' : 'لا توجد فواتير بعد'}
                description={q ? 'جرّب بحثاً آخر' : 'أصدر أول فاتورة من نقطة البيع'}
                colSpan={10}
              />
            ) : (
              orders.map((o) => {
                const remaining = toNumber(o.total) - toNumber(o.paidAmount);
                return (
                  <Tr key={o.id}>
                    <Td className="tnum" dir="ltr">
                      <Link
                        href={`/dashboard/invoices/${o.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {o.number}
                      </Link>
                    </Td>
                    <Td>
                      {o.customer ? (
                        <Link
                          href={`/dashboard/customers/${o.customer.id}`}
                          className="hover:text-accent hover:underline"
                        >
                          {o.customer.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-2)]">عميل نقدي</span>
                      )}
                    </Td>
                    <Td className="tnum">{o._count.items}</Td>
                    <Td className="tnum font-semibold">{formatKWD(toNumber(o.total))}</Td>
                    <Td className="tnum">{formatKWD(toNumber(o.paidAmount))}</Td>
                    <Td className="tnum">
                      {remaining > 0 ? (
                        <span className="text-warn">{formatKWD(remaining)}</span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(o.payments.map((p) => p.method))).map((m) => (
                          <Badge key={m} tone={PAYMENT_METHOD[m].tone}>
                            {PAYMENT_METHOD[m].label}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={ORDER_STATUS[o.status].tone}>
                        {ORDER_STATUS[o.status].label}
                      </Badge>
                    </Td>
                    <Td className="text-[12px]">{o.cashier?.name ?? '—'}</Td>
                    <Td className="tnum text-[12px]">{formatDateTime(o.createdAt)}</Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pagination page={page} total={total} />
    </>
  );
}
