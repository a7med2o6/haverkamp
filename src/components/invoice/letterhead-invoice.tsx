import type { InvoiceDoc } from '@/lib/invoice-document';
import { formatDateTime, formatKWD, formatPhone } from '@/lib/utils';

/**
 * الفاتورة على ورق الشركة الرسمي.
 *
 * الورقة مطبوعٌ عليها الإطار والشعار والتواصل، فلا ترويسة هنا. وهي ورقة
 * رسمية تُسلَّم للعميل: كل خطٍّ أسود وكل حرفٍ أسود — الرماديّ الفاتح
 * والملوّن يبهت على الطابعة الليزرية، وقد اختفت به بيانات من قبل.
 *
 * المعاينة على الشاشة بمقاس الورقة الحقيقي وصورتها خلفها، فيُرى موقع
 * المحتوى من الإطار قبل الطباعة؛ وعند الطباعة تسقط الصورة وتصير الهوامش
 * هوامشَ الصفحة (يضبطها globals.css ومقاسات الإعدادات).
 */
export function LetterheadInvoice({ doc, qr }: { doc: InvoiceDoc; qr?: string | null }) {
  const m = doc.shop.letterhead;
  const margins = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
  const vehicle = doc.job?.vehicle;
  const car = vehicle
    ? [`${vehicle.make} ${vehicle.model}`, vehicle.year].filter(Boolean).join(' ')
    : null;
  const carLine = [car, vehicle?.color].filter(Boolean).join(' — ');

  return (
    <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
      <style>{`@page { size: A4; margin: ${margins}; }`}</style>
      <div className="invoice-letterhead mx-auto" style={{ padding: margins }}>
        <article className="invoice-doc invoice-doc--letterhead flex h-[237mm] flex-col pb-[8mm] text-[14.5px] text-black">
          {/* ── العنوان، والرقم والتاريخ في مربّعهما ── */}
          <div className="mt-[3mm] flex items-center justify-between gap-6">
            <h1 className="text-[28px] font-bold leading-none">
              فاتورة
              <span className="mt-[1mm] block text-[13px] font-medium tracking-[2px]">INVOICE</span>
            </h1>
            <div className="min-w-[72mm] overflow-hidden rounded-[2.5mm] border-[1.5px] border-black">
              <Stamp label="رقم الفاتورة">
                <span className="tnum text-[18px] font-bold" dir="ltr">
                  {doc.number}
                </span>
              </Stamp>
              <Stamp label="تاريخ الإصدار" divider>
                <span className="tnum text-[15px] font-bold">{formatDateTime(doc.issuedAt)}</span>
              </Stamp>
            </div>
          </div>

          {/* الملغاة تُطبع بحالها — ورقةٌ بلا هذا السطر تُقرأ فاتورةً سارية */}
          {doc.void && (
            <p className="mt-[4mm] border-[1.5px] border-black px-[3mm] py-[2mm] text-[15px] font-bold">
              {doc.status === 'REFUNDED' ? 'فاتورة مرتجعة — رُدّ ما حُصِّل منها' : 'فاتورة ملغاة'}
              {doc.void.reason ? ` — ${doc.void.reason}` : ''}
            </p>
          )}

          {/* ── العميل والسيارة في جدولٍ واحد ── */}
          <SectionTitle>بيانات العميل{car ? ' والسيارة' : ''}</SectionTitle>
          <div className="overflow-hidden rounded-[2.5mm] border-[1.5px] border-black">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <Key>اسم العميل</Key>
                  <Val>{doc.customer?.name ?? 'عميل نقدي'}</Val>
                  <Key divider>رقم الهاتف</Key>
                  <Val>
                    {doc.customer?.phone ? (
                      <span className="tnum" dir="ltr">
                        {formatPhone(doc.customer.phone)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Val>
                </tr>
                {car && (
                  <tr>
                    <Key top>السيارة</Key>
                    <Val top>{carLine}</Val>
                    <Key top divider>
                      رقم اللوحة
                    </Key>
                    <Val top>
                      <span className="tnum" dir="ltr">
                        {vehicle?.plateNo ?? '—'}
                      </span>
                    </Val>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── البنود: النوع برمزه، والوصف تحت الاسم ── */}
          <SectionTitle>تفاصيل الخدمات</SectionTitle>
          <div className="overflow-hidden rounded-[2.5mm] border-[1.5px] border-black">
            <table className="w-full border-collapse">
              <thead>
                <tr className="[&>th]:border-b-[3px] [&>th]:border-double [&>th]:border-black [&>th]:px-[3mm] [&>th]:py-[2.4mm] [&>th]:text-start [&>th]:text-[13.5px] [&>th]:font-bold">
                  <th className="w-[18mm] !text-center">النوع</th>
                  <th>الصنف</th>
                  <th className="w-[16mm] !text-center">الكمية</th>
                  <th className="w-[32mm]">السعر</th>
                  <th className="w-[32mm]">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((i, index) => (
                  <tr
                    key={i.id}
                    className={
                      index > 0
                        ? '[&>td]:border-t [&>td]:border-black [&>td]:px-[3mm] [&>td]:py-[2.8mm]'
                        : '[&>td]:px-[3mm] [&>td]:py-[2.8mm]'
                    }
                  >
                    <td className="text-center text-[14px] font-bold tracking-wide" dir="ltr">
                      {i.typeCode ?? '—'}
                    </td>
                    <td className="border-e border-s border-black">
                      <span className="text-[15px]">{i.label}</span>
                      {i.spec && <span className="mt-[0.8mm] block text-[13px]">{i.spec}</span>}
                    </td>
                    <td className="tnum border-e border-black text-center text-[15px]">{i.qty}</td>
                    <td className="tnum border-e border-black whitespace-nowrap text-[15px]">
                      {formatKWD(i.unitPrice)}
                    </td>
                    <td className="tnum whitespace-nowrap text-[15px] font-bold">
                      {formatKWD(i.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── الإجماليات ── */}
          <div className="ms-auto mt-[5mm] w-[84mm] overflow-hidden rounded-[2.5mm] border-[1.5px] border-black">
            <table className="w-full border-collapse">
              <tbody>
                <Total label="المجموع" value={formatKWD(doc.subtotal)} />
                {doc.discount > 0 && (
                  <Total
                    label={`الخصم${doc.discountNote ? ` — ${doc.discountNote}` : ''}`}
                    value={`− ${formatKWD(doc.discount)}`}
                    top
                  />
                )}
                <Total label="الإجمالي" value={formatKWD(doc.total)} grand />
                {/*
                  الفاتورة تُحصَّل كاملةً — فلا سطر «مدفوع» يُقال. وإن بقي
                  عليها شيء قيل: ورقةٌ تُخفي ديناً أسوأ من سطرٍ زائد.
                */}
                {doc.remaining > 0 && (
                  <Total label="المتبقي" value={formatKWD(doc.remaining)} grand />
                )}
              </tbody>
            </table>
          </div>

          {/* ── التوقيع ورمز الفاتورة ── */}
          <div className="mt-auto flex items-end justify-between gap-[8mm]">
            <div>
              <p className="mb-[11mm] text-[15px] font-bold">توقيع المسؤول</p>
              <div className="w-[68mm] border-b-[1.5px] border-black" />
            </div>

            {qr && (
              <div className="text-center">
                <div
                  className="invoice-qr mx-auto"
                  // svg من مولّد الرموز على الخادم — لا مدخلات مستخدم فيه
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <p className="mt-[1.5mm] text-[11.5px] font-semibold">امسح لعرض فاتورتك</p>
              </div>
            )}

            <p className="text-[13px]">{doc.shop.footer}</p>
          </div>
        </article>
      </div>
    </div>
  );
}

function Stamp({
  label,
  children,
  divider,
}: {
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-[4mm] px-[3.5mm] py-[2mm] ${
        divider ? 'border-t border-black' : ''
      }`}
    >
      <span className="text-[13.5px] font-semibold">{label}</span>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-[6mm] mb-[2mm] text-[13.5px] font-bold">{children}</p>;
}

function Key({
  children,
  top,
  divider,
}: {
  children: React.ReactNode;
  top?: boolean;
  divider?: boolean;
}) {
  return (
    <td
      className={`invoice-shade w-[25mm] whitespace-nowrap px-[3mm] py-[2.3mm] text-[13.5px] font-bold ${
        top ? 'border-t border-black' : ''
      } ${divider ? 'border-s border-black' : ''}`}
    >
      {children}
    </td>
  );
}

function Val({ children, top }: { children: React.ReactNode; top?: boolean }) {
  return (
    <td
      className={`border-s border-black px-[3mm] py-[2.3mm] text-[15px] font-medium ${
        top ? 'border-t' : ''
      }`}
    >
      {children}
    </td>
  );
}

function Total({
  label,
  value,
  top,
  grand,
}: {
  label: string;
  value: string;
  top?: boolean;
  grand?: boolean;
}) {
  const border = grand ? 'border-t-[1.5px] border-black' : top ? 'border-t border-black' : '';
  return (
    <tr className={grand ? 'invoice-shade' : ''}>
      <td className={`px-[3mm] py-[2.2mm] font-semibold ${border} ${grand ? 'text-[18px] font-bold' : 'text-[15px]'}`}>
        {label}
      </td>
      <td
        className={`tnum border-s border-black px-[3mm] py-[2.2mm] text-end whitespace-nowrap ${border} ${
          grand ? 'text-[18px] font-bold' : 'text-[15px]'
        }`}
      >
        {value}
      </td>
    </tr>
  );
}
