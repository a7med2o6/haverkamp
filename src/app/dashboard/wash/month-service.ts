import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';

const DAY_MS = 86_400_000;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
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
  const invoiceLabel = `اشتراك غسيل — ${monthLabel(year, month)}`;

  const subscriptions = await db.washSubscription.findMany({
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
      periods: {
        where: { year, month },
        select: { id: true },
        take: 1,
      },
    },
  });

  let created = 0;
  let alreadyOpen = 0;

  for (const subscription of subscriptions) {
    // الفحص الصريح هو المسار المعتاد؛ قيد التفرّد أدناه يبقى حارس سباق النقرات فقط.
    if (subscription.periods.length > 0) {
      alreadyOpen++;
      continue;
    }

    const fromDate = new Date(
      Math.max(monthStart.getTime(), subscription.startDate.getTime())
    );
    const toDate = new Date(
      Math.min(monthEnd.getTime(), subscription.endDate?.getTime() ?? monthEnd.getTime())
    );
    const visitDates = washVisitDates(subscription.startDate, fromDate, toDate);

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
            data: visitDates.map((date) => ({
              periodId: period.id,
              dueDate: date,
              scheduledDate: date,
              status: 'BLOCKED' as const,
              skipReason: 'UNPAID' as const,
            })),
          });
        }
      });
      created++;
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

  return { created, alreadyOpen };
}
