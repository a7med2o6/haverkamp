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
import { LEAVE_STATUS, LEAVE_TYPE } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, formatDate, formatDateOnly } from '@/lib/utils';
import { LeaveDecisionButtons, LeaveFormButton } from './leaves-client';

export const metadata: Metadata = { title: 'الإجازات' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'PENDING', label: 'بانتظار الموافقة' },
  { key: 'APPROVED', label: 'موافق عليها' },
  { key: 'REJECTED', label: 'مرفوضة' },
  { key: 'all', label: 'الكل' },
] as const;

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { status = 'PENDING', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.LeaveRequestWhereInput =
    status === 'all' ? {} : { status: status as keyof typeof LEAVE_STATUS };

  const [leaves, total, employees] = await Promise.all([
    db.leaveRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { fromDate: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        employee: { select: { id: true, fullName: true, code: true } },
        approver: { select: { name: true } },
      },
    }),
    db.leaveRequest.count({ where }),
    db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      orderBy: { code: 'asc' },
      select: { id: true, fullName: true, code: true },
    }),
  ]);

  const canWrite = can(session.user.role, 'hr:write');

  return (
    <>
      <PageHeader
        title="الإجازات"
        description={`${total} طلب`}
        actions={canWrite ? <LeaveFormButton employees={employees} /> : null}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/hr/leaves?status=${f.key}`}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              status === f.key
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
              <Th>الموظف</Th>
              <Th>النوع</Th>
              <Th>من</Th>
              <Th>إلى</Th>
              <Th>الأيام</Th>
              <Th>السبب</Th>
              <Th>الحالة</Th>
              <Th>القرار</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <EmptyState
                title="لا توجد طلبات إجازة"
                description={
                  status === 'PENDING'
                    ? 'لا توجد طلبات بانتظار الموافقة حالياً'
                    : 'جرّب تصفية أخرى'
                }
                colSpan={9}
              />
            ) : (
              leaves.map((l) => (
                <Tr key={l.id}>
                  <Td>
                    <span className="font-medium text-[var(--text-0)]">{l.employee.fullName}</span>
                    <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                      {l.employee.code}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={LEAVE_TYPE[l.type].tone}>{LEAVE_TYPE[l.type].label}</Badge>
                  </Td>
                  <Td className="tnum text-[12px]">{formatDateOnly(l.fromDate)}</Td>
                  <Td className="tnum text-[12px]">{formatDateOnly(l.toDate)}</Td>
                  <Td className="tnum font-semibold">{l.days}</Td>
                  <Td className="max-w-48 truncate text-[12px]" title={l.reason ?? ''}>
                    {l.reason ?? '—'}
                  </Td>
                  <Td>
                    <Badge tone={LEAVE_STATUS[l.status].tone}>{LEAVE_STATUS[l.status].label}</Badge>
                  </Td>
                  <Td className="text-[11px] text-[var(--text-2)]">
                    {l.approver?.name ? (
                      <>
                        {l.approver.name}
                        {/* وقت القرار طابع زمني حقيقي — يُعرض بالتوقيت المحلي */}
                        {l.decidedAt && <span className="tnum block">{formatDate(l.decidedAt)}</span>}
                        {l.decisionNote && (
                          <span className="block max-w-40 truncate" title={l.decisionNote}>
                            {l.decisionNote}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  {canWrite && (
                    <Td>{l.status === 'PENDING' && <LeaveDecisionButtons id={l.id} />}</Td>
                  )}
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pagination page={page} total={total} />
    </>
  );
}
