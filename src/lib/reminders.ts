import type { Prisma } from '@/generated/prisma/client';
import { dayKey } from '@/lib/utils';
import { normalizePhone } from '@/lib/whatsapp';
import { bookingServiceLabel } from '@/lib/intake';

/**
 * تذكير الموعد قبل يوم.
 *
 * «قبل يوم» هنا يوم تقويمي لا أربع وعشرون ساعة: التذكير يُرسل صباحاً عن
 * حجوزات الغد كلها، فالعميل صاحب موعد الغد الساعة ثامنة يحتاج تنبيهاً
 * الليلة لا فجر الغد. لذا النافذة تُحسب بيوم الكويت لا بفارق زمني.
 */

/** مفتاح يوم الغد بتوقيت الكويت — الكويت بلا توقيت صيفي فالإضافة آمنة */
export function tomorrowKey(now = new Date()): string {
  return dayKey(new Date(now.getTime() + 86_400_000));
}

/** حدّا يوم كويتي كاملاً بصيغة UTC للاستعلام */
export function kuwaitDayRange(key: string): { start: Date; end: Date } {
  return {
    start: new Date(`${key}T00:00:00.000+03:00`),
    end: new Date(`${key}T23:59:59.999+03:00`),
  };
}

/**
 * حجوزات يوم معيّن التي يعنيها التذكير أصلاً.
 * الملغي ولمن لم يحضر لا معنى لتذكيرهما، ومن صار أمر شغل صار في الورشة.
 */
export function queueWhere(dayKeyValue: string): Prisma.BookingWhereInput {
  const { start, end } = kuwaitDayRange(dayKeyValue);
  return {
    scheduledAt: { gte: start, lte: end },
    status: { in: ['PENDING', 'CONFIRMED'] },
    jobOrder: null,
  };
}

/**
 * المستحقّ للإرسال التلقائي — الطابور ناقصاً ما أُرسل.
 * `reminderSentAt` يمنع التكرار مهما تكرّر تشغيل المهمة المجدولة.
 */
export function dueWhere(dayKeyValue: string): Prisma.BookingWhereInput {
  return { ...queueWhere(dayKeyValue), reminderSentAt: null };
}

/** ما يحتاجه بناء الرسالة — يُستعمل في المهمة المجدولة وفي طابور اللوحة */
export const reminderInclude = {
  customer: { select: { name: true, phone: true } },
  vehicle: { select: { make: true, model: true } },
  service: {
    include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
  },
} satisfies Prisma.BookingInclude;

export type ReminderBooking = Prisma.BookingGetPayload<{
  include: typeof reminderInclude;
}>;

/** رقم العميل المسجّل أو رقم الزائر — بصيغة صالحة للإرسال أو null */
export function reminderPhone(b: ReminderBooking): string | null {
  return normalizePhone(b.customer?.phone ?? b.guestPhone);
}

/** «الأربعاء ٣ سبتمبر · ١٠:٣٠ ص» بتوقيت الكويت */
export function formatReminderWhen(d: Date): string {
  const date = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kuwait',
  }).format(d);

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Kuwait',
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;

  // منتصف الليل يعني «بلا وقت محدّد» في هذا النظام — لا نعِد العميل بساعة
  if (hour === '00' && minute === '00') return date;

  const time = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kuwait',
  }).format(d);

  return `${date} · ${time}`;
}

/** أساس الروابط العامة — لا يصلح المسار النسبي في رسالة واتساب */
function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_URL ||
    'https://haverkampkw.com'
  ).replace(/\/$/, '');
}

/** رابط صفحة التأكيد العامة */
export function confirmUrl(token: string): string {
  return `${siteUrl()}/b/${token}`;
}

/** نصّ رسالة التذكير — المسار الحرّ ومعاينة الموظف قبل الإرسال */
export function buildReminderMessage(b: ReminderBooking, url: string): string {
  const name = b.customer?.name ?? b.guestName ?? 'عميلنا العزيز';
  const service = bookingServiceLabel(b);
  const car = b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : b.guestCar;

  return [
    `مرحباً ${name}،`,
    '',
    'تذكير بموعدك في هافركامب الكويت:',
    `🗓 ${formatReminderWhen(b.scheduledAt)}`,
    service ? `🔧 ${service}` : null,
    car ? `🚗 ${car}` : null,
    '',
    'لتأكيد الموعد اضغط الرابط:',
    url,
    '',
    'لتغيير الموعد أو الاعتذار، ردّ على هذه الرسالة.',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** متغيّرات متن القالب المعتمد بترتيبها: الاسم، الخدمة، الموعد */
export function reminderTemplateVars(b: ReminderBooking): string[] {
  return [
    b.customer?.name ?? b.guestName ?? 'عميلنا العزيز',
    bookingServiceLabel(b) ?? 'خدمة',
    formatReminderWhen(b.scheduledAt),
  ];
}
