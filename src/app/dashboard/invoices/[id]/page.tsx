import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { backTo, withFrom } from '@/lib/back-link';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { ORDER_STATUS, PAYMENT_METHOD } from '@/lib/labels';
import { formatDateTime, formatKWD, toNumber } from '@/lib/utils';
import { PrintButton } from './print-button';
import { CollectPaymentButton } from './collect-button';
import { DiscountButton } from './discount-button';
import { VoidInvoiceButton } from './void-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, select: { number: true } });
  return { title: order?.number ?? 'فاتورة' };
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** من أين جاء الزائر — ليعود إليه لا إلى قائمة القسم */
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requirePermission('pos:read');
  const { id } = await params;
  const back = backTo((await searchParams).from, {
    href: '/dashboard/invoices',
    label: 'العودة إلى الفواتير',
  });
  const here = `/dashboard/invoices/${id}`;
  const canReadCustomer = can(session.user.role, 'crm:read');

  const [order, settings] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { receivedAt: 'asc' } },
        customer: true,
        cashier: { select: { name: true } },
        jobOrder: { select: { id: true, number: true } },
        voidedBy: { select: { name: true } },
      },
    }),
    db.siteSetting.findMany({
      where: { key: { in: ['contact.address.ar', 'contact.phone', 'pos.receiptFooter.ar'] } },
    }),
  ]);

  if (!order) notFound();

  const setting = (key: string) =>
    (settings.find((s) => s.key === key)?.value as string | undefined) ?? '';

  const voided = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  // الملغاة والمرتجعة لا يُطالَب فيها بشيء — لا «متبقٍّ» على ما أُلغي
  const remaining = voided ? 0 : toNumber(order.total) - toNumber(order.paidAmount);
  const canCollect = can(session.user.role, 'pos:write') && !voided;

  /*
    الإلغاء والردّ لمن يملك الحذف في نقطة البيع (المدير فما فوق) لا
    للكاشير: فاتورةٌ يلغيها من أصدرها لا رقيب عليها.
  */
  const canVoid =
    can(session.user.role, 'pos:delete') && !voided && order.channel !== 'SUBSCRIPTION';
  const netByMethod = new Map<(typeof order.payments)[number]['method'], number>();
  for (const p of order.payments) {
    netByMethod.set(p.method, (netByMethod.get(p.method) ?? 0) + toNumber(p.amount));
  }
  const refunds = [...netByMethod]
    .map(([method, amount]) => ({ method, amount: Math.round(amount * 1000) / 1000 }))
    .filter((r) => r.amount > 0);

  // أمر الشغل الذي كانت له قبل إلغائها — أثرٌ يُقرأ لا رابطٌ فريد
  const formerJob = order.formerJobOrderId
    ? await db.jobOrder.findUnique({
        where: { id: order.formerJobOrderId },
        select: { id: true, number: true },
      })
    : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
        >
          <ArrowRight className="size-4" />
          {back.label}
        </Link>
        <div className="flex items-center gap-2">
          {canCollect && (
            <DiscountButton
              orderId={order.id}
              subtotal={toNumber(order.subtotal)}
              taxAmount={toNumber(order.taxAmount)}
              paidAmount={toNumber(order.paidAmount)}
              discountAmount={toNumber(order.discountAmount)}
              discountNote={order.discountNote ?? ''}
            />
          )}
          {canCollect && remaining > 0 && (
            <CollectPaymentButton orderId={order.id} remaining={remaining} />
          )}
          {canVoid && (
            <VoidInvoiceButton
              orderId={order.id}
              number={order.number}
              refunds={refunds}
              isJob={Boolean(order.jobOrderId)}
            />
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <Card className="print:border-0 print:shadow-none">
          {/* ── ترويسة الفاتورة ── */}
          <CardHeader className="flex-col items-center gap-1 text-center">
            <CardTitle className="text-lg">هافركامب الكويت</CardTitle>
            <p className="text-[12px] text-[var(--text-2)]">{setting('contact.address.ar')}</p>
            <p className="tnum text-[12px] text-[var(--text-2)]" dir="ltr">
              {setting('contact.phone')}
            </p>
          </CardHeader>

          <CardBody className="space-y-4">
            {/* الملغاة تُطبع بحالها — ورقةٌ بلا هذا السطر تُقرأ فاتورةً سارية */}
            {voided && (
              <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px]">
                <p className="font-semibold text-danger">
                  {order.status === 'REFUNDED' ? 'فاتورة مرتجعة — رُدّ ما حُصِّل منها' : 'فاتورة ملغاة'}
                </p>
                {order.voidReason && (
                  <p className="mt-0.5 text-[var(--text-1)]">{order.voidReason}</p>
                )}
                <p className="tnum mt-1 text-[11px] text-[var(--text-2)]">
                  {order.voidedBy?.name ?? '—'}
                  {order.voidedAt && ` · ${formatDateTime(order.voidedAt)}`}
                  {formerJob && (
                    <>
                      {' · كانت فاتورة '}
                      <Link
                        href={`/dashboard/job-orders/${formerJob.id}`}
                        className="text-accent hover:underline print:no-underline"
                        dir="ltr"
                      >
                        {formerJob.number}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div>
                <p className="text-[11px] text-[var(--text-2)]">رقم الفاتورة</p>
                <p className="tnum text-base font-bold text-[var(--text-0)]" dir="ltr">
                  {order.number}
                </p>
              </div>
              <div className="text-end">
                <p className="text-[11px] text-[var(--text-2)]">التاريخ</p>
                <p className="tnum text-[13px] text-[var(--text-1)]">
                  {formatDateTime(order.createdAt)}
                </p>
              </div>
              <Badge tone={ORDER_STATUS[order.status].tone}>
                {ORDER_STATUS[order.status].label}
              </Badge>
            </div>

            <div className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <p className="text-[11px] text-[var(--text-2)]">العميل</p>
                {order.customer ? (
                  <>
                    {/* اسم العميل بابُ ملفّه — ولمن لا يملك قراءة العملاء يبقى نصّاً */}
                    <p className="font-medium text-[var(--text-0)]">
                      {canReadCustomer ? (
                        <Link
                          href={withFrom(`/dashboard/customers/${order.customer.id}`, here)}
                          className="hover:text-accent hover:underline print:no-underline"
                        >
                          {order.customer.name}
                        </Link>
                      ) : (
                        order.customer.name
                      )}
                    </p>
                    <p className="tnum text-[12px] text-[var(--text-2)]" dir="ltr">
                      {order.customer.phone}
                    </p>
                  </>
                ) : (
                  <p className="text-[var(--text-1)]">عميل نقدي</p>
                )}
              </div>
              <div className="sm:text-end">
                <p className="text-[11px] text-[var(--text-2)]">الكاشير</p>
                <p className="text-[var(--text-1)]">{order.cashier?.name ?? '—'}</p>
                {order.jobOrder && (
                  <Link
                    href={`/dashboard/job-orders/${order.jobOrder.id}`}
                    className="tnum text-[12px] text-accent hover:underline"
                    dir="ltr"
                  >
                    {order.jobOrder.number}
                  </Link>
                )}
              </div>
            </div>

            {/* ── البنود ── */}
            <TableWrap className="border-[var(--line)]">
              <Table>
                <thead>
                  <tr>
                    <Th>الصنف</Th>
                    <Th>الكمية</Th>
                    <Th>السعر</Th>
                    <Th>الإجمالي</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <Tr key={item.id}>
                      <Td className="text-[var(--text-0)]">{item.label}</Td>
                      <Td className="tnum">{toNumber(item.qty)}</Td>
                      <Td className="tnum">{formatKWD(toNumber(item.unitPrice))}</Td>
                      <Td className="tnum font-semibold">{formatKWD(toNumber(item.total))}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>

            {/* ── الإجماليات ── */}
            <div className="ms-auto max-w-xs space-y-2 text-[13px]">
              <Row label="المجموع" value={formatKWD(toNumber(order.subtotal))} />
              {toNumber(order.discountAmount) > 0 && (
                <Row
                  label={`الخصم${order.discountNote ? ` — ${order.discountNote}` : ''}`}
                  value={`− ${formatKWD(toNumber(order.discountAmount))}`}
                  tone="warn"
                />
              )}
              <div className="border-t border-[var(--line)] pt-2">
                <Row label="الإجمالي" value={formatKWD(toNumber(order.total))} bold />
              </div>
              <Row label="المدفوع" value={formatKWD(toNumber(order.paidAmount))} tone="ok" />
              {remaining > 0 && (
                <Row label="المتبقي" value={formatKWD(remaining)} tone="danger" bold />
              )}
            </div>

            {/* ── المدفوعات ── */}
            {order.payments.length > 0 && (
              <div className="border-t border-[var(--line)] pt-4">
                <p className="mb-2 text-[11px] font-semibold text-[var(--text-2)]">
                  تفاصيل الدفع
                </p>
                <ul className="space-y-1.5">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2">
                        <Badge tone={PAYMENT_METHOD[p.method].tone}>
                          {PAYMENT_METHOD[p.method].label}
                        </Badge>
                        {p.reference && (
                          <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
                            {p.reference}
                          </span>
                        )}
                      </span>
                      <span className="tnum text-[var(--text-1)]">
                        {formatKWD(toNumber(p.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {order.notes && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="mb-1 text-[11px] font-semibold text-[var(--text-2)]">ملاحظات</p>
                <p className="text-[13px] text-[var(--text-1)]">{order.notes}</p>
              </div>
            )}

            <p className="border-t border-[var(--line)] pt-4 text-center text-[12px] text-[var(--text-2)]">
              {setting('pos.receiptFooter.ar')}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'ok' | 'warn' | 'danger';
}) {
  const color =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-[var(--text-1)]';

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={bold ? 'font-bold text-[var(--text-0)]' : 'text-[var(--text-2)]'}>
        {label}
      </span>
      <span className={`tnum ${bold ? 'font-bold text-[var(--text-0)]' : color}`}>{value}</span>
    </div>
  );
}
