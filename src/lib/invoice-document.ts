import { cache } from 'react';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site-url';
import { warrantyLabel } from '@/lib/intake';
import { toNumber } from '@/lib/utils';

/**
 * مستند الفاتورة — ما يُطبع وما يُرسل للعميل، من مصدر واحد.
 *
 * صفحة اللوحة ونسخة العميل العامة تقرآن من هنا، فلا تقول الورقة شيئاً
 * والرابط شيئاً آخر. وفاتورة الورشة ليست إيصال بقالة: تُذكر فيها السيارة
 * التي عُمل عليها وأمرُ شغلها وكفالاتها — هذا ما يُسأل عنه بعد سنة.
 */

const INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: { receivedAt: 'asc' } },
  customer: { select: { id: true, name: true, phone: true } },
  cashier: { select: { name: true } },
  voidedBy: { select: { name: true } },
} satisfies Prisma.OrderInclude;

const JOB_SELECT = {
  id: true,
  number: true,
  odometer: true,
  vehicle: {
    select: { make: true, model: true, year: true, color: true, plateNo: true, paintCode: true },
  },
  warranties: {
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      certificateNo: true,
      subject: true,
      endDate: true,
      service: { select: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
    },
  },
} satisfies Prisma.JobOrderSelect;

const SETTINGS = [
  'contact.address.ar',
  'contact.phone',
  'pos.receiptFooter.ar',
  'pos.letterhead.top',
  'pos.letterhead.bottom',
  'pos.letterhead.left',
  'pos.letterhead.right',
] as const;

/** هوامش ورق الشركة المقيسة من إطاره — إن غاب الإعداد أو فسد */
const LETTERHEAD_DEFAULT = { top: 40, bottom: 20, left: 16, right: 16 };

/** رقمٌ معقول بالمليمتر أو الافتراضي — «٤٠» بأرقام عربية تُفهم، و٥٠٠ لا تُطبع */
function mmSetting(raw: unknown, fallback: number) {
  const text = String(raw ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 120 ? n : fallback;
}

async function load(where: Prisma.OrderWhereUniqueInput) {
  const order = await db.order.findUnique({ where, include: INCLUDE });
  if (!order) return null;

  // الملغاة انفكّت عن أمرها — فيُقرأ أمرُها من الأثر الذي حُفظ
  const jobId = order.jobOrderId ?? order.formerJobOrderId;
  const [job, settings] = await Promise.all([
    jobId ? db.jobOrder.findUnique({ where: { id: jobId }, select: JOB_SELECT }) : null,
    db.siteSetting.findMany({ where: { key: { in: [...SETTINGS] } } }),
  ]);
  const raw = (key: (typeof SETTINGS)[number]) => settings.find((s) => s.key === key)?.value;
  const setting = (key: (typeof SETTINGS)[number]) => (raw(key) as string | undefined) ?? '';

  const voided = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const total = toNumber(order.total);
  const paid = toNumber(order.paidAmount);

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    channel: order.channel,
    issuedAt: order.createdAt,
    shareToken: order.shareToken,
    receiptSentAt: order.receiptSentAt,
    receiptError: order.receiptError,
    voided,
    void: voided
      ? {
          reason: order.voidReason,
          by: order.voidedBy?.name ?? null,
          at: order.voidedAt,
        }
      : null,
    customer: order.customer,
    cashier: order.cashier?.name ?? null,
    job: job
      ? {
          id: job.id,
          number: job.number,
          // الرابط الحيّ لأمرٍ ما زالت فاتورته — والملغاة تذكره أثراً
          current: order.jobOrderId === job.id,
          odometer: job.odometer,
          vehicle: job.vehicle,
          warranties: job.warranties.map((w) => ({
            id: w.id,
            certificateNo: w.certificateNo,
            label: warrantyLabel(w),
            endDate: w.endDate,
          })),
        }
      : null,
    items: order.items.map((i) => ({
      id: i.id,
      label: i.label,
      spec: i.spec,
      typeCode: i.typeCode,
      qty: toNumber(i.qty),
      unitPrice: toNumber(i.unitPrice),
      total: toNumber(i.total),
    })),
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discountAmount),
    discountNote: order.discountNote,
    tax: toNumber(order.taxAmount),
    total,
    paid,
    // لا «متبقٍّ» على ما أُلغي — لم يعد يُطالَب فيه بشيء
    remaining: voided ? 0 : Math.round((total - paid) * 1000) / 1000,
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: toNumber(p.amount),
      reference: p.reference,
      receivedAt: p.receivedAt,
    })),
    notes: order.notes,
    shop: {
      address: setting('contact.address.ar'),
      phone: setting('contact.phone'),
      footer: setting('pos.receiptFooter.ar'),
      letterhead: {
        top: mmSetting(raw('pos.letterhead.top'), LETTERHEAD_DEFAULT.top),
        bottom: mmSetting(raw('pos.letterhead.bottom'), LETTERHEAD_DEFAULT.bottom),
        left: mmSetting(raw('pos.letterhead.left'), LETTERHEAD_DEFAULT.left),
        right: mmSetting(raw('pos.letterhead.right'), LETTERHEAD_DEFAULT.right),
      },
    },
  };
}

export type InvoiceDoc = NonNullable<Awaited<ReturnType<typeof load>>>;

/**
 * مفتاح نسخة العميل — يُنشأ عند الحاجة إليه أول مرة (طباعةٌ فيها رمز
 * الاستجابة، أو إرسالٌ بالواتساب) ثم يبقى. مشروطٌ بخلوّه: طلبان متزامنان
 * لا يولّدان مفتاحين يُبطل أحدهما الآخر.
 */
export async function ensureShareToken(orderId: string): Promise<string> {
  const current = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { shareToken: true },
  });
  if (current.shareToken) return current.shareToken;

  await db.order.updateMany({
    where: { id: orderId, shareToken: null },
    data: { shareToken: randomUUID() },
  });
  const after = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { shareToken: true },
  });
  return after.shareToken!;
}

/** رابط نسخة العميل من الفاتورة */
export function invoiceShareUrl(token: string) {
  return `${siteUrl()}/i/${token}`;
}

/**
 * رمز الاستجابة للفاتورة — يمسحه العميل فيرى نسخته على النظام. يُولَّد
 * للطباعة وحدها: نسخة العميل لا تحتاج رمزاً يعيده إلى نفسه.
 */
export async function invoiceQr(orderId: string) {
  const token = await ensureShareToken(orderId);
  return qrSvg(invoiceShareUrl(token));
}

/** للوحة — بالمعرّف */
export const getInvoiceById = cache((id: string) => load({ id }));

/** لنسخة العميل — بالمفتاح وحده، ولا مفتاح فارغ يطابق شيئاً */
export const getInvoiceByToken = cache((token: string) =>
  token ? load({ shareToken: token }) : Promise.resolve(null)
);
