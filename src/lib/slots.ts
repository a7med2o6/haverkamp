import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { DAY_CODES, dayKey } from '@/lib/utils';

/**
 * مواعيد الحجز المتاحة للعميل.
 *
 * تُولَّد من إعدادات الدوام القائمة (`hr.workDayStart` و`hr.workDayEnd`
 * و`hr.weekend`) لا من جدول مواعيد منفصل — فمصدر واحد للحقيقة يعني أن
 * تعديل ساعات الدوام يسري على حجوزات العملاء بلا خطوة ثانية تُنسى.
 *
 * الدالة نفسها تخدم العرض والتحقّق: الصفحة تبني منها الأزرار، والإجراء
 * يعيد بناءها ليتأكّد أن ما وصله موعد أتيح فعلاً. لا يُوثق بما يرسله
 * المتصفّح — من عبث بالطلب لا يحجز خارج الدوام ولا في خانة ممتلئة.
 */

/** الكويت بلا توقيت صيفي، فالإزاحة ثابتة ويصحّ تركيب التواريخ نصّياً */
const KUWAIT_OFFSET = '+03:00';

export interface SlotConfig {
  /** بداية الدوام بالدقائق من منتصف الليل */
  startMin: number;
  endMin: number;
  /** طول الخانة بالدقائق */
  stepMin: number;
  /** أقصى عدد حجوزات في الخانة الواحدة */
  capacity: number;
  /** كم يوماً إلى الأمام يُسمح بالحجز فيه */
  windowDays: number;
  /** أقل مهلة قبل الموعد — لا يُغيّر العميل إلى بعد ساعة */
  leadMin: number;
  /** رموز أيام العطلة: FRI … */
  weekend: string[];
}

export interface Slot {
  /** لحظة الموعد بصيغة ISO — ما يُرسَل إلى الخادم */
  iso: string;
  /** «10:00 ص» */
  label: string;
  full: boolean;
}

export interface SlotDay {
  key: string;
  label: string;
  weekday: string;
  slots: Slot[];
}

const DEFAULTS = {
  start: '10:00',
  end: '20:00',
  stepMin: 60,
  capacity: 3,
  windowDays: 14,
  leadHours: 3,
  weekend: ['FRI'],
};

/** «10:00» → 600 */
function toMinutes(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(mins) && mins >= 0 && mins < 24 * 60 ? mins : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback;
}

/** يقرأ إعدادات الدوام والحجز — وكلٌّ منها له قيمة افتراضية تعمل بلا ضبط */
export async function loadSlotConfig(): Promise<SlotConfig> {
  const rows = await db.siteSetting.findMany({
    where: {
      key: {
        in: [
          'hr.workDayStart',
          'hr.workDayEnd',
          'hr.weekend',
          'bookings.slotCapacity',
          'bookings.windowDays',
          'bookings.slotMinutes',
          'bookings.leadHours',
        ],
      },
    },
  });
  const get = (key: string) => rows.find((r) => r.key === key)?.value;

  const startMin = toMinutes(
    String(get('hr.workDayStart') ?? DEFAULTS.start),
    toMinutes(DEFAULTS.start, 600)
  );
  let endMin = toMinutes(
    String(get('hr.workDayEnd') ?? DEFAULTS.end),
    toMinutes(DEFAULTS.end, 1200)
  );
  // دوام ينتهي قبل أن يبدأ يُنتج صفر خانات — نرجع للافتراضي بدل صفحة فارغة
  if (endMin <= startMin) endMin = toMinutes(DEFAULTS.end, 1200);

  const weekendRaw = get('hr.weekend');
  const weekend = Array.isArray(weekendRaw)
    ? weekendRaw.filter((d): d is string => typeof d === 'string')
    : DEFAULTS.weekend;

  return {
    startMin,
    endMin,
    stepMin: num(get('bookings.slotMinutes'), DEFAULTS.stepMin, 15, 240),
    capacity: num(get('bookings.slotCapacity'), DEFAULTS.capacity, 1, 100),
    windowDays: num(get('bookings.windowDays'), DEFAULTS.windowDays, 1, 120),
    leadMin: num(get('bookings.leadHours'), DEFAULTS.leadHours, 0, 168) * 60,
    weekend,
  };
}

/** يبني لحظة من يوم كويتي ودقائق داخله */
function slotDate(day: string, minutes: number): Date {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return new Date(`${day}T${h}:${m}:00.000${KUWAIT_OFFSET}`);
}

