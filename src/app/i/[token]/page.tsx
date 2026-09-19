import type { Metadata } from 'next';
import { AlertCircle } from 'lucide-react';
import { InvoiceDocument } from '@/components/invoice/invoice-document';
import { getInvoiceByToken } from '@/lib/invoice-document';
import { PrintButton } from '@/app/dashboard/invoices/[id]/print-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'فاتورتك',
  // نسخةٌ لصاحب الرابط وحده — لا مكان لها في نتائج البحث
  robots: { index: false, follow: false },
};

/**
 * نسخة العميل من الفاتورة — يفتحها من رسالة الواتساب بلا تسجيل دخول،
 * فالمفتاح وحده بابها. تعرض الفاتورة كما هي اليوم: تحصيلٌ لاحق يظهر،
 * وإلغاءٌ يظهر. ولا هاتف فيها ولا اسم كاشير ولا روابط لوحة — الرابط قد
 * يُعاد توجيهه.
 */
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getInvoiceByToken(token);

  return (
    <main className="login-page invoice-public relative min-h-dvh px-4 py-8 sm:py-12">
      <div aria-hidden className="login-glow pointer-events-none absolute inset-0 -z-10 print:hidden" />
      {doc ? (
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex justify-end print:hidden">
            <PrintButton />
          </div>
          <InvoiceDocument doc={doc} audience="customer" />
        </div>
      ) : (
        <div className="mx-auto mt-24 max-w-sm text-center">
          <AlertCircle className="mx-auto size-9 text-[var(--text-2)]" />
          <p className="mt-4 text-[14px] text-[var(--text-1)]">
            هذا الرابط غير صالح. تواصل معنا لنرسل لك الفاتورة من جديد.
          </p>
        </div>
      )}
    </main>
  );
}
