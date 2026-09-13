import type { Prisma } from '@/generated/prisma/client';
import type { BadgeProps } from '@/components/ui/badge';
import { withFrom } from '@/lib/back-link';
import { bookingServiceLabel, serviceStatus, warrantyLabel, type ServiceStatus } from '@/lib/intake';
import { BOOKING_STATUS, JOB_STATUS, ORDER_STATUS, PAYMENT_METHOD } from '@/lib/labels';
import { expiryStatus, formatKWD, toNumber } from '@/lib/utils';

/*
  ما تتقاسمه أقسام ملف العميل: الصلاحيات، وتحويل أوامر الشغل والحجوزات
  والفواتير إلى صفٍّ واحد الشكل، وحساب حال الكفالة.
*/

export type Tone = NonNullable<BadgeProps['tone']>;
export type Chip = { label: string; tone: Tone };

export type TabKey = 'overview' | 'cars' | 'work' | 'invoices' | 'wash' | 'contact';

/** ما يراه صاحب الجلسة — يُحسب مرّة في الصفحة ويُمرَّر، فلا يُسأل عنه في كل قسم */
export interface ProfilePerms {
  write: boolean;
  remove: boolean;
  workshop: boolean;
  invoices: boolean;
  wash: boolean;
  washWrite: boolean;
}

export const TONE_RANK: Record<Tone, number> = {
  neutral: 0,
  muted: 0,
  info: 0,
  violet: 0,
  accent: 0,
  ok: 1,
  warn: 2,
  danger: 3,
};

/*
  «عرض المزيد» يزيد الحدّ عشرين عشرين، ويقف عند مئة: ما بعدها بحثٌ في
  أرشيف لا نظرة على عميل، ومكانه صفحة القسم نفسه.
*/
export const PAGE_STEP = 20;
export const PAGE_CAP = 100;

export function parseLimit(value: string | string[] | undefined) {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return PAGE_STEP;
  return Math.min(PAGE_CAP, Math.max(PAGE_STEP, Math.ceil(n / PAGE_STEP) * PAGE_STEP));
}

export function customerHref(id: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return `/dashboard/customers/${id}${query ? `?${query}` : ''}`;
}

export function vehicleLabel(vehicle: { make: string; model: string } | null | undefined) {
  return vehicle ? `${vehicle.make} ${vehicle.model}` : null;
}

export function joinDetail(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(' · ') || null;
}

const MONTH_NAME = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** شهر الاشتراك مخزّن رقمين (السنة والشهر من 1) لا تاريخاً */
export function monthName(year: number, month: number) {
  return MONTH_NAME.format(new Date(Date.UTC(year, month - 1, 1)));
}

/* ─────────────────────────── صفّ النشاط ─────────────────────────── */

export interface ProfileEvent {
  kind: 'job' | 'booking' | 'invoice';
  id: string;
  number: string;
  detail: string;
  date: Date;
  withTime: boolean;
  status: Chip;
  href: string;
  amount?: number;
  /** يُذكر ما دام على الفاتورة شيء — لا للملغاة والمرتجعة */
  remaining?: number;
  payments?: string;
}

export const JOB_EVENT_SELECT = {
  id: true,
  number: true,
  receivedAt: true,
  status: true,
  vehicle: { select: { make: true, model: true } },
} satisfies Prisma.JobOrderSelect;

export const BOOKING_EVENT_SELECT = {
  id: true,
  code: true,
  scheduledAt: true,
  status: true,
  serviceKey: true,
  serviceSpec: true,
  vehicle: { select: { make: true, model: true } },
  service: {
    select: { translations: { where: { locale: 'ar' }, select: { name: true } } },
  },
  jobOrder: { select: { id: true } },
} satisfies Prisma.BookingSelect;

export const ORDER_EVENT_SELECT = {
  id: true,
  number: true,
  createdAt: true,
  status: true,
  total: true,
  paidAmount: true,
  items: { take: 2, select: { label: true } },
  jobOrder: { select: { vehicle: { select: { make: true, model: true } } } },
  washSubscriptionPeriod: { select: { year: true, month: true } },
  payments: { orderBy: { receivedAt: 'asc' }, select: { method: true, amount: true } },
} satisfies Prisma.OrderSelect;

type JobRow = Prisma.JobOrderGetPayload<{ select: typeof JOB_EVENT_SELECT }>;
type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_EVENT_SELECT }>;
type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_EVENT_SELECT }>;

export function jobEvent(job: JobRow, here: string): ProfileEvent {
  return {
    kind: 'job',
    id: job.id,
    number: job.number,
    detail: vehicleLabel(job.vehicle) ?? 'بدون سيارة',
    date: job.receivedAt,
    withTime: false,
    status: JOB_STATUS[job.status],
    href: withFrom(`/dashboard/job-orders/${job.id}`, here),
  };
}

export function bookingEvent(
  booking: BookingRow,
  here: string,
  customerId: string,
  /** أمر الشغل لمن يرى الورشة؛ الكاشير يُحال إلى قائمة الحجوزات لا إلى صفحةٍ مغلقة دونه */
  canOpenJob: boolean
): ProfileEvent {
  return {
    kind: 'booking',
    id: booking.id,
    number: booking.code,
    detail:
      joinDetail(vehicleLabel(booking.vehicle), bookingServiceLabel(booking)) ?? 'بدون خدمة',
    date: booking.scheduledAt,
    withTime: true,
    status: BOOKING_STATUS[booking.status],
    href: booking.jobOrder && canOpenJob
      ? withFrom(`/dashboard/job-orders/${booking.jobOrder.id}`, here)
      : withFrom(`/dashboard/bookings?view=list&customer=${customerId}`, here),
  };
}

