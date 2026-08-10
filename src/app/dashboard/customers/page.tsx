import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { PAGE_SIZE } from '@/lib/constants';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CUSTOMER_SOURCE } from '@/lib/labels';
import { formatDate } from '@/lib/utils';
import { CustomerFormButton } from './customer-form';

export const metadata: Metadata = { title: 'العملاء' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requirePermission('crm:read');
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { code: { contains: q, mode: 'insensitive' } },
          { civilId: { contains: q } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { vehicles: true, jobOrders: true } },
      },
    }),
    db.customer.count({ where }),
  ]);

  const canWrite = can(session.user.role, 'crm:write');

  return (
    <>
      <PageHeader
        title="العملاء"
        description={`${total} عميل مسجّل`}
        actions={canWrite ? <CustomerFormButton /> : null}
      />

      <SearchBar
        placeholder="ابحث بالاسم أو الهاتف أو الرقم المدني…"
        className="mb-4 max-w-md"
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>الهاتف</Th>
              <Th>المنطقة</Th>
              <Th>السيارات</Th>
              <Th>أوامر الشغل</Th>
              <Th>المصدر</Th>
              <Th>مسجّل منذ</Th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <EmptyState
                title={q ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء بعد'}
                description={
                  q ? 'جرّب مصطلح بحث آخر' : 'ابدأ بإضافة أول عميل من الزر أعلى الصفحة'
                }
                colSpan={8}
              />
            ) : (
              customers.map((c) => (
                <Tr key={c.id}>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {c.code}
                  </Td>
                  <Td>
                    <Link
                      href={`/dashboard/customers/${c.id}`}
                      className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.isBlocked && (
                      <Badge tone="danger" className="ms-2">
                        محظور
                      </Badge>
                    )}
                  </Td>
                  <Td className="tnum" dir="ltr">
                    {c.phone}
                  </Td>
                  <Td>{c.area ?? '—'}</Td>
                  <Td className="tnum">{c._count.vehicles}</Td>
                  <Td className="tnum">{c._count.jobOrders}</Td>
                  <Td>
                    <Badge tone={CUSTOMER_SOURCE[c.source].tone}>
                      {CUSTOMER_SOURCE[c.source].label}
                    </Badge>
                  </Td>
                  <Td className="tnum text-[12px]">{formatDate(c.createdAt)}</Td>
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
