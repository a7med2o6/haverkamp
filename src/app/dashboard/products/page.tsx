import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PRODUCT_TYPE } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, formatKWD, toNumber } from '@/lib/utils';
import { ProductFormButton, StockMovementButton } from './product-form';

export const metadata: Metadata = { title: 'المنتجات' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const session = await requirePermission('inventory:read');
  const { q, page: pageParam, filter } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: 'insensitive' as const } },
            { nameEn: { contains: q, mode: 'insensitive' as const } },
            { sku: { contains: q, mode: 'insensitive' as const } },
            { barcode: { contains: q } },
          ],
        }
      : {}),
  };

  // الأصناف تحت حد الطلب — تحتاج مقارنة عمودين، لذا نجلب معرّفاتها بـ SQL خام
  const lowStockIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM products
    WHERE "isActive" = true AND "trackStock" = true AND "stockQty" <= "reorderLevel"
  `;
  const lowIds = lowStockIds.map((r) => r.id);

  if (filter === 'low') where.id = { in: lowIds };

  const [products, total, categories, services, stockValue, productCount] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { nameAr: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { nameAr: true } } },
    }),
    db.product.count({ where }),
    db.productCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, nameAr: true } }),
    db.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
    }),
    db.product.findMany({
      where: { trackStock: true, isActive: true },
      select: { stockQty: true, cost: true },
    }),
    db.product.count({ where: { isActive: true } }),
  ]);

  const canWrite = can(session.user.role, 'inventory:write');
  const totalStockValue = stockValue.reduce(
    (sum, p) => sum + toNumber(p.stockQty) * toNumber(p.cost),
    0
  );
  const nextSku = `HK-P-${String(productCount + 1).padStart(4, '0')}`;

  return (
    <>
      <PageHeader
        title="المنتجات والأصناف"
        description={`${total} صنف`}
        actions={
          canWrite ? (
            <ProductFormButton
              categories={categories}
              services={services.map((s) => ({
                id: s.id,
                name: s.translations[0]?.name ?? s.slug,
              }))}
              nextSku={nextSku}
            />
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="أصناف نشطة" value={productCount} icon="Package" />
        <StatCard
          label="تحت حد الطلب"
          value={lowIds.length}
          icon="PackageMinus"
          tone={lowIds.length ? 'warn' : 'neutral'}
          href="/dashboard/products?filter=low"
        />
        <StatCard
          label="قيمة المخزون بالتكلفة"
          value={formatKWD(totalStockValue)}
          icon="Wallet"
          tone="accent"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar placeholder="ابحث بالاسم أو SKU أو الباركود…" className="max-w-md flex-1" />
        {filter === 'low' && (
          <Link
            href="/dashboard/products"
            className="rounded-full border border-warn/40 bg-warn/10 px-3.5 py-1.5 text-[13px] font-medium text-warn"
          >
            تحت حد الطلب — إزالة التصفية ✕
          </Link>
        )}
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>الاسم</Th>
              <Th>التصنيف</Th>
              <Th>النوع</Th>
              <Th>التكلفة</Th>
              <Th>سعر البيع</Th>
              <Th>الرصيد</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <EmptyState
                title={q ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات بعد'}
                description={q ? 'جرّب بحثاً آخر' : 'أضف أول صنف من الزر أعلى الصفحة'}
                colSpan={9}
              />
            ) : (
              products.map((p) => {
                const stock = toNumber(p.stockQty);
                const reorder = toNumber(p.reorderLevel);
                const isLow = p.trackStock && p.isActive && stock <= reorder;
                return (
                  <Tr key={p.id}>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {p.sku}
                    </Td>
                    <Td className="font-medium text-[var(--text-0)]">{p.nameAr}</Td>
                    <Td className="text-[12px]">{p.category?.nameAr ?? '—'}</Td>
                    <Td>
                      <Badge tone={PRODUCT_TYPE[p.type].tone}>{PRODUCT_TYPE[p.type].label}</Badge>
                    </Td>
                    <Td className="tnum text-[12px]">{formatKWD(toNumber(p.cost))}</Td>
                    <Td className="tnum font-semibold">{formatKWD(toNumber(p.price))}</Td>
                    <Td>
                      {p.trackStock ? (
                        <span
                          className={cn(
                            'tnum font-semibold',
                            isLow ? 'text-warn' : 'text-[var(--text-1)]'
                          )}
                        >
                          {stock} {p.unit}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--text-2)]">غير متابَع</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {!p.isActive && <Badge>موقوف</Badge>}
                        {isLow && <Badge tone="warn">إعادة طلب</Badge>}
                        {p.showOnline && <Badge tone="accent">بالموقع</Badge>}
                      </div>
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center gap-0.5">
                          <ProductFormButton
                            categories={categories}
                            services={services.map((s) => ({
                              id: s.id,
                              name: s.translations[0]?.name ?? s.slug,
                            }))}
                            nextSku={nextSku}
                            product={{
                              id: p.id,
                              sku: p.sku,
                              barcode: p.barcode,
                              nameAr: p.nameAr,
                              nameEn: p.nameEn,
                              type: p.type,
                              categoryId: p.categoryId,
                              serviceId: p.serviceId,
                              description: p.description,
                              unit: p.unit,
                              cost: toNumber(p.cost),
                              price: toNumber(p.price),
                              trackStock: p.trackStock,
                              reorderLevel: toNumber(p.reorderLevel),
                              isActive: p.isActive,
                              showOnline: p.showOnline,
                            }}
                          />
                          {p.trackStock && (
                            <StockMovementButton
                              productId={p.id}
                              productName={p.nameAr}
                              unit={p.unit}
                              stockQty={stock}
                            />
                          )}
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

      <Pagination page={page} total={total} />
    </>
  );
}
