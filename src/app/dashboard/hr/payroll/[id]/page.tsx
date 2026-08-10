import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PAYROLL_STATUS } from '@/lib/labels';
import { formatKWD, toNumber } from '@/lib/utils';
import { PayrollStatusButton } from '../payroll-client';

export const dynamic = 'force-dynamic';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const run = await db.payrollRun.findUnique({ where: { id }, select: { month: true, year: true } });
  return { title: run ? `رواتب ${MONTHS[run.month - 1]} ${run.year}` : 'مسيّر الرواتب' };
}

export default async function PayrollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { id } = await params;

  const run = await db.payrollRun.findUnique({
    where: { id },
    include: {
      payslips: {
        orderBy: { employee: { code: 'asc' } },
        include: {
          employee: { select: { code: true, fullName: true, position: true } },
          items: true,
        },
      },
    },
  });

  if (!run) notFound();

  const canWrite = can(session.user.role, 'hr:write');

  const totals = run.payslips.reduce(
    (acc, p) => ({
      base: acc.base + toNumber(p.baseSalary),
      allowances: acc.allowances + toNumber(p.allowances),
      overtime: acc.overtime + toNumber(p.overtime),
      deductions: acc.deductions + toNumber(p.deductions),
    }),
    { base: 0, allowances: 0, overtime: 0, deductions: 0 }
  );

  return (
    <>
      <Link
        href="/dashboard/hr/payroll"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى المسيّرات
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-0)] sm:text-2xl">
              رواتب {MONTHS[run.month - 1]} <span className="tnum">{run.year}</span>
            </h1>
            <Badge tone={PAYROLL_STATUS[run.status].tone}>{PAYROLL_STATUS[run.status].label}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            {run.payslips.length} قسيمة راتب
          </p>
        </div>
        {canWrite && <PayrollStatusButton id={run.id} status={run.status} />}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="الرواتب الأساسية" value={formatKWD(totals.base)} icon="Banknote" />
        <StatCard label="البدلات" value={formatKWD(totals.allowances)} icon="PlusCircle" tone="accent" />
        <StatCard label="ساعات إضافية" value={formatKWD(totals.overtime)} icon="Clock" tone="ok" />
        <StatCard label="الخصومات" value={formatKWD(totals.deductions)} icon="MinusCircle" tone="danger" />
        <StatCard
          label="الإجمالي الصافي"
          value={formatKWD(toNumber(run.totalNet))}
          icon="Wallet"
          tone="ok"
        />
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>الموظف</Th>
              <Th>الوظيفة</Th>
              <Th>الأساسي</Th>
              <Th>البدلات</Th>
              <Th>إضافي</Th>
              <Th>غياب</Th>
              <Th>الخصومات</Th>
              <Th>الصافي</Th>
            </tr>
          </thead>
          <tbody>
            {run.payslips.length === 0 ? (
              <EmptyState title="لا توجد قسائم في هذا المسيّر" colSpan={9} />
            ) : (
              run.payslips.map((p) => (
                <Tr key={p.id}>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {p.employee.code}
                  </Td>
                  <Td className="font-medium text-[var(--text-0)]">{p.employee.fullName}</Td>
                  <Td className="text-[12px]">{p.employee.position}</Td>
                  <Td className="tnum">{formatKWD(toNumber(p.baseSalary))}</Td>
                  <Td className="tnum">{formatKWD(toNumber(p.allowances))}</Td>
                  <Td className="tnum text-ok">
                    {toNumber(p.overtime) > 0 ? formatKWD(toNumber(p.overtime)) : '—'}
                  </Td>
                  <Td className="tnum">{p.absentDays || '—'}</Td>
                  <Td className="tnum text-danger">
                    {toNumber(p.deductions) > 0 ? formatKWD(toNumber(p.deductions)) : '—'}
                  </Td>
                  <Td className="tnum font-bold text-[var(--text-0)]">
                    {formatKWD(toNumber(p.netPay))}
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
