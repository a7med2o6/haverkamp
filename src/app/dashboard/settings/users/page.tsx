import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can, ROLE_LABELS } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatPhone } from '@/lib/utils';
import { ToggleUserButton, UserFormButton } from './user-form';

export const metadata: Metadata = { title: 'المستخدمون' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await requirePermission('settings:read');
  const canWrite = can(session.user.role, 'settings:write');

  const users = await db.user.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    include: { employee: { select: { code: true, fullName: true } } },
  });

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        description={`${users.length} حساب · الدور يحدّد ما يراه المستخدم في اللوحة`}
        actions={canWrite ? <UserFormButton /> : null}
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الاسم</Th>
              <Th>البريد الإلكتروني</Th>
              <Th>الهاتف</Th>
              <Th>الدور</Th>
              <Th>الموظف المرتبط</Th>
              <Th>آخر دخول</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <EmptyState title="لا يوجد مستخدمون" colSpan={8} />
            ) : (
              users.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium text-[var(--text-0)]">
                    {u.name}
                    {u.id === session.user.id && (
                      <Badge tone="accent" className="ms-2">
                        أنت
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-[12px]" dir="ltr">
                    {u.email}
                  </Td>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {formatPhone(u.phone)}
                  </Td>
                  <Td>
                    <Badge tone={u.role === 'OWNER' ? 'accent' : 'neutral'}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </Td>
                  <Td className="text-[12px]">{u.employee?.fullName ?? '—'}</Td>
                  <Td className="tnum text-[12px]">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'لم يسجّل دخولاً'}
                  </Td>
                  <Td>
                    {u.isActive ? <Badge tone="ok">نشط</Badge> : <Badge tone="danger">موقوف</Badge>}
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center gap-0.5">
                        <UserFormButton
                          user={{
                            id: u.id,
                            name: u.name,
                            email: u.email,
                            phone: u.phone,
                            role: u.role,
                            isActive: u.isActive,
                            password: '',
                          }}
                        />
                        <ToggleUserButton id={u.id} isActive={u.isActive} />
                      </div>
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
