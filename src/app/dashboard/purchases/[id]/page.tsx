import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { PURCHASE_STATUS } from '@/lib/labels';
import { dateOnlyToInput, formatDate, formatKWD, toNumber } from '@/lib/utils';
import {
  DeletePurchaseItemButton,
  EditPurchaseButton,
  PurchaseItemForm,
  PurchaseStatusButtons,
  ReceiveButton,
} from '../purchase-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const po = await db.purchaseOrder.findUnique({ where: { id }, select: { number: true } });
  return { title: po?.number ?? 'أمر شراء' };
}

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('inventory:read');
  const { id } = await params;

  const [order, suppliers, products] = await Promise.all([
    db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true }, orderBy: { id: 'asc' } },
      },
    }),
    db.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { isActive: true, trackStock: true },
      orderBy: { nameAr: 'asc' },
      select: { id: true, nameAr: true, unit: true, cost: true },
    }),
  ]);

  if (!order) notFound();

  const canWrite = can(session.user.role, 'inventory:write');
  const subtotal = toNumber(order.subtotal);
  const shipping = toNumber(order.shipping);
  const editable = order.status !== 'RECEIVED' && order.status !== 'CANCELLED';

  return (
    <>
      <Link
        href="/dashboard/purchases"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى أوامر الشراء
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="tnum text-xl font-bold text-[var(--text-0)] sm:text-2xl" dir="ltr">
              {order.number}
            </h1>
            <Badge tone={PURCHASE_STATUS[order.status].tone}>
              {PURCHASE_STATUS[order.status].label}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            طُلب {formatDate(order.orderDate)}
            {order.expectedAt && ` · متوقّع ${formatDate(order.expectedAt)}`}
            {order.receivedAt && ` · استُلم ${formatDate(order.receivedAt)}`}
          </p>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <EditPurchaseButton
                order={{
                  id: order.id,
                  supplierId: order.supplierId ?? '',
                  expectedAt: dateOnlyToInput(order.expectedAt),
                  shipping: String(shipping),
                  notes: order.notes ?? '',
                }}
                suppliers={suppliers}
              />
            )}
            <PurchaseStatusButtons id={order.id} status={order.status} />
            {order.status !== 'CANCELLED' && (
              <ReceiveButton
                purchaseOrderId={order.id}
                items={order.items.map((i) => ({
                  id: i.id,
                  label: i.product.nameAr,
                  unit: i.product.unit,
                  outstanding: toNumber(i.qty) - toNumber(i.receivedQty),
                }))}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>المورّد</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-[13px]">
            {order.supplier ? (
              <>
                <p className="font-medium text-[var(--text-0)]">{order.supplier.name}</p>
                {order.supplier.country && (
                  <p className="text-[12px] text-[var(--text-2)]">{order.supplier.country}</p>
                )}
                {order.supplier.phone && (
                  <p className="tnum text-[12px] text-[var(--text-2)]" dir="ltr">
                    {order.supplier.phone}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[var(--text-2)]">بدون مورّد محدّد</p>
            )}

            <div className="space-y-2 border-t border-[var(--line)] pt-3">
              <Row label="قيمة البنود" value={formatKWD(subtotal)} />
              <Row label="الشحن والجمارك" value={formatKWD(shipping)} />
              <div className="border-t border-[var(--line)] pt-2">
                <Row label="الإجمالي" value={formatKWD(toNumber(order.total))} bold />
              </div>
            </div>

            {shipping > 0 && (
              <p className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                الشحن يُوزَّع على الأصناف بنسبة قيمتها عند الاستلام، فتصبح تكلفة الصنف شاملة وصوله.
              </p>
            )}

            {order.notes && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                <p className="mb-1 text-[11px] font-semibold text-[var(--text-2)]">ملاحظات</p>
                <p className="text-[12px] leading-relaxed text-[var(--text-1)]">{order.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>البنود</CardTitle>
            {canWrite && editable && (
              <PurchaseItemForm
                purchaseOrderId={order.id}
                products={products.map((p) => ({ ...p, cost: toNumber(p.cost) }))}
              />
            )}
          </CardHeader>

          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>الصنف</Th>
                  <Th>المطلوب</Th>
                  <Th>المستلَم</Th>
                  <Th>تكلفة الوحدة</Th>
                  <Th>الإجمالي</Th>
                  {canWrite && editable && <Th />}
                </tr>
              </thead>
              <tbody>
                {order.items.length === 0 ? (
                  <EmptyState
                    title="لا توجد بنود"
                    description="أضف الأصناف المطلوبة من المورّد"
                    colSpan={6}
                  />
                ) : (
                  order.items.map((item) => {
                    const qty = toNumber(item.qty);
                    const got = toNumber(item.receivedQty);
                    return (
                      <Tr key={item.id}>
                        <Td className="text-[var(--text-0)]">
                          {item.product.nameAr}
                          <span className="block text-[11px] text-[var(--text-2)]">
                            {item.product.unit}
                          </span>
                        </Td>
                        <Td className="tnum">{qty}</Td>
                        <Td className="tnum">
                          <span className={got >= qty ? 'text-ok' : got > 0 ? 'text-warn' : ''}>
                            {got}
                          </span>
                        </Td>
                        <Td className="tnum">{formatKWD(toNumber(item.unitCost))}</Td>
                        <Td className="tnum font-semibold">{formatKWD(toNumber(item.total))}</Td>
                        {canWrite && editable && (
                          <Td>{got === 0 && <DeletePurchaseItemButton id={item.id} />}</Td>
                        )}
                      </Tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={bold ? 'font-bold text-[var(--text-0)]' : 'text-[var(--text-2)]'}>
        {label}
      </span>
      <span className={`tnum ${bold ? 'font-bold text-[var(--text-0)]' : 'text-[var(--text-1)]'}`}>
        {value}
      </span>
    </div>
  );
}
