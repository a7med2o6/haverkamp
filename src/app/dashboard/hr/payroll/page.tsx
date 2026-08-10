import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PAYROLL_STATUS } from '@/lib/labels';
import { formatDate, formatKWD, toNumber } from '@/lib/utils';
import { GeneratePayrollButton, PayrollStatusButton } from './payroll-client';

export const metadata: Metadata = { title: 'الرواتب' };
export const dynamic = 'force-dynamic';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export default async function PayrollPage() {
  const session = await requirePermission('hr:read');
  const canWrite = can(session.user.role, 'hr:write');

  const runs = await db.payrollRun.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { _count: { select: { payslips: true } } },
  });

  return (
    <>
      <PageHeader
        title="مسيّرات الرواتب"
        description="توليد واعتماد وصرف رواتب الموظفين شهرياً"
        actions={canWrite ? <GeneratePayrollButton /> : null}
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الشهر</Th>
              <Th>عدد الموظفين</Th>
              <Th>إجمالي الصافي</Th>
              <Th>الحالة</Th>
              <Th>تاريخ الصرف</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <EmptyState
                title="لا توجد مسيّرات رواتب"
                description="ولّد أول مسيّر من الزر أعلى الصفحة"
                colSpan={6}
              />
            ) : (
              runs.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-[var(--text-0)]">
                    <Link
                      href={`/dashboard/hr/payroll/${r.id}`}
                      className="hover:text-accent hover:underline"
                    >
                      {MONTHS[r.month - 1]} <span className="tnum">{r.year}</span>
                    </Link>
                  </Td>
                  <Td className="tnum">{r._count.payslips}</Td>
                  <Td className="tnum font-semibold">{formatKWD(toNumber(r.totalNet))}</Td>
                  <Td>
                    <Badge tone={PAYROLL_STATUS[r.status].tone}>
                      {PAYROLL_STATUS[r.status].label}
                    </Badge>
                  </Td>
                  <Td className="tnum text-[12px]">
                    {r.processedAt ? formatDate(r.processedAt) : '—'}
                  </Td>
                  <Td>
                    {canWrite && <PayrollStatusButton id={r.id} status={r.status} />}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