export function invoiceEvent(order: OrderRow, here: string): ProfileEvent {
  const total = toNumber(order.total);
  const paid = toNumber(order.paidAmount);
  const live = order.status !== 'CANCELLED' && order.status !== 'REFUNDED';
  const remaining = live ? Math.max(0, Math.round((total - paid) * 1000) / 1000) : 0;
  const period = order.washSubscriptionPeriod;

  return {
    kind: 'invoice',
    id: order.id,
    number: order.number,
    detail: period
      ? `اشتراك غسيل · ${monthName(period.year, period.month)}`
      : (joinDetail(
          vehicleLabel(order.jobOrder?.vehicle),
          order.items.map((item) => item.label).join(' + ') || null
        ) ?? 'بدون بنود'),
    date: order.createdAt,
    withTime: false,
    status: ORDER_STATUS[order.status],
    href: withFrom(`/dashboard/invoices/${order.id}`, here),
    amount: total,
    remaining: remaining > 0 ? remaining : undefined,
    payments:
      order.payments.length > 0
        ? order.payments
            .map((payment) => `${PAYMENT_METHOD[payment.method].label} ${formatKWD(payment.amount)}`)
            .join(' · ')
        : remaining > 0
          ? 'لم يُسدَّد شيء'
          : undefined,
  };
}

const KIND_ORDER: Record<ProfileEvent['kind'], number> = { job: 0, booking: 1, invoice: 2 };

/**
 * الأحدث أولاً، وعند تساوي اللحظة يُفصل بالنوع ثم بالمعرّف — كي لا يتبدّل
 * ترتيب صفّين متساويين بين تحميل وآخر فيبدو أحدهما قد اختفى.
 */
export function newestFirst(a: ProfileEvent, b: ProfileEvent) {
  return (
    b.date.getTime() - a.date.getTime() ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

/* ─────────────────────────── الكفالات ─────────────────────────── */

export const VEHICLE_WARRANTY_SELECT = {
  id: true,
  certificateNo: true,
  subject: true,
  serviceEveryMonths: true,
  startDate: true,
  endDate: true,
  isVoid: true,
  service: {
    select: { translations: { where: { locale: 'ar' }, select: { name: true } } },
  },
} satisfies Prisma.WarrantySelect;

type WarrantyRecord = Prisma.WarrantyGetPayload<{ select: typeof VEHICLE_WARRANTY_SELECT }>;

export interface WarrantyRow {
  id: string;
  certificateNo: string;
  name: string;
  endDate: Date;
  every: number | null;
  /** السيرفس المشروط وحده؛ الكفالة بلا شرط لا سيرفس لها */
  service: ServiceStatus | null;
  badge: Chip;
  /** موعد ما تقوله الشارة — للترتيب بين شارتين من اللون نفسه */
  urgentAt: Date;
}

/**
 * لكل كفالة شارة واحدة: الأسوأ بين حال السيرفس وحال الانتهاء. فكفالةٌ
 * سيرفسها متأخر تقول «متأخر» وإن كان انتهاؤها بعد سنوات، وكفالةٌ تنتهي
 * هذا الشهر تقول ذلك وإن كان سيرفسها في موعده.
 *
 * والسيرفس الذي في موعده لا يأخذ الشارة: خانة السيرفس بجانبها تذكره،
 * فتكرارُه على الكفالة يُخفي عن العين أنها «سارية».
 */
export function warrantyRows(
  warranties: WarrantyRecord[],
  lastService: Date | null,
  now: Date
): WarrantyRow[] {
  return warranties
    .map((warranty) => {
      const service = serviceStatus(warranty, lastService, now);
      const expiry = expiryStatus(warranty.endDate);
      const serviceWins =
        service.required &&
        TONE_RANK[service.tone] >= TONE_RANK.warn &&
        TONE_RANK[service.tone] >= TONE_RANK[expiry.tone];
      return {
        id: warranty.id,
        certificateNo: warranty.certificateNo,
        name: warrantyLabel(warranty),
        endDate: warranty.endDate,
        every: warranty.serviceEveryMonths,
        service: service.required ? service : null,
        badge: serviceWins
          ? { label: service.label, tone: service.tone }
          : { label: expiry.label, tone: expiry.tone },
        urgentAt: serviceWins && service.dueAt ? service.dueAt : warranty.endDate,
      };
    })
    .sort(
      (a, b) =>
        TONE_RANK[b.badge.tone] - TONE_RANK[a.badge.tone] ||
        a.urgentAt.getTime() - b.urgentAt.getTime()
    );
}

/**
 * السيارة الأحوج أولاً: أسوأ شارة، ثم الأقدم موعداً بين المتساويتين لوناً
 * — فمتأخرةٌ منذ شهور لا تنزل تحت متأخرةٍ منذ يومين — ثم المعرّف كي يثبت
 * الترتيب. والسيارة بلا كفالة في الآخر.
 */
export function mostUrgentFirst(
  a: { id: string; rows: WarrantyRow[] },
  b: { id: string; rows: WarrantyRow[] }
) {
  const rank = (rows: WarrantyRow[]) => (rows[0] ? TONE_RANK[rows[0].badge.tone] : -1);
  const at = (rows: WarrantyRow[]) => rows[0]?.urgentAt.getTime() ?? Number.MAX_SAFE_INTEGER;
  return (
    rank(b.rows) - rank(a.rows) ||
    at(a.rows) - at(b.rows) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
