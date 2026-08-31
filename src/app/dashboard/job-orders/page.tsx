import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Pagination } from '@/components/dashboard/pagination';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { JOB_STATUS } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, dueStatus, formatDate, formatKWD, toNumber } from '@/lib/utils';
import { CustomerFilterBar } from '@/components/dashboard/customer-filter';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'أوامر الشغل' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'active', label: 'الجارية' },
  { key: 'late', label: 'متأخرة' },
  { key: 'READY', label: 'جاهزة للتسليم' },
  { key: 'DELIVERED', label: 'مُسلَّمة' },
  { key: 'all', label: 'الكل' },
] as const;

export default async function JobOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; customer?: string }>;
}) {
  const session = await requirePermission('workshop:read');
  const { filter: filterParam, page: pageParam, customer } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  /*
    المَعلمة تصل من الرابط فتقبل أي نصّ، وكانت تُمرَّر خاماً إلى Prisma
    كقيمة enum — فـ?filter=x يُسقط الصفحة بـPrismaClientValidationError.
    نقصرها على المفاتيح المعروفة ونرتدّ إلى الافتراضي عند غيرها.
  */
  const filter = FILTERS.some((f) => f.key === filterParam)
    ? (filterParam as (typeof FILTERS)[number]['key'])
    : 'active';

  const byFilter: Prisma.JobOrderWhereInput =
    filter === 'active'
      ? { status: { in: ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK'] } }
      : filter === 'late'
        ? {
            status: { in: ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] },
            promisedAt: { lt: new Date() },
          }
        : filter === 'all'
          ? {}
          : { status: filter };

  // تصفية بعميل واحد — يصلها الموظف من رابط «عرض الكل» في ملف العميل
  const where: Prisma.JobOrderWhereInput = customer
    ? { AND: [byFilter, { customerId: customer }] }
    : byFilter;

  const [jobs, total] = await Promise.all([
    db.jobOrder.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { make: true, model: true, plateNo: true } },
        items: {
          select: { id: true, total: true, isDone: true, parentId: true },
        },
        order: { select: { id: true, number: true } },
      },
    }),
    db.jobOrder.count({ where }),
  ]);

  const canWrite = can(session.user.role, 'workshop:write');

  return (
    <>
      <PageHeader
        title="أوامر الشغل"
        description={`${total} أمر شغل`}
        actions={
          canWrite ? (
            <Link href="/dashboard/job-orders/new" className={buttonVariants()}>
              <Plus />
              بيان تشغيل جديد
            </Link>
          ) : null
        }
      />

      {customer && (
        <CustomerFilterBar
          customerId={customer}
          clearHref={`/dashboard/job-orders?filter=${filter}`}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/job-orders?filter=${f.key}${customer ? `&customer=${customer}` : ''}`}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              filter === f.key
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الرقم</Th>
              <Th>العميل</Th>
              <Th>السيارة</Th>
              <Th>التقدّم</Th>
              <Th>القيمة</Th>
              <Th>الاستلام</Th>
              <Th>الحالة</Th>
              <Th>الفاتورة</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <EmptyState
                title="لا توجد أوامر شغل"
                description="أنشئ أمر شغل جديد أو حوّل حجزاً قائماً"
                colSpan={8}
              />
            ) : (
              jobs.map((j) => {
                const value = j.items.reduce((s, i) => s + toNumber(i.total), 0);
                /*
                  التقدّم يُعدّ وحدات العمل الحقيقية: القطع حيث وُجدت،
                  والخدمة نفسها حيث لا قطع لها. عدّ الآباء مع أبنائهم كان
                  يخلط «الخدمة» بـ«قطعها» في مقام واحد فيصير «٢ من ٦» لغزاً.
                */
                const parentsWithParts = new Set(
                  j.items.map((i) => i.parentId).filter(Boolean)
                );
                const units = j.items.filter(
                  (i) => i.parentId !== null || !parentsWithParts.has(i.id)
                );
                const done = units.filter((i) => i.isDone).length;
                const due = dueStatus(
                  j.promisedAt,
                  j.status !== 'DELIVERED' && j.status !== 'CANCELLED'
                );
                return (
                  <Tr key={j.id}>
                    <Td className="tnum" dir="ltr">
                      <Link
                        href={`/dashboard/job-orders/${j.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {j.number}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/customers/${j.customer.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {j.customer.name}
                      </Link>
                    </Td>
                    <Td className="text-[12px]">
                      {j.vehicle ? `${j.vehicle.make} ${j.vehicle.model}` : '—'}
                      {j.vehicle?.plateNo && (
                        <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                          {j.vehicle.plateNo}
                        </span>
                      )}
                    </Td>
                    <Td className="tnum text-[12px]">
                      {units.length > 0 ? `${done} / ${units.length}` : '—'}
                    </Td>
                    <Td className="tnum font-semibold">{formatKWD(value)}</Td>
                    <Td className="tnum text-[12px]">{formatDate(j.receivedAt)}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</Badge>
                        {due && <Badge tone={due.tone}>{due.label}</Badge>}
                      </div>
                    </Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {j.order ? (
                        <Link
                          href={`/dashboard/invoices/${j.order.id}`}
                          className="text-accent hover:underline"
                        >
                          {j.order.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
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
