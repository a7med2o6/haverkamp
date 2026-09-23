import type { Prisma, WashRenewalDecision } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { AppError } from '@/lib/action-utils';
import { dateOnlyToInput, formatDateOnly, formatKWD, todayDateOnly, toNumber } from '@/lib/utils';
import { siteUrl } from '@/lib/site-url';
import { ensureWashShareToken } from '@/lib/wash-card';
import { openPeriodForSubscription } from './month-service';
import { executeWashEnding } from './end-service';

export const RENEWAL_NOTICE_DAYS = 7;
export const RENEWAL_REMINDER_DAYS = 2;

export type RenewalState = 'NOT_SENT' | 'SENT' | 'REMINDED' | 'RENEWED' | 'DECLINED' | 'NO_REPLY';

export type RenewalRow = {
  subscriptionId: string;
  code: string;
  customerName: string;
  phone: string | null;
  car: string;
  plateNo: string | null;
  price: number;
  period: { id: string; from: string; to: string }; // 'YYYY-MM-DD' — الفترة المنتهية
  daysLeft: number; // toDate − today بالأيام؛ سالب عند انقضائها
  state: RenewalState;
  notifiedAt: string | null; // ISO
  cardUrl: string; // رابط كارت المتابعة /w/<token>
  manualText: string; // نص الواتساب الجاهز للخيار اليدوي wa.me متضمناً الرابط
};

/**
 * يُحدد حالة التجديد للفترة المنتهية بناءً على قرار العميل والتذكيرات وتاريخ اليوم.
 * دالة خالية من الجوانب الجانبية لسهولة الفحص.
 */
export function renewalStateOf(
  period: {
    renewalDecision?: WashRenewalDecision | null;
    renewalNotifiedAt?: Date | string | null;
    renewalRemindedAt?: Date | string | null;
    toDate: Date;
  },
  today: Date = todayDateOnly()
): RenewalState {
  if (period.renewalDecision === 'RENEW') return 'RENEWED';
  if (period.renewalDecision === 'DECLINE') return 'DECLINED';

  const msLeft = period.toDate.getTime() - today.getTime();
  const daysLeft = Math.round(msLeft / 86_400_000);

  if (daysLeft < 0) return 'NO_REPLY';
  if (period.renewalRemindedAt) return 'REMINDED';
  if (period.renewalNotifiedAt) return 'SENT';
  return 'NOT_SENT';
}

/**
 * الفترة التي «تنتهي» والفترة التي «تليها» إن جُدّد العقد.
 *
 * بعد التجديد تصير أحدثُ فترة هي الشهرَ القادم، وقرارُ التجديد مكتوبٌ على
 * التي قبلها. فمن قرأ أحدث فترة وحدها رأى عقداً بلا قرار، ونسي أن صاحبه
 * جدّد: البطاقة تعرض الزرّين من جديد واللوحة تُسقط «جدّد». فتُقرأ الفترتان
 * معاً ما دامت الأحدث لم تبدأ بعد.
 */
export function splitEndingPeriod<P extends { fromDate: Date }>(
  periodsDesc: P[],
  today: Date
): { ending: P | null; next: P | null } {
  const [latest, previous] = periodsDesc;
  if (latest && previous && latest.fromDate.getTime() > today.getTime()) {
    return { ending: previous, next: latest };
  }
  return { ending: latest ?? null, next: null };
}

/**
 * يفحص ما إذا كان تجديد العقد متاحاً (العقد نشط، تنتهي فترته الأخيرة ضمن 7 أيام أو انقضت منذ <= 14 يوماً، ولم يُتخذ قرار بعد).
 */
export function isRenewalOpen(
  subscription: {
    status: string;
    periods: Array<{ fromDate: Date; toDate: Date; renewalDecision?: WashRenewalDecision | null }>;
  },
  today: Date = todayDateOnly()
): boolean {
  if (subscription.status !== 'ACTIVE') return false;
  const { ending: latestPeriod, next } = splitEndingPeriod(subscription.periods, today);
  if (!latestPeriod || next) return false;
  if (latestPeriod.renewalDecision !== null && latestPeriod.renewalDecision !== undefined) {
    return false;
  }

  const msLeft = latestPeriod.toDate.getTime() - today.getTime();
  const daysLeft = Math.round(msLeft / 86_400_000);

  return daysLeft <= RENEWAL_NOTICE_DAYS && daysLeft >= -14;
}

/**
 * يُرجع السنة والشهر للفترة التالية مباشرة.
 */
export function nextPeriodYearMonth(period: { year: number; month: number }): {
  year: number;
  month: number;
} {
  if (period.month === 12) {
    return { year: period.year + 1, month: 1 };
  }
  return { year: period.year, month: period.month + 1 };
}