/** دقائق اليوم بتوقيت الكويت للحظة معيّنة */
function kuwaitMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Kuwait',
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kuwait',
  }).format(d);
}

/**
 * يعدّ حجوزات كل خانة في المدى.
 * الحجوزات القديمة قد لا تقع على حدود الخانات، فنُسند كلاًّ منها إلى
 * الخانة التي تحويها — وإلا بدت الخانة فاضية وهي مشغولة.
 */
async function countPerSlot(
  cfg: SlotConfig,
  from: Date,
  to: Date,
  /** حجز يُستثنى من العدّ — صاحب الطلب لا يزاحم نفسه */
  exceptId?: string
): Promise<Map<string, number>> {
  const where: Prisma.BookingWhereInput = {
    scheduledAt: { gte: from, lte: to },
    status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
    ...(exceptId ? { NOT: { id: exceptId } } : {}),
  };

  const rows = await db.booking.findMany({ where, select: { scheduledAt: true } });

  const counts = new Map<string, number>();
  for (const r of rows) {
    const mins = kuwaitMinutes(r.scheduledAt);
    if (mins < cfg.startMin || mins >= cfg.endMin) continue;

    const idx = Math.floor((mins - cfg.startMin) / cfg.stepMin);
    const key = slotDate(dayKey(r.scheduledAt), cfg.startMin + idx * cfg.stepMin).toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** أيام المدى القادم بخاناتها — الأيام الخالية من خانة متاحة تُحذف */
export async function availableSlots(options: {
  now?: Date;
  /** الحجز الجاري تغييره — لا يُحتسب ضمن ازدحام خانته الحالية */
  exceptId?: string;
}): Promise<{ config: SlotConfig; days: SlotDay[] }> {
  const now = options.now ?? new Date();
  const cfg = await loadSlotConfig();

  const earliest = new Date(now.getTime() + cfg.leadMin * 60_000);
  const last = new Date(now.getTime() + cfg.windowDays * 86_400_000);
  const counts = await countPerSlot(cfg, earliest, last, options.exceptId);

  const days: SlotDay[] = [];

  for (let i = 0; i <= cfg.windowDays; i++) {
    const cursor = new Date(now.getTime() + i * 86_400_000);
    const key = dayKey(cursor);
    // اليوم المركّب من مفتاحه يعطي رقم اليوم بتوقيت الكويت لا الخادم
    const local = new Date(`${key}T12:00:00${KUWAIT_OFFSET}`);
    if (cfg.weekend.includes(DAY_CODES[localWeekday(local)])) continue;

    const slots: Slot[] = [];
    for (let m = cfg.startMin; m < cfg.endMin; m += cfg.stepMin) {
      const at = slotDate(key, m);
      if (at < earliest || at > last) continue;

      slots.push({
        iso: at.toISOString(),
        label: fmtTime(at),
        full: (counts.get(at.toISOString()) ?? 0) >= cfg.capacity,
      });
    }

    if (slots.some((s) => !s.full)) {
      days.push({
        key,
        label: new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
          day: 'numeric',
          month: 'long',
          timeZone: 'Asia/Kuwait',
        }).format(local),
        weekday: new Intl.DateTimeFormat('ar-KW', {
          weekday: 'long',
          timeZone: 'Asia/Kuwait',
        }).format(local),
        slots,
      });
    }
  }

  return { config: cfg, days };
}

/** رقم يوم الأسبوع بتوقيت الكويت (0 الأحد … 6 السبت) */
function localWeekday(d: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Kuwait',
  }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/**
 * يتحقّق أن الموعد المطلوب خانة متاحة فعلاً ويعيده.
 * يُعيد البناء من الإعدادات ولا يقبل ما أرسله المتصفّح كما هو.
 */
export async function resolveSlot(
  iso: string,
  options: { now?: Date; exceptId?: string }
): Promise<{ ok: true; at: Date } | { ok: false; error: string }> {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { ok: false, error: 'موعد غير صالح' };

  const { days } = await availableSlots(options);
  const target = at.toISOString();

  for (const day of days) {
    const slot = day.slots.find((s) => s.iso === target);
    if (slot) {
      return slot.full
        ? { ok: false, error: 'امتلأ هذا الموعد للتوّ — اختر موعداً آخر' }
        : { ok: true, at };
    }
  }

  return { ok: false, error: 'هذا الموعد لم يعد متاحاً — اختر موعداً آخر' };
}
