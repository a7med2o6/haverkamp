import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS, PAYMENT_METHOD } from '@/lib/labels';
import type { InvoiceDoc } from '@/lib/invoice-document';
import { cn, formatDate, formatDateTime, formatKWD, formatPhone } from '@/lib/utils';

/**
 * مستند الفاتورة — ورقة A4 أو إيصال حراري بعرض 80مم.
 *
 * نسخة الموظف ونسخة العميل واحدة إلا في ثلاثة: الموظف يرى الكاشير ويضغط
 * على اسم العميل وأمر الشغل، والعميل لا يرى هاتفه (الرابط قد يُعاد
 * توجيهه) ولا روابط لوحةٍ لا يدخلها.
 */
export function InvoiceDocument({
  doc,
  audience,
  format = 'a4',
  customerHref,
  jobHref,
}: {
  doc: InvoiceDoc;
  audience: 'staff' | 'customer';
  format?: 'a4' | 'receipt';
  customerHref?: string;
  jobHref?: string;
}) {
  const staff = audience === 'staff';
  const receipt = format === 'receipt';
  const vehicle = doc.job?.vehicle;
  const car = vehicle
    ? [`${vehicle.make} ${vehicle.model}`, vehicle.year].filter(Boolean).join(' — ')
    : null;

  return (
    <article
      className={cn(
        'invoice-doc mx-auto bg-[var(--surface-1)] text-[var(--text-1)]',
        receipt
          ? 'invoice-receipt w-full max-w-[80mm] rounded-[var(--radius-md)] border border-[var(--line)] p-4 text-[12px]'
          : 'max-w-2xl rounded-[var(--radius-lg)] border border-[var(--line)] p-6 text-[13px] sm:p-8'
      )}
    >
      {/*
        ورق الطابعة الحرارية بعرض 80مم. القاعدة في الصفحة نفسها لا صفحةً
        مسمّاة في التنسيقات: هيكل اللوحة مبنيٌّ بـflex، وكروم لا يطبّق
        الصفحات المسمّاة داخله فيطبع على A4. والطول لا يقبل «auto»، فهذا
        طولٌ احتياطي يطابقه زرّ الطباعة بطول الإيصال الفعلي قبل الطباعة.
      */}
      {receipt && <style>{'@page { size: 80mm 297mm; margin: 3mm; }'}</style>}
      {/* ── الترويسة — div لا header: الطباعة تخفي كل header (ترويسة اللوحة) ── */}
      <div className="flex flex-col items-center gap-1 border-b border-[var(--line)] pb-4 text-center">
        <Image
          src="/assets/logo.png"
          alt="هافركامب"
          width={140}
          height={40}
          className={cn('w-auto object-contain invoice-logo', receipt ? 'h-7' : 'h-9')}
        />
        <p className={cn('font-bold text-[var(--text-0)]', receipt ? 'text-[13px]' : 'text-base')}>
          هافركامب الكويت
        </p>
        {doc.shop.address && <p className="text-[11px] text-[var(--text-2)]">{doc.shop.address}</p>}
        {doc.shop.phone && (
          <p className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
            {doc.shop.phone}
          </p>
        )}
      </div>

      {/* الملغاة تُطبع بحالها — ورقةٌ بلا هذا السطر تُقرأ فاتورةً سارية */}
      {doc.void && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5">
          <p className="font-semibold text-danger">
            {doc.status === 'REFUNDED' ? 'فاتورة مرتجعة — رُدّ ما حُصِّل منها' : 'فاتورة ملغاة'}
          </p>
          {/* السبب ملاحظة موظفين — قد تُكتب بلا تحفّظ، فلا تُرسل للعميل */}
          {staff && doc.void.reason && <p className="mt-0.5">{doc.void.reason}</p>}
          <p className="tnum mt-1 text-[11px] text-[var(--text-2)]">
            {staff && doc.void.by && `${doc.void.by} · `}
            {doc.void.at && formatDateTime(doc.void.at)}
          </p>
        </div>
      )}

      {/* ── رقم الفاتورة وتاريخها ── */}
      <section
        className={cn(
          'mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4',
          receipt && 'flex-col gap-1.5'
        )}
      >
        <Meta label="رقم الفاتورة">
          <span className="tnum text-base font-bold text-[var(--text-0)]" dir="ltr">
            {doc.number}
          </span>
        </Meta>
        <Meta label="تاريخ الإصدار">
          <span className="tnum">{formatDateTime(doc.issuedAt)}</span>
        </Meta>
        <Badge tone={ORDER_STATUS[doc.status].tone}>{ORDER_STATUS[doc.status].label}</Badge>
      </section>

      {/* ── العميل والسيارة ── */}
      <section className={cn('mt-4 grid gap-4', !receipt && car && 'sm:grid-cols-2')}>
        <Meta label="العميل">
          {doc.customer ? (
            <>
              <span className="font-medium text-[var(--text-0)]">
                {customerHref ? (
                  <Link href={customerHref} className="hover:text-accent hover:underline print:no-underline">
                    {doc.customer.name}
                  </Link>
                ) : (
                  doc.customer.name
                )}
              </span>
              {staff && doc.customer.phone && (
                <span className="tnum block text-[12px] text-[var(--text-2)]" dir="ltr">
                  {formatPhone(doc.customer.phone)}
                </span>
              )}
            </>
          ) : (
            'عميل نقدي'
          )}
        </Meta>

        {/* فاتورة الورشة تقول على أيّ سيارة عُمل — لا على «عميل» وحده */}
        {car && (
          <Meta label="السيارة">
            <span className="font-medium text-[var(--text-0)]">{car}</span>
            <span className="block text-[12px] text-[var(--text-2)]">
              {[
                vehicle?.color,
                vehicle?.plateNo && `لوحة ${vehicle.plateNo}`,
                vehicle?.paintCode && `كود اللون ${vehicle.paintCode}`,
                doc.job?.odometer != null && `${doc.job.odometer.toLocaleString('en-US')} كم`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Meta>
        )}
      </section>

      {(doc.job || (staff && doc.cashier)) && (
        <p className="mt-3 text-[12px] text-[var(--text-2)]">
          {doc.job && (
            <>
              أمر الشغل{' '}
              {jobHref ? (
                <Link href={jobHref} className="tnum text-accent hover:underline print:no-underline" dir="ltr">
                  {doc.job.number}
                </Link>
              ) : (
                <span className="tnum text-[var(--text-1)]" dir="ltr">
                  {doc.job.number}
                </span>
              )}
            </>
          )}
          {doc.job && staff && doc.cashier && ' · '}
          {staff && doc.cashier && `الكاشير ${doc.cashier}`}
        </p>
      )}

      {/* ── البنود ── */}
      <section className="mt-4 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
        {receipt ? (
          <ul className="divide-y divide-[var(--line)]">
            {doc.items.map((i) => (
              <li key={i.id} className="px-2.5 py-2">
                <p className="text-[var(--text-0)]">{i.label}</p>
                <p className="tnum mt-0.5 flex justify-between text-[11px] text-[var(--text-2)]">
                  <span>
                    {i.qty} × {formatKWD(i.unitPrice)}
                  </span>
                  <span className="font-semibold text-[var(--text-0)]">{formatKWD(i.total)}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <table className="w-full text-start">
            <thead className="bg-[var(--surface-2)] text-[11px] text-[var(--text-2)]">
              <tr>
                <th className="px-3 py-2 text-start font-medium">الصنف</th>
                <th className="px-3 py-2 text-start font-medium">الكمية</th>
                <th className="px-3 py-2 text-start font-medium">السعر</th>
                <th className="px-3 py-2 text-start font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {doc.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 text-[var(--text-0)]">{i.label}</td>
                  <td className="tnum px-3 py-2">{i.qty}</td>
                  <td className="tnum px-3 py-2">{formatKWD(i.unitPrice)}</td>
                  <td className="tnum px-3 py-2 font-semibold text-[var(--text-0)]">{formatKWD(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── الإجماليات ── */}
      <section className={cn('mt-4 space-y-1.5', !receipt && 'ms-auto max-w-xs')}>
        <Row label="المجموع" value={formatKWD(doc.subtotal)} />
        {doc.discount > 0 && (
          <Row
            label={`الخصم${doc.discountNote ? ` — ${doc.discountNote}` : ''}`}
            value={`− ${formatKWD(doc.discount)}`}
            tone="text-warn"
          />
        )}
        <div className="border-t border-[var(--line)] pt-1.5">
          <Row label="الإجمالي" value={formatKWD(doc.total)} strong />
        </div>
        <Row label="المدفوع" value={formatKWD(doc.paid)} tone="text-ok" />
        {doc.remaining > 0 && (
          <Row label="المتبقي" value={formatKWD(doc.remaining)} tone="text-danger" strong />
        )}
      </section>

      {/* ── المدفوعات ── */}
      {doc.payments.length > 0 && (
        <section className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="mb-2 text-[11px] font-semibold text-[var(--text-2)]">تفاصيل الدفع</p>
          <ul className="space-y-1.5">
            {doc.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={PAYMENT_METHOD[p.method].tone}>{PAYMENT_METHOD[p.method].label}</Badge>
                  <span className="tnum text-[11px] text-[var(--text-2)]">{formatDate(p.receivedAt)}</span>
                  {p.reference && (
                    <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
                      {p.reference}
                    </span>
                  )}
                </span>
                <span className={cn('tnum', p.amount < 0 ? 'text-danger' : 'text-[var(--text-1)]')}>
                  {formatKWD(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── الكفالات — ما يُسأل عنه بعد سنة ── */}
      {doc.job && doc.job.warranties.length > 0 && (
        <section className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="mb-2 text-[11px] font-semibold text-[var(--text-2)]">الكفالات</p>
          <ul className="space-y-1">
            {doc.job.warranties.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="text-[var(--text-0)]">{w.label}</span>
                <span className="tnum text-[11px] text-[var(--text-2)]">
                  <span dir="ltr">{w.certificateNo}</span> · حتى {formatDate(w.endDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.notes && (
        <section className="mt-4 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <p className="mb-1 text-[11px] font-semibold text-[var(--text-2)]">ملاحظات</p>
          <p>{doc.notes}</p>
        </section>
      )}

      {doc.shop.footer && (
        <p className="mt-4 border-t border-[var(--line)] pt-3 text-center text-[11px] text-[var(--text-2)]">
          {doc.shop.footer}
        </p>
      )}
    </article>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'font-bold text-[var(--text-0)]' : 'text-[var(--text-2)]'}>{label}</span>
      <span className={cn('tnum', strong ? 'font-bold text-[var(--text-0)]' : tone ?? 'text-[var(--text-1)]', strong && tone)}>
        {value}
      </span>
    </div>
  );
}
