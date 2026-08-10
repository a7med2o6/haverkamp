import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EMPLOYEE_STATUS } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { formatDateOnly, formatKWD, toNumber } from '@/lib/utils';
import { EmployeeFormButton } from './employee-form';

export const metadata: Metadata = { title: 'الموظفون' };
export const dynamic = 'force-dynamic';

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { q, page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.EmployeeWhereInput = {
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { code: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q } },
            { position: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(status && status in EMPLOYEE_STATUS
      ? { status: status as keyof typeof EMPLOYEE_STATUS }
      : {}),
  };

  const [employees, total, departments, payrollTotal] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { code: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { department: { select: { nameAr: true } } },
    }),
    db.employee.count({ where }),
    db.department.findMany({ orderBy: { nameAr: 'asc' }, select: { id: true, nameAr: true } }),
    db.employee.aggregate({
      _sum: { baseSalary: true, allowance: true },
      where: { status: 'ACTIVE' },
    }),
  ]);

  const canWrite = can(session.user.role, 'hr:write');
  const monthlyCost =
    toNumber(payrollTotal._sum.baseSalary) + toNumber(payrollTotal._sum.allowance);

  return (
    <>
      <PageHeader
        title="الموظفون"
        description={`${total} موظف · التكلفة الشهرية للرواتب ${formatKWD(monthlyCost)}`}
        actions={canWrite ? <EmployeeFormButton departments={departments} /> : null}
      />

      <SearchBar placeholder="ابحث بالاسم أو الكود أو الوظيفة…" className="mb-4 max-w-md" />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>الوظيفة</Th>
              <Th>القسم</Th>
              <Th>الهاتف</Th>
              <Th>التعيين</Th>
              <Th>الراتب</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <EmptyState
                title={q ? 'لا توجد نتائج مطابقة' : 'لا يوجد موظفون بعد'}
                description={q ? 'جرّب مصطلح بحث آخر' : 'ابدأ بإضافة أول موظف'}
                colSpan={9}
              />
            ) : (
              employees.map((e) => (
                <Tr key={e.id}>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {e.code}
                  </Td>
                  <Td className="font-medium text-[var(--text-0)]">{e.fullName}</Td>
                  <Td>{e.position}</Td>
                  <Td className="text-[12px]">{e.department?.nameAr ?? '—'}</Td>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {e.phone}
                  </Td>
                  <Td className="tnum text-[12px]">{formatDateOnly(e.hireDate)}</Td>
                  <Td className="tnum">
                    {formatKWD(toNumber(e.baseSalary) + toNumber(e.allowance))}
                  </Td>
                  <Td>
                    <Badge tone={EMPLOYEE_STATUS[e.status].tone}>
                      {EMPLOYEE_STATUS[e.status].label}
                    </Badge>
                  </Td>
                  {canWrite && (
                    <Td>
                      <EmployeeFormButton
                        variant="ghost"
                        departments={departments}
                        employee={{
                          id: e.id,
                          fullName: e.fullName,
                          fullNameEn: e.fullNameEn,
                          position: e.position,
                          departmentId: e.departmentId,
                          phone: e.phone,
                          email: e.email,
                          nationality: e.nationality,
                          civilId: e.civilId,
                          birthDate: e.birthDate?.toISOString().slice(0, 10) ?? '',
                          hireDate: e.hireDate.toISOString().slice(0, 10),
                          contractEnd: e.contractEnd?.toISOString().slice(0, 10) ?? '',
                          status: e.status,
                          baseSalary: toNumber(e.baseSalary),
                          allowance: toNumber(e.allowance),
                          bankIban: e.bankIban,
                          emergencyContact: e.emergencyContact,
                          annualLeaveDays: e.annualLeaveDays,
                          notes: e.notes,
                        }}
                      />
                    </Td>
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
