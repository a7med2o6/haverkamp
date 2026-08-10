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
import { cn, formatDate, formatKWD, toNumber } from '@/lib/utils';
import { NewJobOrderButton } from './job-client';

export const metadata: Metadata = { title: 'أوامر الشغل' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'active', label: 'الجارية' },
  { key: 'READY', label: 'جاهزة للتسليم' },
  { key: 'DELIVERED', label: 'مُسلَّمة' },
  { key: 'all', label: 'الكل' },
] as const;

export default async function JobOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const session = await requirePermission('workshop:read');
  const { filter = 'active', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.JobOrderWhereInput =
    filter === 'active'
      ? { status: { in: ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK'] } }
      : filter === 'all'
        ? {}
        : { status: filter as keyof typeof JOB_STATUS };

  const [jobs, total, customers] = await Promise.all([
    db.jobOrder.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { make: true, model: true, plateNo: true } },
        items: { select: { total: true, isDone: true } },
        assignees: { include: { employee: { select: { fullName: true } } } },
        order: { select: { id: true, number: true } },
      },
    }),
    db.jobOrder.count({ where }),
    db.customer.findMany({
      where: { isBlocked: false },
      orderBy: { name: 'asc' },
      take: 500,
      select: {
        id: true,
        name: true,
        phone: true,
        vehicles: { select: { id: true, make: true, model: true, plateNo: true } },
      },
    }),
  ]);

  const canWrite = can(session.user.role, 'workshop:write');

  return (
    <>
      <PageHeader
        title="أوامر الشغل"
        description={`${total} أمر شغل`}
        actions={
          canWrite ? (
            <NewJobOrderButton
              customers={customers.map((c) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                vehicles: c.vehicles.map((v) => ({
                  id: v.id,
                  label: `${v.make} ${v.model}${v.plateNo ? ` — ${v.plateNo}` : ''}`,
                })),
              }))}
            />
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/job-orders?filter=${f.key}`}
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
              <Th>الفنيون</Th>
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
                colSpan={9}
              />
            ) : (
              jobs.map((j) => {
                const value = j.items.reduce((s, i) => s + toNumber(i.total), 0);
                const done = j.items.filter((i) => i.isDone).length;
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
                      {j.items.length > 0 ? `${done} / ${j.items.length}` : '—'}
                    </Td>
                    <Td className="tnum font-semibold">{formatKWD(value)}</Td>
                    <Td className="text-[11px]">
                      {j.assignees.length > 0
                        ? j.assignees.map((a) => a.employee.fullName).join('، ')
                        : '—'}
                    </Td>
                    <Td className="tnum text-[12px]">{formatDate(j.receivedAt)}</Td>
                    <Td>
                      <Badge tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</Badge>
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
