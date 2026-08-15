import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * تنسيق المبالغ بالدينار الكويتي (3 خانات عشرية).
 * نفرض الأرقام اللاتينية (`-u-nu-latn`) لأنها المعتمدة في الفواتير والتقارير المالية،
 * ولتتطابق مع بقية الأرقام في اللوحة.
 */
export function formatKWD(value: number | string | { toString(): string }, locale = 'ar-KW-u-nu-latn') {
  const n = typeof value === 'number' ? value : Number(value.toString());
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(Number.isFinite(n) ? n : 0);
}

/** رقم بدون رمز العملة */
export function formatNumber(value: number | string | { toString(): string }, digits = 3) {
  const n = typeof value === 'number' ? value : Number(value.toString());
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(d: Date | string | null | undefined, locale = 'ar-KW-u-nu-latn') {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined, locale = 'ar-KW-u-nu-latn') {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/* ── تواريخ بدون وقت (@db.Date) ──────────────────────────────
   Postgres يخزّن هذه الحقول كتاريخ فقط، و Prisma يعيدها كـ Date عند
   منتصف ليل UTC. أي استخدام لـ setHours(0,0,0,0) المحلي ثم toISOString
   يُنقص يوماً كاملاً في الكويت (UTC+3) — لذلك نتعامل معها بـ UTC دائماً. */

/** منتصف ليل UTC لليوم الحالي حسب التقويم المحلي */
export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** يحوّل قيمة <input type="date"> إلى Date عند منتصف ليل UTC */
export function dateOnlyFromInput(value?: string | null): Date {
  if (!value) return todayDateOnly();
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return todayDateOnly();
  return new Date(Date.UTC(y, m - 1, d));
}

/** يحوّل Date إلى صيغة YYYY-MM-DD المطلوبة لحقل <input type="date"> */
export function dateOnlyToInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** عرض تاريخ بدون وقت — يُقرأ بـ UTC حتى لا ينزاح يوماً */
export function formatDateOnly(
  d: Date | string | null | undefined,
  locale = 'ar-KW-u-nu-latn'
) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** عدد السنوات المكتملة منذ تاريخ — للعمر ومدة الخدمة */
export function yearsSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - d.getUTCMonth();
  // لم يمرّ عيد الميلاد/الذكرى بعد هذا العام
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d.getUTCDate())) years--;
  return years < 0 ? null : years;
}

export type ExpiryTone = 'ok' | 'warn' | 'danger' | 'neutral';

/**
 * حالة تاريخ انتهاء وثيقة: منتهية / توشك / سارية.
 * العتبات: 30 يوم = خطر، 90 يوم = تنبيه.
 */
export function expiryStatus(date: Date | string | null | undefined): {
  days: number | null;
  tone: ExpiryTone;
  label: string;
} {
  if (!date) return { days: null, tone: 'neutral', label: 'غير مسجّل' };

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return { days: null, tone: 'neutral', label: 'غير مسجّل' };

  const days = Math.round((d.getTime() - todayDateOnly().getTime()) / 86400000);

  if (days < 0) return { days, tone: 'danger', label: `منتهية منذ ${Math.abs(days)} يوم` };
  if (days === 0) return { days, tone: 'danger', label: 'تنتهي اليوم' };
  if (days <= 30) return { days, tone: 'danger', label: `${days} يوم متبقٍ` };
  if (days <= 90) return { days, tone: 'warn', label: `${days} يوم متبقٍ` };
  return { days, tone: 'ok', label: 'سارية' };
}

/** يحوّل Date إلى صيغة <input type="datetime-local"> بالتوقيت المحلي */
export function toLocalInput(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** تحويل Decimal من Prisma إلى number بأمان للـ client components */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/* ── أسابيع التقويم ─────────────────────────────────────────
   الأسبوع في الكويت يبدأ السبت لا الأحد. */

/** المنطقة الزمنية المرجعية — الأعمال كلها بتوقيت الكويت */
const KUWAIT_TZ = 'Asia/Kuwait';

/**
 * أجزاء التاريخ كما تُرى في الكويت.
 * اللوحة تُصيَّر على الخادم وقد يعمل بأي منطقة، والمواعيد تُخزَّن UTC —
 * فقراءة اليوم بتوقيت الخادم قد تضع حجزاً في عمود اليوم السابق.
 */
function kuwaitParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    timeZone: KUWAIT_TZ,
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: weekdays.indexOf(get('weekday')),
  };
}

/** يوم بتوقيت الكويت كتاريخ محلي للعرض والحساب */
function kuwaitDay(d: Date): Date {
  const { y, m, d: day } = kuwaitParts(d);
  return new Date(y, m - 1, day);
}

/** أول يوم في سبت الأسبوع الذي يقع فيه التاريخ (بتوقيت الكويت) */
export function startOfWeek(d: Date): Date {
  const out = kuwaitDay(d);
  const weekday = kuwaitParts(d).weekday;
  // 6 = السبت — نرجع للخلف حتى نبلغه
  out.setDate(out.getDate() - ((weekday + 1) % 7));
  return out;
}

/** أيام الأسبوع السبعة ابتداءً من السبت */
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** «١٥ أغسطس» للترويسة، بأرقام لاتينية كبقية اللوحة */
export function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    day: 'numeric',
    month: 'long',
  }).format(d);
}

/** اسم اليوم: «السبت» */
export function formatWeekday(d: Date): string {
  return new Intl.DateTimeFormat('ar-KW', { weekday: 'long' }).format(d);
}

/**
 * «10:30 ص» — أو null للحجز بلا وقت محدّد.
 * نقرأ الساعة بتوقيت الكويت لا بتوقيت الخادم: اللوحة تُصيَّر على الخادم
 * وقد يعمل بأي منطقة، فمنتصف الليل محلياً يصير ساعة أخرى عنده.
 */
export function formatBookingTime(d: Date): string | null {
  const fmt = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: KUWAIT_TZ,
  });

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: KUWAIT_TZ,
  }).formatToParts(d);

  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  if (hour === '00' && minute === '00') return null;

  return fmt.format(d);
}

/** مفتاح يوم بتوقيت الكويت — أساس تجميع الحجوزات في أعمدة التقويم */
export function dayKey(d: Date): string {
  const { y, m, d: day } = kuwaitParts(d);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
