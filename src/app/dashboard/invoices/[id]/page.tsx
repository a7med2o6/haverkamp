import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { backTo, withFrom } from '@/lib/back-link';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { getInvoiceById, invoiceQr } from '@/lib/invoice-document';
import { cn } from '@/lib/utils';
import { InvoiceDocument } from '@/components/invoice/invoice-document';
import { LetterheadInvoice } from '@/components/invoice/letterhead-invoice';
import { PrintButton } from './print-button';
import { CollectPaymentButton } from './collect-button';
import { DiscountButton } from './discount-button';
import { VoidInvoiceButton } from './void-button';
import { ShareInvoiceButton } from './share-button';
import { ReceiptStatus } from './receipt-status';

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
  /** من أين جاء الزائر — ليعود إليه؛ وشكل الطباعة: ورق الشركة أو A4 أبيض أو إيصال حراري */
  searchParams: Promise<{ from?: string; format?: string }>;
}) {
  const session = await requirePermission('pos:read');
  const { id } = await params;
  const { from, format } = await searchParams;
  const back = backTo(from, { href: '/dashboard/invoices', label: 'العودة إلى الفواتير' });
  const here = `/dashboard/invoices/${id}`;

  const doc = await getInvoiceById(id);
  if (!doc) notFound();

  const role = session.user.role;
  const canCollect = can(role, 'pos:write') && !doc.voided;

  /*
    الإلغاء والردّ لمن يملك الحذف في نقطة البيع (المدير فما فوق) لا
    للكاشير: فاتورةٌ يلغيها من أصدرها لا رقيب عليها.
  */
  const canVoid = can(role, 'pos:delete') && !doc.voided && doc.channel !== 'SUBSCRIPTION';
  const netByMethod = new Map<(typeof doc.payments)[number]['method'], number>();
  for (const p of doc.payments) {
    netByMethod.set(p.method, (netByMethod.get(p.method) ?? 0) + p.amount);
  }
  const refunds = [...netByMethod]
    .map(([method, amount]) => ({ method, amount: Math.round(amount * 1000) / 1000 }))
    .filter((r) => r.amount > 0);

  // ورق الشركة هو الأصل — الفاتورة الرسمية تُطبع عليه
  const printFormat = format === 'a4' || format === 'receipt' ? format : 'letterhead';
  // تبديل الشكل يحفظ «من أين جاء» — فالعودة تبقى إلى حيث كانت
  const formatHref = (f: 'letterhead' | 'a4' | 'receipt') => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (f !== 'letterhead') q.set('format', f);
    const s = q.toString();
    return s ? `${here}?${s}` : here;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
        >
          <ArrowRight className="size-4" />
          {back.label}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canCollect && (
            <DiscountButton
              orderId={doc.id}
              subtotal={doc.subtotal}
              taxAmount={doc.tax}
              paidAmount={doc.paid}
              discountAmount={doc.discount}
              discountNote={doc.discountNote ?? ''}
            />
          )}
          {canCollect && doc.remaining > 0 && (
            <CollectPaymentButton orderId={doc.id} remaining={doc.remaining} />
          )}
          {canVoid && (
            <VoidInvoiceButton
              orderId={doc.id}
              number={doc.number}
              refunds={refunds}
              isJob={Boolean(doc.job?.current)}
            />
          )}
          {can(role, 'pos:write') && <ShareInvoiceButton orderId={doc.id} />}
          {doc.channel === 'INVOICE' && (
            <ReceiptStatus
              orderId={doc.id}
              status={doc.status}
              receiptSentAt={doc.receiptSentAt}
              receiptError={doc.receiptError}
              canResend={doc.status === 'COMPLETED' && can(role, 'pos:write')}
            />
          )}

          {/* ورق الشركة المطبوع للفواتير الرسمية، والأبيض لغيرها، والإيصال لطابعة الكاشير */}
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--line)] p-0.5 text-[12px]">
            {(
              [
                ['letterhead', 'ورق الشركة'],
                ['a4', 'A4 أبيض'],
                ['receipt', 'إيصال 80مم'],
              ] as const
            ).map(([f, label]) => (
              <Link
                key={f}
                href={formatHref(f)}
                replace
                className={cn(
                  'rounded-[calc(var(--radius-sm)-2px)] px-2.5 py-1 transition-colors',
                  f === printFormat
                    ? 'bg-accent/15 font-semibold text-accent'
                    : 'text-[var(--text-2)] hover:text-[var(--text-0)]'
                )}
              >
                {label}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {printFormat === 'letterhead' ? (
        /* رمزٌ يُمسح فيفتح نسخة العميل — يُولَّد مع أول طباعة ثم يبقى */
        <LetterheadInvoice doc={doc} qr={await invoiceQr(doc.id)} />
      ) : (
      <InvoiceDocument
        doc={doc}
        audience="staff"
        format={printFormat}
        customerHref={
          doc.customer && can(role, 'crm:read')
            ? withFrom(`/dashboard/customers/${doc.customer.id}`, here)
            : undefined
        }
        jobHref={doc.job ? withFrom(`/dashboard/job-orders/${doc.job.id}`, here) : undefined}
      />
      )}
    </>
  );
}
