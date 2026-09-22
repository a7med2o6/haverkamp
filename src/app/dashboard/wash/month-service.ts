import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { formatDateOnly, todayDateOnly } from '@/lib/utils';

const DAY_MS = 86_400_000;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

/**
 * تُحسب حدود الفترة من يوم مرساة تاريخ بدء العقد لا من غرتي الشهرين.
 *
 * التقيد بأيام الشهر يمنع انكسار التاريخ في الأشهر القصيرة (كشباط/فبراير)،
 * دون أن تُنزح المرساة الأصلية في الأشهر التالية — فالعقد يعود إلى يومه
 * دون انحرافٍ متراكم.
 */
export function washPeriodBounds(
  startDate: Date,
  year: number,
  month: number
): { fromDate: Date; toDate: Date } | null {
  const anchorDay = startDate.getUTCDate();

  const daysInCurrentMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedFromDay = Math.min(anchorDay, daysInCurrentMonth);
  const fromDate = new Date(Date.UTC(year, month - 1, clampedFromDay));

  if (fromDate.getTime() < startDate.getTime()) {
    return null;
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  const daysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const clampedNextDay = Math.min(anchorDay, daysInNextMonth);
  const nextAnchorDate = new Date(Date.UTC(nextYear, nextMonth - 1, clampedNextDay));

  const toDate = new Date(nextAnchorDate.getTime() - DAY_MS);

  return { fromDate, toDate };
}

/**
 * أيام الاستحقاق تُحسب من مرساة العقد نفسها لا من أول الشهر.
 * كل القيم @db.Date عند منتصف ليل UTC، لذلك القسمة على يوم كامل تعطي
 * فرقاً صحيحاً لا يتأثر بتوقيت الخادم أو الانتقال الصيفي.
 */
export function washVisitDates(startDate: Date, fromDate: Date, toDate: Date): Date[] {
  const dates: Date[] = [];

  for (let time = fromDate.getTime(); time <= toDate.getTime(); time += DAY_MS) {
    const wholeDaysFromStart = (time - startDate.getTime()) / DAY_MS;
    /*
      الفرق السالب زوجيٌّ أيضاً في الحساب — و«قبل البداية» ليس يوم استحقاق.
      يقصّ المستدعي النطاق اليوم، لكنّ الدالة مُصدَّرة فتحرس نفسها.
    */
    if (
      wholeDaysFromStart >= 0 &&
      Number.isInteger(wholeDaysFromStart) &&
      wholeDaysFromStart % 2 === 0
    ) {
      dates.push(new Date(time));
    }
  }

  return dates;
}

/**
 * تُحدد السنة والشهر للفترة الأولى التي يجب فتحها فور توقيع العقد.
 *
 * العقد المعقود اليوم يفتح فترته فوراً:
 * 1. إذا كان تاريخ البدء في المستقبل، تُفتح فترة شهر البدء نفسه.
 * 2. إذا كان تاريخ البدء اليوم أو في الماضي، نأخذ الفترة التي تشمل تاريخ اليوم
 *    (فالعقد المرسى على يوم 22 يكون في يوم 5 من الشهر التالي داخل فترة الشهر السابق).
 *    نفحص شهر اليوم التقويمي أولاً، فإن لم تشمل فترته اليومَ فحصنا الشهر السابق.
 */
export function initialPeriodYearMonth(
  startDate: Date,
  today: Date = todayDateOnly()
): { year: number; month: number } {
  if (startDate.getTime() > today.getTime()) {
    return {
      year: startDate.getUTCFullYear(),
      month: startDate.getUTCMonth() + 1,
    };
  }

  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;

  const currentBounds = washPeriodBounds(startDate, currentYear, currentMonth);
  if (
    currentBounds &&
    currentBounds.fromDate.getTime() <= today.getTime() &&
    today.getTime() <= currentBounds.toDate.getTime()
  ) {
    return { year: currentYear, month: currentMonth };
  }

  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;

  return { year: prevYear, month: prevMonth };
}

/**
 * تفتح فترة استحقاق واحدة لعقد غسيل محدد وسنة وشهر محددين.
 *
 * المنطق يُستخرج هنا ليتشارك فيه الإنشاء الفردي للعقد عند توقيعه مع الفتح
 * الجملي الشهري، فتسري قواعد الاستحقاق والفاتورة والزيارات من موضعٍ واحد.
 */
export async function openPeriodForSubscription(
  tx: Prisma.TransactionClient,
  subscription: {
    id: string;
    customerId: string;
    startDate: Date;
    endDate?: Date | null;
    monthlyPrice: Prisma.Decimal | number;
    defaultWasherId?: string | null;
    pauses?: Array<{ fromDate: Date; toDate: Date }>;
  },
  year: number,
  month: number
): Promise<boolean> {
  const bounds = washPeriodBounds(subscription.startDate, year, month);
  if (!bounds) return false;

  const { fromDate } = bounds;
  let { toDate } = bounds;

  if (subscription.endDate) {
    if (fromDate.getTime() > subscription.endDate.getTime()) return false;
    if (toDate.getTime() > subscription.endDate.getTime()) {
      toDate = subscription.endDate;
    }
  }

  const visitDates = washVisitDates(subscription.startDate, fromDate, toDate);
  /*
    اسم البند في الفاتورة يذكر المدى الفعلي للفترة بدل اسم الشهر التقويمي،
    تجنباً لنفس الإيهام الذي عالجه تعديل التواريخ.
  */
  const invoiceLabel = `اشتراك غسيل — ${formatDateOnly(fromDate)} إلى ${formatDateOnly(toDate)}`;

  // نملك المفتاح الفريد للفترة أولاً؛ إن سبقنا طلب متزامن تُلغى الفاتورة معه كلها.
  const period = await tx.washSubscriptionPeriod.create({
    data: {
      subscriptionId: subscription.id,
      year,
      month,
      fromDate,
      toDate,
      priceSnapshot: subscription.monthlyPrice,
      status: 'DUE',
    },
  });

  const order = await tx.order.create({
    data: {
      number: await nextNumber('invoice'),
      channel: 'SUBSCRIPTION',
      status: 'DRAFT',
      customerId: subscription.customerId,
      subtotal: subscription.monthlyPrice,
      total: subscription.monthlyPrice,
      items: {
        create: {
          label: invoiceLabel,
          qty: 1,
          unitPrice: subscription.monthlyPrice,
          total: subscription.monthlyPrice,
        },
      },
    },
  });

  await tx.washSubscriptionPeriod.update({
    where: { id: period.id },
    data: { orderId: order.id },
  });

  const defaultWasherId = subscription.defaultWasherId ?? null;
  const pauses = subscription.pauses ?? [];

  if (visitDates.length > 0) {
    await tx.washVisit.createMany({
      data: visitDates.map((date) => {
        const paused = pauses.some(
          (pause) => pause.fromDate <= date && pause.toDate >= date
        );
        return {
          periodId: period.id,
          dueDate: date,
          scheduledDate: date,
          assignedEmployeeId: defaultWasherId,
          // المدفوع يفتح BLOCKED فقط؛ بدء يوم الإيقاف كـSKIPPED يحفظه بعد الدفع.
          status: paused ? ('SKIPPED' as const) : ('BLOCKED' as const),
          skipReason: paused ? ('CUSTOMER_TRAVEL' as const) : ('UNPAID' as const),
        };
      }),
    });
  }

  return true;
}

export async function openWashMonthRecords(year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  const [subscriptions] = await Promise.all([
    db.washSubscription.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: monthEnd },
        OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      },
      select: {
        id: true,
        customerId: true,
        startDate: true,
        endDate: true,
        monthlyPrice: true,
        defaultWasherId: true,
        pauses: {
          select: { fromDate: true, toDate: true },
        },
        periods: {
          where: { year, month },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  let created = 0;
  let alreadyOpen = 0;
  const subscriptionIds: string[] = [];

  for (const subscription of subscriptions) {
    // الفحص الصريح هو المسار المعتاد؛ قيد التفرّد أدناه يبقى حارس سباق النقرات فقط.
    if (subscription.periods.length > 0) {
      alreadyOpen++;
      continue;
    }

    try {
      const opened = await db.$transaction(async (tx) => {
        return openPeriodForSubscription(tx, subscription, year, month);
      });
      if (opened) {
        created++;
        subscriptionIds.push(subscription.id);
      }
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const existing = await db.washSubscriptionPeriod.findUnique({
        where: { subscriptionId_year_month: { subscriptionId: subscription.id, year, month } },
        select: { id: true },
      });
      if (!existing) throw error;
      alreadyOpen++;
    }
  }

  return { created, alreadyOpen, subscriptionIds };
}
