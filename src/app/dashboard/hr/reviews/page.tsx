import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Pagination } from '@/components/dashboard/pagination';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { PAGE_SIZE } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { ReviewFormButton, StarRating } from './reviews-client';

export const metadata: Metadata = { title: 'تقييم الأداء' };
export const dynamic = 'force-dynamic';

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [reviews, total, employees] = await Promise.all([
    db.performanceReview.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        employee: { select: { fullName: true, code: true, position: true } },
        reviewer: { select: { name: true } },
      },
    }),
    db.performanceReview.count(),
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
        title="تقييم الأداء"
        description={`${total} تقييم مسجّل`}
        actions={canWrite ? <ReviewFormButton employees={employees} /> : null}
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الموظف</Th>
              <Th>الوظيفة</Th>
              <Th>الفترة</Th>
              <Th>التقييم</Th>
              <Th>نقاط القوة</Th>
              <Th>مجالات التحسين</Th>
              <Th>المُقيِّم</Th>
              <Th>التاريخ</Th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <EmptyState
                title="لا توجد تقييمات بعد"
                description="سجّل أول تقييم أداء لأحد الموظفين"
                colSpan={8}
              />
            ) : (
              reviews.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="font-medium text-[var(--text-0)]">{r.employee.fullName}</span>
                    <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                      {r.employee.code}
                    </span>
                  </Td>
                  <Td className="text-[12px]">{r.employee.position}</Td>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {r.periodLabel}
                  </Td>
                  <Td>
                    <StarRating value={r.rating} />
                  </Td>
                  <Td className="max-w-48 truncate text-[12px]" title={r.strengths ?? ''}>
                    {r.strengths ?? '—'}
                  </Td>
                  <Td className="max-w-48 truncate text-[12px]" title={r.improvements ?? ''}>
                    {r.improvements ?? '—'}
                  </Td>
                  <Td className="text-[12px]">{r.reviewer?.name ?? '—'}</Td>
                  <Td className="tnum text-[12px]">{formatDate(r.createdAt)}</Td>
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
