import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { StatCard } from '@/components/dashboard/stat-card';
import { formatKWD, toNumber } from '@/lib/utils';
import { EXPIRY_ALERT_DAYS } from '@/lib/constants';
import { todayDateOnly } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function EmployeesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ expiring?: string }>;
}) {
  await requirePermission('hr:read');
  const { expiring } = await searchParams;

  const first = await db.employee.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    select: { id: true },
  });

  // نفتح بروفايل أول موظف مباشرة — الصفحة الفارغة بلا فائدة.
  // نمرّر expiring حتى تصل إلى القائمة الجانبية فتُفعّل التصفية.
  if (first) {
    redirect(
      `/dashboard/hr/employees/${first.id}${expiring === '1' ? '?expiring=1' : ''}`
    );
  }

  const today = todayDateOnly();
  const alertDate = new Date(today.getTime() + EXPIRY_ALERT_DAYS * 86400000);

  const [total, payroll, expiringCount] = await Promise.all([
    db.employee.count(),
    db.employee.aggregate({ _sum: { baseSalary: true, allowance: true } }),
    db.employeeDocument.count({ where: { expiryDate: { gte: today, lte: alertDate } } }),
  ]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-8">
      <h1 className="text-xl font-bold text-[var(--text-0)]">الموظفون</h1>
      <p className="mt-1.5 text-[13px] text-[var(--text-2)]">
        لا يوجد موظفون نشطون بعد — أضف أول موظف من الزر في القائمة الجانبية.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="إجمالي الموظفين" value={total} icon="Users" />
        <StatCard
          label="التكلفة الشهرية"
          value={formatKWD(
            toNumber(payroll._sum.baseSalary) + toNumber(payroll._sum.allowance)
          )}
          icon="Banknote"
        />
        <StatCard
          label={`وثائق تنتهي خلال ${EXPIRY_ALERT_DAYS} يوم`}
          value={expiringCount}
          icon="FileWarning"
          tone={expiringCount ? 'warn' : 'neutral'}
        />
      </div>
    </div>
  );
}
