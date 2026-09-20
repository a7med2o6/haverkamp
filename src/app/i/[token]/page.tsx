import type { Metadata } from 'next';
import Image from 'next/image';
import { AlertCircle } from 'lucide-react';
import { InvoiceDocument } from '@/components/invoice/invoice-document';
import { getInvoiceByToken } from '@/lib/invoice-document';
import { hasInvoiceAccess, phoneLast4 } from '@/lib/invoice-access';
import { PrintButton } from '@/app/dashboard/invoices/[id]/print-button';
import { VerifyForm } from './verify-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'فاتورتك',
  // نسخةٌ لصاحب الرابط وحده — لا مكان لها في نتائج البحث
  robots: { index: false, follow: false },
};

/**
 * نسخة العميل من الفاتورة — يفتحها من رسالة الواتساب أو بمسح رمزها
 * المطبوع، بلا تسجيل دخول. والرابط وحده لا يكفي: يُسأل فاتحُه عن آخر
 * أربعة أرقام من جوّال صاحب الفاتورة، فما يُعاد توجيهه لا يُقرأ عند غيره.
 *
 * وفاتورةٌ بلا عميلٍ برقم (بيعٌ نقدي عابر) لا شيء فيها يخصّ أحداً ولا شيء
 * نتحقّق به — فتُفتح بالرابط.
 */
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getInvoiceByToken(token);

  if (!doc) {
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-sm text-center">
          <AlertCircle className="mx-auto size-9 text-[var(--text-2)]" />
          <p className="mt-4 text-[14px] text-[var(--text-1)]">
            هذا الرابط غير صالح. تواصل معنا لنرسل لك الفاتورة من جديد.
          </p>
        </div>
      </Shell>
    );
  }

  const guarded = Boolean(phoneLast4(doc.customer?.phone));
  const open = !guarded || (await hasInvoiceAccess(token));

  if (!open) {
    return (
      <Shell>
        <div className="mx-auto w-full max-w-sm pt-16">
          <div className="mb-8 flex justify-center">
            <Image
              src="/assets/logo.png"
              alt="هافركامب"
              width={140}
              height={48}
              priority
              className="invoice-logo h-12 w-auto object-contain"
            />
          </div>
          <div className="login-card rounded-[var(--radius-lg)] p-6">
            <h1 className="text-center text-lg font-bold text-[var(--text-0)]">فاتورتك جاهزة</h1>
            <p className="mt-1.5 mb-6 text-center text-[13px] text-[var(--text-1)]">
              للاطمئنان على خصوصيتك، أكّد أنك صاحب الفاتورة
            </p>
            <VerifyForm token={token} />
          </div>
          <p className="mt-4 text-center text-[12px] text-[var(--text-2)]">
            لا تعرف الرقم المسجّل؟ تواصل معنا وسنرسلها لك.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end print:hidden">
          <PrintButton />
        </div>
        <InvoiceDocument doc={doc} audience="customer" />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-page invoice-public relative min-h-dvh px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="login-glow pointer-events-none absolute inset-0 -z-10 print:hidden"
      />
      {children}
    </main>
  );
}
