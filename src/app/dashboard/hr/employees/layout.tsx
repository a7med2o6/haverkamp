import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
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

  const [employees, departments] = await Promise.all([
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
  ]);

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
            employees={employees.map((e) => ({
              id: e.id,
              code: e.code,
              fullName: e.fullName,
              civilId: e.civilId,
              photo: e.photo,
              position: e.position,
              isActive: e.status === 'ACTIVE',
            }))}
          />
        </div>
      </aside>

      {/* ── البروفايل ── */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