/**
 * تفتح الفترة التالية للعقد عند موافقة العميل أو طلب الموظف.
 * العملية متكافئة القوة (Idempotent): إن كانت الفترة القادمة مفتوحة مسبقاً
 * تُعاد دون تكرار الفواتير أو الزيارات.
 *
 * التجديد بموافقة العميل: لا يُفتح اشتراك جديد صامتاً دون موافقة حتى لا يُحسب
 * على العميل مالٌ لا يريده، والفاتورة تصدر بمجمّدة (DRAFT) والزيارات محظورة (BLOCKED)
 * حتى تمام السداد.
 */
export async function openNextPeriod(
  tx: Prisma.TransactionClient,
  subscriptionId: string
) {
  const subscription = await tx.washSubscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      status: true,
      customerId: true,
      startDate: true,
      endDate: true,
      monthlyPrice: true,
      defaultWasherId: true,
      pauses: { select: { fromDate: true, toDate: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 2,
        select: {
          id: true,
          year: true,
          month: true,
          fromDate: true,
          toDate: true,
          renewalDecision: true,
          order: { select: { number: true } },
        },
      },
    },
  });

  if (!subscription) throw new AppError('اشتراك الغسيل غير موجود');
  if (subscription.status !== 'ACTIVE') {
    throw new AppError('الاشتراك ليس نشطاً — لا يمكن فتح فترة جديدة لعقد منتهٍ أو موقوف');
  }
  if (subscription.periods.length === 0) {
    throw new AppError('لا توجد فترات سابقة للاشتراك');
  }

  /*
    شهرٌ قادم مفتوح يعني أن التجديد تمّ: يُعاد كما هو. لو قُرئت أحدث فترة
    وحدها لفُتح الشهر الذي بعده — ضغطةُ «جدّد الآن» من موظفٍ بعد تجديد
    العميل كانت تصدر فاتورة شهرٍ ثالث.
  */
  const { ending: latestPeriod, next } = splitEndingPeriod(subscription.periods, todayDateOnly());
  if (!latestPeriod) throw new AppError('لا توجد فترات سابقة للاشتراك');
  if (next) {
    return {
      opened: false,
      fromDate: next.fromDate,
      toDate: next.toDate,
      invoiceNumber: next.order?.number ?? '',
    };
  }
  if (!latestPeriod.renewalDecision) {
    await tx.washSubscriptionPeriod.update({
      where: { id: latestPeriod.id },
      data: {
        renewalDecision: 'RENEW',
        renewalDecidedAt: new Date(),
      },
    });
  }

  const { year: nextYear, month: nextMonth } = nextPeriodYearMonth(latestPeriod);

  const existingNext = await tx.washSubscriptionPeriod.findUnique({
    where: {
      subscriptionId_year_month: {
        subscriptionId,
        year: nextYear,
        month: nextMonth,
      },
    },
    select: {
      id: true,
      fromDate: true,
      toDate: true,
      order: { select: { number: true } },
    },
  });

  if (existingNext) {
    return {
      opened: false,
      fromDate: existingNext.fromDate,
      toDate: existingNext.toDate,
      invoiceNumber: existingNext.order?.number ?? '',
    };
  }

  try {
    const opened = await openPeriodForSubscription(tx, subscription, nextYear, nextMonth);
    const createdNext = await tx.washSubscriptionPeriod.findUnique({
      where: {
        subscriptionId_year_month: {
          subscriptionId,
          year: nextYear,
          month: nextMonth,
        },
      },
      select: {
        fromDate: true,
        toDate: true,
        order: { select: { number: true } },
      },
    });

    return {
      opened,
      fromDate: createdNext?.fromDate ?? new Date(),
      toDate: createdNext?.toDate ?? new Date(),
      invoiceNumber: createdNext?.order?.number ?? '',
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      const existing = await tx.washSubscriptionPeriod.findUnique({
        where: {
          subscriptionId_year_month: {
            subscriptionId,
            year: nextYear,
            month: nextMonth,
          },
        },
        select: {
          fromDate: true,
          toDate: true,
          order: { select: { number: true } },
        },
      });
      if (existing) {
        return {
          opened: false,
          fromDate: existing.fromDate,
          toDate: existing.toDate,
          invoiceNumber: existing.order?.number ?? '',
        };
      }
    }
    throw error;
  }
}

/**
 * تسجّل رغبة العميل في عدم التجديد، وتنهي العقد حسب القواعد التشغيلية
 * (ما دُفع يُخدم حتى نهايته وما لم يُدفع تُسترجع فواتيره وتُلغى زياراته).
 */
