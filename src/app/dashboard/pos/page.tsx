import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatKWD, toNumber } from '@/lib/utils';
import { PosTerminal, type PosProduct } from './pos-terminal';
import { CloseRegisterButton, OpenRegisterButton } from './register-controls';

export const metadata: Metadata = { title: 'نقطة البيع' };
export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const session = await requirePermission('pos:write');

  const [products, categories, customers, parked, register] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { nameAr: 'asc' }],
      select: {
        id: true,
        sku: true,
        barcode: true,
        nameAr: true,
        price: true,
        unit: true,
        type: true,
        trackStock: true,
        stockQty: true,
        categoryId: true,
      },
    }),
    db.productCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, nameAr: true } }),
    db.customer.findMany({
      where: { isBlocked: false },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, phone: true },
    }),
    // الفواتير المعلّقة القابلة للاستكمال — لا نعرض فواتير أوامر الشغل
    db.order.findMany({
      where: { status: 'DRAFT', channel: 'POS', jobOrderId: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        customer: { select: { name: true } },
        items: {
          select: { productId: true, label: true, qty: true, unitPrice: true, discount: true },
        },
      },
    }),
    db.registerSession.findFirst({
      where: { openedById: session.user.id, closedAt: null },
      orderBy: { openedAt: 'desc' },
      include: { orders: { include: { payments: true } } },
    }),
  ]);

  // إجمالي المقبوضات النقدية خلال الوردية المفتوحة
  const cashSales = register
    ? register.orders
        .flatMap((o) => o.payments)
        .filter((p) => p.method === 'CASH')
        .reduce((sum, p) => sum + toNumber(p.amount), 0)
    : 0;

  const posProducts: PosProduct[] = products.map((p) => ({
    ...p,
    price: toNumber(p.price),
    stockQty: toNumber(p.stockQty),
  }));

  return (
    <>
      <PageHeader
        title="نقطة البيع"
        description={
          register
            ? `وردية مفتوحة · مبيعات نقدية ${formatKWD(cashSales)}`
            : 'لا توجد وردية مفتوحة'
        }
        actions={
          <div className="flex items-center gap-2">
            {register ? (
              <>
                <Badge tone="ok">وردية مفتوحة</Badge>
                <CloseRegisterButton
                  id={register.id}
                  openingFloat={toNumber(register.openingFloat)}
                  cashSales={cashSales}
                />
              </>
            ) : (
              <OpenRegisterButton />
            )}
          </div>
        }
      />

      <PosTerminal
        products={posProducts}
        categories={categories}
        customers={customers}
        parkedOrders={parked.map((o) => ({
          id: o.id,
          number: o.number,
          createdAt: formatDateTime(o.createdAt),
          customerName: o.customer?.name ?? null,
          total: toNumber(o.total),
          items: o.items.map((i) => ({
            productId: i.productId,
            label: i.label,
            qty: toNumber(i.qty),
            unitPrice: toNumber(i.unitPrice),
            discount: toNumber(i.discount),
          })),
        }))}
        hasOpenRegister={!!register}
      />
    </>
  );
}
