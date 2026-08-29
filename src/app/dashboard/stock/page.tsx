import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { Pagination } from '@/components/dashboard/pagination';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { STOCK_MOVEMENT } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, formatDateTime, formatKWD, toNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'حركة المخزون' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'IN', label: 'وارد' },
  { key: 'OUT', label: 'صادر' },
  { key: 'ADJUST', label: 'تسويات' },
  { key: 'DAMAGE', label: 'تالف' },
] as const;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string; product?: string }>;
}) {
  await requirePermission('inventory:read');
  const { type = 'all', page: pageParam, product } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.StockMovementWhereInput = {
    ...(type !== 'all' ? { type: type as keyof typeof STOCK_MOVEMENT } : {}),
    ...(product ? { productId: product } : {}),
  };

  const [movements, total, lowStock, stockValue] = await Promise.all([
    db.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { id: true, nameAr: true, unit: true } },
        user: { select: { name: true } },
      },
    }),
    db.stockMovement.count({ where }),
    db.product.findMany({
      where: { isActive: true, trackStock: true, reorderLevel: { gt: 0 } },
      select: { id: true, nameAr: true, unit: true, stockQty: true, reorderLevel: true },
    }),
    db.product.findMany({
      where: { isActive: true, trackStock: true },
      select: { stockQty: true, cost: true },
    }),
  ]);

  // قيمة المخزون بالتكلفة — الرقم الذي يهمّ المحاسب لا سعر البيع
  const value = stockValue.reduce((sum, p) => sum + toNumber(p.stockQty) * toNumber(p.cost), 0);
  const belowReorder = lowStock.filter(
    (p) => toNumber(p.stockQty) <= toNumber(p.reorderLevel)
  );

  return (
    <>
      <PageHeader title="حركة المخزون" description={`${total} حركة مسجّلة`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="قيمة المخزون بالتكلفة" value={formatKWD(value)} icon="Package" />
        <StatCard
          label="أصناف تحت حد الطلب"
          value={belowReorder.length}
          icon="TriangleAlert"
          tone={belowReorder.length > 0 ? 'danger' : undefined}
        />
        <StatCard label="إجمالي الحركات" value={total} icon="ArrowLeftRight" />
      </div>

      {belowReorder.length > 0 && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/[0.07] px-3.5 py-3">
          <p className="mb-1.5 text-[12px] font-semibold text-danger">
            أصناف بلغت حد إعادة الطلب — أنشئ أمر شراء
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-1)]">
            {belowReorder.map((p) => (
              <span key={p.id} className="tnum">
                {p.nameAr}: {toNumber(p.stockQty)} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/stock?type=${f.key}${product ? `&product=${product}` : ''}`}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              type === f.key
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
              <Th>التاريخ</Th>
              <Th>الصنف</Th>
              <Th>النوع</Th>
              <Th>الكمية</Th>
              <Th>الرصيد بعدها</Th>
              <Th>تكلفة الوحدة</Th>
              <Th>المرجع</Th>
              <Th>بواسطة</Th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <EmptyState
                title="لا توجد حركات"
                description="تُسجَّل الحركات تلقائياً عند البيع والاستلام، ويدوياً من صفحة المنتجات"
                colSpan={8}
              />
            ) : (
              movements.map((m) => {
                const outgoing = m.type === 'OUT' || m.type === 'DAMAGE';
                return (
                  <Tr key={m.id}>
                    <Td className="tnum text-[12px]">{formatDateTime(m.createdAt)}</Td>
                    <Td className="text-[var(--text-0)]">
                      <Link
                        href={`/dashboard/stock?type=all&product=${m.product.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {m.product.nameAr}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={STOCK_MOVEMENT[m.type].tone}>
                        {STOCK_MOVEMENT[m.type].label}
                      </Badge>
                    </Td>
                    <Td className="tnum">
                      <span className={outgoing ? 'text-danger' : 'text-ok'}>
                        {outgoing ? '−' : '+'}
                        {toNumber(m.qty)}
                      </span>{' '}
                      <span className="text-[11px] text-[var(--text-2)]">{m.product.unit}</span>
                    </Td>
                    <Td className="tnum font-semibold">{toNumber(m.balance)}</Td>
                    <Td className="tnum text-[12px]">
                      {m.unitCost ? formatKWD(toNumber(m.unitCost)) : '—'}
                    </Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {m.reference ?? '—'}
                    </Td>
                    <Td className="text-[12px] text-[var(--text-2)]">{m.user?.name ?? '—'}</Td>
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
