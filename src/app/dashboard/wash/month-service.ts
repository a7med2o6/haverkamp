import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { formatDateOnly } from '@/lib/utils';

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

    const bounds = washPeriodBounds(subscription.startDate, year, month);
    if (!bounds) continue;

    const { fromDate } = bounds;
    let { toDate } = bounds;

    if (subscription.endDate) {
      if (fromDate.getTime() > subscription.endDate.getTime()) continue;
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

    try {
      await db.$transaction(async (tx) => {
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

        if (visitDates.length > 0) {
          await tx.washVisit.createMany({
            data: visitDates.map((date) => {
              const paused = subscription.pauses.some(
                (pause) => pause.fromDate <= date && pause.toDate >= date
              );
              return {
                periodId: period.id,
                dueDate: date,
                scheduledDate: date,
                assignedEmployeeId: subscription.defaultWasherId,
                // المدفوع يفتح BLOCKED فقط؛ بدء يوم الإيقاف كـSKIPPED يحفظه بعد الدفع.
                status: paused ? ('SKIPPED' as const) : ('BLOCKED' as const),
                skipReason: paused ? ('CUSTOMER_TRAVEL' as const) : ('UNPAID' as const),
              };
            }),
          });
        }
      });
      created++;
      subscriptionIds.push(subscription.id);
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

