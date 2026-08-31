import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { formatKWD, formatPhone, toNumber } from '@/lib/utils';
import { DeleteSupplierButton, SupplierFormButton } from './supplier-form';

export const metadata: Metadata = { title: 'المورّدون' };
export const dynamic = 'force-dynamic';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requirePermission('inventory:read');
  const { q } = await searchParams;

  const where: Prisma.SupplierWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { country: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const suppliers = await db.supplier.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      purchaseOrders: { select: { total: true, status: true } },
    },
  });

  const canWrite = can(session.user.role, 'inventory:write');
  const canDelete = can(session.user.role, 'inventory:delete');

  return (
    <>
      <PageHeader
        title="المورّدون"
        description={`${suppliers.length} مورّد`}
        actions={canWrite ? <SupplierFormButton /> : null}
      />

      <SearchBar placeholder="ابحث بالاسم أو الهاتف أو الدولة…" className="mb-4 max-w-md" />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>المورّد</Th>
              <Th>الدولة</Th>
              <Th>الهاتف</Th>
              <Th>البريد</Th>
              <Th>أوامر الشراء</Th>
              <Th>إجمالي المشتريات</Th>
              {(canWrite || canDelete) && <Th />}
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <EmptyState
                title="لا يوجد مورّدون"
                description="سجّل مورّديك لتتمكن من إنشاء أوامر الشراء"
                colSpan={7}
              />
            ) : (
              suppliers.map((s) => {
                // الملغاة لا تُحتسب ضمن المشتريات
                const live = s.purchaseOrders.filter((o) => o.status !== 'CANCELLED');
                const spent = live.reduce((sum, o) => sum + toNumber(o.total), 0);

                return (
                  <Tr key={s.id}>
                    <Td className="font-medium text-[var(--text-0)]">
                      {s.name}
                      {s.address && (
                        <span className="block text-[11px] text-[var(--text-2)]">{s.address}</span>
                      )}
                    </Td>
                    <Td className="text-[12px]">{s.country ?? '—'}</Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {formatPhone(s.phone)}
                    </Td>
                    <Td className="text-[12px]" dir="ltr">
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="hover:text-accent">
                          {s.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="tnum">
                      {live.length > 0 ? (
                        <Link
                          href={`/dashboard/purchases?supplier=${s.id}`}
                          className="text-accent hover:underline"
                        >
                          {live.length}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="tnum font-semibold">{formatKWD(spent)}</Td>
                    {(canWrite || canDelete) && (
                      <Td>
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <SupplierFormButton
                              supplier={{
                                id: s.id,
                                name: s.name,
                                phone: s.phone,
                                email: s.email,
                                country: s.country,
                                address: s.address,
                                notes: s.notes,
                              }}
                            />
                          )}
                          {canDelete && <DeleteSupplierButton id={s.id} name={s.name} />}
                        </div>
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