export async function recordDecline(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
  today: Date = todayDateOnly()
) {
  const subscription = await tx.washSubscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      status: true,
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1,
        select: { id: true, renewalDecision: true },
      },
    },
  });

  if (!subscription) throw new AppError('اشتراك الغسيل غير موجود');
  if (subscription.status === 'ENDED') throw new AppError('الاشتراك منتهٍ بالفعل');
  if (subscription.periods.length === 0) throw new AppError('لا توجد فترات للاشتراك');

  const latestPeriod = subscription.periods[0];
  if (latestPeriod.renewalDecision !== 'DECLINE') {
    await tx.washSubscriptionPeriod.update({
      where: { id: latestPeriod.id },
      data: {
        renewalDecision: 'DECLINE',
        renewalDecidedAt: new Date(),
      },
    });
  }

  return executeWashEnding(tx, {
    subscriptionId,
    reason: 'لم يرغب العميل في التجديد',
    userId: null,
    today,
  });
}

/**
 * يجلب طابور تجديد الاشتراكات لموظفي الاستقبال.
 *
 * يشمل العقود النشطة التي تنتهي فترتها الحالية خلال نافذة التجديد
 * (من 14 يوماً مضت إلى 7 أيام قادمة)، بالإضافة إلى العقود التي حُسم قرار
 * تجديدها أو عدم تجديدها خلال هذه النافذة ليطلع الموظفون على النتائج.
 */
export async function loadRenewalBoard(
  today: Date = todayDateOnly()
): Promise<RenewalRow[]> {
  const minDate = new Date(today.getTime() - 14 * 86_400_000);
  const maxDate = new Date(today.getTime() + RENEWAL_NOTICE_DAYS * 86_400_000);

  const subscriptions = await db.washSubscription.findMany({
    where: {
      OR: [
        { status: 'ACTIVE' },
        {
          status: 'ENDED',
          periods: { some: { renewalDecision: { not: null } } },
        },
      ],
    },
    select: {
      id: true,
      code: true,
      status: true,
      monthlyPrice: true,
      shareToken: true,
      customer: { select: { name: true, phone: true } },
      vehicle: { select: { make: true, model: true, year: true, plateNo: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 2,
        select: {
          id: true,
          year: true,
          month: true,
          fromDate: true,
          toDate: true,
          renewalNotifiedAt: true,
          renewalRemindedAt: true,
          renewalDecision: true,
          renewalDecidedAt: true,
        },
      },
    },
  });

  const rows: RenewalRow[] = [];

  for (const sub of subscriptions) {
    const { ending: latestPeriod } = splitEndingPeriod(sub.periods, today);
    if (!latestPeriod) continue;

    // الفلترة ضمن النطاق [today - 14, today + RENEWAL_NOTICE_DAYS]
    if (
      latestPeriod.toDate.getTime() < minDate.getTime() ||
      latestPeriod.toDate.getTime() > maxDate.getTime()
    ) {
      continue;
    }

    const token = sub.shareToken ?? (await ensureWashShareToken(sub.id));
    const cardUrl = `${siteUrl()}/w/${token}`;
    const price = toNumber(sub.monthlyPrice);
    const carStr = `${sub.vehicle.make} ${sub.vehicle.model}${
      sub.vehicle.year ? ` ${sub.vehicle.year}` : ''
    }`;

    const msLeft = latestPeriod.toDate.getTime() - today.getTime();
    const daysLeft = Math.round(msLeft / 86_400_000);
    const state = renewalStateOf(latestPeriod, today);

    const manualText = [
      `مرحباً ${sub.customer.name}،`,
      `ينتهي اشتراك غسيل سيارتك (${carStr}) يوم ${formatDateOnly(latestPeriod.toDate)}.`,
      `لتجديده شهراً جديداً بقيمة ${formatKWD(price)} اضغط الرابط:`,
      cardUrl,
    ].join('\n');

    rows.push({
      subscriptionId: sub.id,
      code: sub.code,
      customerName: sub.customer.name,
      phone: sub.customer.phone,
      car: carStr,
      plateNo: sub.vehicle.plateNo,
      price,
      period: {
        id: latestPeriod.id,
        from: dateOnlyToInput(latestPeriod.fromDate),
        to: dateOnlyToInput(latestPeriod.toDate),
      },
      daysLeft,
      state,
      notifiedAt: latestPeriod.renewalNotifiedAt
        ? latestPeriod.renewalNotifiedAt.toISOString()
        : null,
      cardUrl,
      manualText,
    });
  }

  // الترتيب: الأقرب انتهاءً أولاً (soonest first)
  rows.sort((a, b) => a.period.to.localeCompare(b.period.to));

  return rows;
}
