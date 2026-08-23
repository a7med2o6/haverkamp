import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ADVANCE_STATUS } from '@/lib/labels';
import { cn, formatDateOnly, formatKWD, toNumber } from '@/lib/utils';
import { AdvanceFormButton, CancelAdvanceButton, RepayButton } from './advances-client';

export const metadata: Metadata = { title: 'السلف' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'ACTIVE', label: 'قيد السداد' },
  { key: 'SETTLED', label: 'مسدّدة' },
  { key: 'all', label: 'الكل' },
] as const;

export default async function AdvancesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { status = 'ACTIVE' } = await searchParams;

  const where: Prisma.EmployeeAdvanceWhereInput =
    status === 'all' ? {} : { status: status as keyof typeof ADVANCE_STATUS };

  const [advances, employees, activeAdvances] = await Promise.all([
    db.employeeAdvance.findMany({
      where,
      orderBy: [{ status: 'asc' }, { grantedAt: 'desc' }],
      include: {
        employee: { select: { id: true, fullName: true, code: true } },
        repayments: { select: { amount: true } },
      },
    }),
    db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      orderBy: { code: 'asc' },
      select: { id: true, fullName: true, code: true, baseSalary: true, allowance: true },
    }),
    db.employeeAdvance.findMany({
      where: { status: 'ACTIVE' },
      include: { repayments: { select: { amount: true } } },
    }),
  ]);

  const canWrite = can(session.user.role, 'hr:write');

  const outstanding = activeAdvances.reduce((sum, a) => {
    const paid = a.repayments.reduce((s, r) => s + toNumber(r.amount), 0);
    return sum + (toNumber(a.amount) - paid);
  }, 0);

  const monthlyInstallments = activeAdvances.reduce(
    (sum, a) => sum + toNumber(a.monthlyDeduction),
    0
  );

  return (
    <>
      <PageHeader
        title="سلف الموظفين"
        description="تُخصم الأقساط تلقائياً من مسيّر الرواتب الشهري"
        actions={
          canWrite ? (
            <AdvanceFormButton
              employees={employees.map((e) => ({
                id: e.id,
                fullName: e.fullName,
                code: e.code,
                salary: toNumber(e.baseSalary) + toNumber(e.allowance),
              }))}
            />
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="إجمالي المتبقي"
          value={formatKWD(outstanding)}
          icon="HandCoins"
          tone={outstanding > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="خصم الشهر القادم"
          value={formatKWD(monthlyInstallments)}
          icon="CalendarArrowDown"
          tone="accent"
        />
        <StatCard label="سلف قيد السداد" value={activeAdvances.length} icon="Users" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/hr/advances?status=${f.key}`}
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
              <Th>قيمة السلفة</Th>
              <Th>المسدّد</Th>
              <Th>المتبقي</Th>
              <Th>القسط الشهري</Th>
              <Th>التقدّم</Th>
              <Th>تاريخ الصرف</Th>
              <Th>السبب</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <EmptyState
                title="لا توجد سلف"
                description="سجّل سلفة جديدة من الزر أعلى الصفحة"
                colSpan={10}
              />
            ) : (
              advances.map((a) => {
                const total = toNumber(a.amount);
                const paid = a.repayments.reduce((s, r) => s + toNumber(r.amount), 0);
                const remaining = Math.round((total - paid) * 1000) / 1000;
                const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

                return (
                  <Tr key={a.id}>
                    <Td>
                      <Link
                        href={`/dashboard/hr/employees/${a.employee.id}`}
                        className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                      >
                        {a.employee.fullName}
                      </Link>
                      <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                        {a.employee.code}
                      </span>
                    </Td>
                    <Td className="tnum font-semibold">
                      <Link
                        href={`/dashboard/hr/advances/${a.id}`}
                        className="text-accent hover:underline"
                      >
                        {formatKWD(total)}
                      </Link>
                    </Td>
                    <Td className="tnum text-ok">{formatKWD(paid)}</Td>
                    <Td className="tnum font-semibold text-warn">
                      {remaining > 0 ? formatKWD(remaining) : '—'}
                    </Td>
                    <Td className="tnum">{formatKWD(toNumber(a.monthlyDeduction))}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-3)]">
                          <div
                            className="h-full rounded-full bg-ok transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="tnum text-[11px] text-[var(--text-2)]">{percent}%</span>
                      </div>
                    </Td>
                    <Td className="tnum text-[12px]">{formatDateOnly(a.grantedAt)}</Td>
                    <Td className="max-w-40 truncate text-[12px]" title={a.reason ?? ''}>
                      {a.reason ?? '—'}
                    </Td>
                    <Td>
                      <Badge tone={ADVANCE_STATUS[a.status].tone}>
                        {ADVANCE_STATUS[a.status].label}
                      </Badge>
                    </Td>
                    {canWrite && (
                      <Td>
                        {a.status === 'ACTIVE' && (
                          <div className="flex items-center gap-1">
                            <RepayButton
                              advanceId={a.id}
                              remaining={remaining}
                              monthlyDeduction={toNumber(a.monthlyDeduction)}
                            />
                            <AdvanceFormButton
                              employees={employees.map((e) => ({
                                id: e.id,
                                fullName: e.fullName,
                                code: e.code,
                                salary: toNumber(e.baseSalary) + toNumber(e.allowance),
                              }))}
                              advance={{
                                id: a.id,
                                employeeId: a.employeeId,
                                amount: total,
                                monthlyDeduction: toNumber(a.monthlyDeduction),
                                reason: a.reason,
                                grantedAt: a.grantedAt.toISOString().slice(0, 10),
                                notes: a.notes,
                              }}
                            />
                            <CancelAdvanceButton id={a.id} />
                          </div>
                        )}
                      </Td>
                    )}
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
