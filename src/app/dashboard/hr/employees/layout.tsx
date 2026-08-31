import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { expiryStatus, todayDateOnly } from '@/lib/utils';
import {
  PASSPORT_ALERT_DAYS,
  PASSPORT_CRITICAL_DAYS,
  RESIDENCY_ALERT_DAYS,
  RESIDENCY_DOC_TYPES,
} from '@/lib/constants';
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

  const today = todayDateOnly();
  const alertDeadline = new Date(today.getTime() + RESIDENCY_ALERT_DAYS * 86400000);
  // الجواز نافذته أوسع: تجديد الإقامة يشترط بقاء سنة فيه
  const passportDeadline = new Date(today.getTime() + PASSPORT_ALERT_DAYS * 86400000);

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
        skills: true,
        status: true,
      },
    }),
    db.department.findMany({ orderBy: { nameAr: 'asc' }, select: { id: true, nameAr: true } }),
    // نفس نطاق تنبيه لوحة التحكم بالضبط، حتى يتطابق العدد بين البطاقة وهذه القائمة
    db.employeeDocument.findMany({
      where: {
        OR: [
          {
            type: { in: [...RESIDENCY_DOC_TYPES] },
            expiryDate: { not: null, lte: alertDeadline },
          },
          { type: 'PASSPORT', expiryDate: { not: null, lte: passportDeadline } },
        ],
      },
      select: { employeeId: true, expiryDate: true, type: true },
    }),
  ]);

  /*
    نحتفظ بأشدّ الوثائق إلحاحاً لا بأقربها انتهاءً: جواز باقٍ له ثمانية
    أشهر أخطر من إقامة باقٍ لها أربعين يوماً، لأن الأول يمنع تجديد الثاني.
    فنقارن بالحالة لا بالتاريخ.
  */
  const worstByEmployee = new Map<
    string,
    { date: Date; status: ReturnType<typeof expiryStatus>; isPassport: boolean }
  >();
  const RANK = { danger: 0, warn: 1, ok: 2, neutral: 3 } as const;

  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const isPassport = doc.type === 'PASSPORT';
    const status = expiryStatus(
      doc.expiryDate,
      isPassport
        ? { danger: PASSPORT_CRITICAL_DAYS, warn: PASSPORT_ALERT_DAYS }
        : undefined
    );
    const current = worstByEmployee.get(doc.employeeId);
    if (
      !current ||
      RANK[status.tone] < RANK[current.status.tone] ||
      (RANK[status.tone] === RANK[current.status.tone] && doc.expiryDate < current.date)
    ) {
      worstByEmployee.set(doc.employeeId, { date: doc.expiryDate, status, isPassport });
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
              const worst = worstByEmployee.get(e.id) ?? null;
              const status = worst?.status ?? expiryStatus(null);
              return {
                id: e.id,
                code: e.code,
                fullName: e.fullName,
                civilId: e.civilId,
                photo: e.photo,
                position: e.position,
                skills: e.skills,
                isActive: e.status === 'ACTIVE',
                // الاستعلام مُقيَّد أصلاً بالنطاق، فوجود تاريخ يعني حاجة للتجديد
                // نميّز الجواز في النص: علاجه غير علاج الإقامة
                expiry:
                  worst && status.tone !== 'ok'
                    ? {
                        tone:
                          status.tone === 'warn' ? ('warn' as const) : ('danger' as const),
                        label: worst.isPassport
                          ? `الجواز — ${status.label}`
                          : status.label,
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
