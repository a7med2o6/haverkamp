import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Pagination } from '@/components/dashboard/pagination';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PURCHASE_STATUS } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, formatDate, formatKWD, toNumber } from '@/lib/utils';
import { NewPurchaseButton } from './purchase-client';

export const metadata: Metadata = { title: 'أوامر الشراء' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'open', label: 'الجارية' },
  { key: 'DRAFT', label: 'مسودات' },
  { key: 'RECEIVED', label: 'مستلمة' },
  { key: 'all', label: 'الكل' },
] as const;

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; supplier?: string }>;
}) {
  const session = await requirePermission('inventory:read');
  const { filter = 'open', page: pageParam, supplier } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const byFilter: Prisma.PurchaseOrderWhereInput =
    filter === 'open'
      ? { status: { in: ['DRAFT', 'ORDERED', 'PARTIAL'] } }
      : filter === 'all'
        ? {}
        : { status: filter as keyof typeof PURCHASE_STATUS };

  const where: Prisma.PurchaseOrderWhereInput = supplier
    ? { AND: [byFilter, { supplierId: supplier }] }
    : byFilter;

  const [orders, total, suppliers] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { id: true, name: true } },
        items: { select: { qty: true, receivedQty: true } },
      },
    }),
    db.purchaseOrder.count({ where }),
    db.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const canWrite = can(session.user.role, 'inventory:write');

  return (
    <>
      <PageHeader
        title="أوامر الشراء"
        description={`${total} أمر شراء`}
        actions={canWrite ? <NewPurchaseButton suppliers={suppliers} /> : null}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/purchases?filter=${f.key}${supplier ? `&supplier=${supplier}` : ''}`}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              filter === f.key
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
              <Th>الرقم</Th>
              <Th>المورّد</Th>
              <Th>تاريخ الطلب</Th>
              <Th>متوقّع</Th>
              <Th>البنود</Th>
              <Th>الاستلام</Th>
              <Th>الإجمالي</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <EmptyState
                title="لا توجد أوامر شراء"
                description="أنشئ أمر شراء لتسجيل بضاعة واردة وتحديث المخزون"
                colSpan={8}
              />
            ) : (
              orders.map((o) => {
                const ordered = o.items.reduce((s, i) => s + toNumber(i.qty), 0);
                const received = o.items.reduce((s, i) => s + toNumber(i.receivedQty), 0);
                const percent = ordered > 0 ? Math.round((received / ordered) * 100) : 0;

                return (
                  <Tr key={o.id}>
                    <Td className="tnum" dir="ltr">
                      <Link
                        href={`/dashboard/purchases/${o.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {o.number}
                      </Link>
                    </Td>
                    <Td>{o.supplier?.name ?? '—'}</Td>
                    <Td className="tnum text-[12px]">{formatDate(o.orderDate)}</Td>
                    <Td className="tnum text-[12px]">
                      {o.expectedAt ? formatDate(o.expectedAt) : '—'}
                    </Td>
                    <Td className="tnum text-[12px]">{o.items.length}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-3)]">
                          <div
                            className="h-full rounded-full bg-ok transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="tnum text-[11px] text-[var(--text-2)]">{percent}%</span>
                      </div>
                    </Td>
                    <Td className="tnum font-semibold">{formatKWD(toNumber(o.total))}</Td>
                    <Td>
                      <Badge tone={PURCHASE_STATUS[o.status].tone}>
                        {PURCHASE_STATUS[o.status].label}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pagination page={page} total={total} />
    </>
  );
}
