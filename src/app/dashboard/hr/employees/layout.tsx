import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { expiryStatus, todayDateOnly } from '@/lib/utils';
import { RESIDENCY_ALERT_DAYS, RESIDENCY_DOC_TYPES } from '@/lib/constants';
import { EmployeeList } from './employee-list';
import { EmployeeFormButton } from './employee-form';

export const metadata: Metadata = { title: 'الموظفون' };
export const dynamic = 'force-dynamic';

export default async function EmployeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePermission('hr:read');

  const alertDeadline = new Date(
    todayDateOnly().getTime() + RESIDENCY_ALERT_DAYS * 86400000
  );

  const [employees, departments, documents] = await Promise.all([
    db.employee.findMany({
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      select: {
        id: true,
        code: true,
        fullName: true,
        civilId: true,
        photo: true,
        position: true,
        status: true,
      },
    }),
    db.department.findMany({ orderBy: { nameAr: 'asc' }, select: { id: true, nameAr: true } }),
    // نفس نطاق تنبيه لوحة التحكم بالضبط، حتى يتطابق العدد بين البطاقة وهذه القائمة
    db.employeeDocument.findMany({
      where: {
        type: { in: [...RESIDENCY_DOC_TYPES] },
        expiryDate: { not: null, lte: alertDeadline },
      },
      select: { employeeId: true, expiryDate: true },
    }),
  ]);

  const soonestByEmployee = new Map<string, Date>();
  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const current = soonestByEmployee.get(doc.employeeId);
    if (!current || doc.expiryDate < current) {
      soonestByEmployee.set(doc.employeeId, doc.expiryDate);
    }
  }

  const canWrite = can(session.user.role, 'hr:write');

  return (
    // القائمة أولاً حتى تظهر على اليمين (بداية السطر في RTL) بجوار قائمة التنقّل
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      {/* ── قائمة الموظفين ── */}
      <aside className="flex shrink-0 flex-col gap-3 xl:sticky xl:top-20 xl:h-[calc(100dvh-7rem)] xl:w-72">
        {canWrite && (
          <EmployeeFormButton departments={departments} className="h-12 w-full text-[15px]" />
        )}
        <div className="min-h-0 flex-1">
          <EmployeeList
            employees={employees.map((e) => {
              const soonest = soonestByEmployee.get(e.id) ?? null;
              const status = expiryStatus(soonest);
              return {
                id: e.id,
                code: e.code,
                fullName: e.fullName,
                civilId: e.civilId,
                photo: e.photo,
                position: e.position,
                isActive: e.status === 'ACTIVE',
                // الاستعلام مُقيَّد أصلاً بالنطاق، فوجود تاريخ يعني حاجة للتجديد
                expiry: soonest
                  ? {
                      tone: status.tone === 'warn' ? ('warn' as const) : ('danger' as const),
                      label: status.label,
                    }
                  : null,
              };
            })}
          />
        </div>
      </aside>

      {/* ── البروفايل ── */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
