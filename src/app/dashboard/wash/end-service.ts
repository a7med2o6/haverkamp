import type { Prisma } from '@/generated/prisma/client';
import { AppError } from '@/lib/action-utils';
import { dateOnlyFromInput, dateOnlyToInput, formatDateOnly, toNumber } from '@/lib/utils';

export type WashEndPlan = {
  endDate: string; // 'YYYY-MM-DD' — آخر يوم غسيل مدفوع
  keptPeriods: Array<{
    id: string;
    from: string;
    to: string;
    invoice: string | null;
  }>;
  cancelledInvoices: Array<{
    orderId: string;
    number: string;
    total: number;
    from: string;
    to: string;
  }>;
  removedVisits: number;
  /*
    ما يُحذف يُسمّى بعينه ولا يُستنتج من «ما ليس محفوظاً»: الفترة المدفوعة
    الماضية لا تظهر في keptPeriods، ولو اشتُقّ الحذف من غيابها لمُحيت.
  */
  removedPeriodIds: string[];
};

export type EndingPeriodInput = {
  id: string;
  fromDate: Date;
  toDate: Date;
  status: string;
  order: {
    id: string;
    number: string;
    total: Prisma.Decimal | number;
    paidAmount: Prisma.Decimal | number;
    status: string;
  } | null;
  _count: { visits: number };
};

/**
 * يطبّق قاعدة العمل «ما دُفع يُخدم حتى نهايته، وما لم يُدفع يُلغى».
 * دالة خالية من الجوانب الجانبية والاستعلامات لتيسير فحصها وتأكيدها.
 */
export function planWashEnding(input: {
  today: Date;
  periods: EndingPeriodInput[];
}): { ok: true; plan: WashEndPlan } | { ok: false; reason: string } {
  const { today, periods } = input;

  // الفاتورة المدفوعة جزئياً تُرفض تسويتها آلياً لحماية أصحاب الحقوق
  for (const period of periods) {
    if (period.order) {
      const paid = toNumber(period.order.paidAmount);
      const total = toNumber(period.order.total);
      if (paid > 0 && paid < total) {
        return {
          ok: false,
          reason: `فاتورة ${period.order.number} مدفوعة جزئياً — أكمل تحصيلها أو ردّها قبل إنهاء الاشتراك`,
        };
      }
    }
  }

  const keptPeriods: WashEndPlan['keptPeriods'] = [];
  const cancelledInvoices: WashEndPlan['cancelledInvoices'] = [];
  let removedVisits = 0;
  const removedPeriodIds: string[] = [];
  const paidFutureToDates: Date[] = [];

  for (const period of periods) {
    const total = period.order ? toNumber(period.order.total) : 0;
    const paid = period.order ? toNumber(period.order.paidAmount) : 0;
    const isPaid =
      period.status === 'ELIGIBLE' ||
      period.status === 'CLOSED' ||
      (total > 0 && paid >= total);

    if (isPaid) {
      // المدفوع الماضي تاريخٌ لا يمسّه الإنهاء؛ يُعرض ما سيستمرّ غسيله وحده
      if (period.toDate.getTime() >= today.getTime()) {
        keptPeriods.push({
          id: period.id,
          from: dateOnlyToInput(period.fromDate),
          to: dateOnlyToInput(period.toDate),
          invoice: period.order?.number ?? null,
        });
        paidFutureToDates.push(period.toDate);
      }
    } else {
      // الشاغر لم يُخدم بعد (زياراته محظورة أو موقفة) فيُلغى دون تحريك أموال
      removedVisits += period._count.visits;
      removedPeriodIds.push(period.id);

      if (
        period.order &&
        period.order.status !== 'CANCELLED' &&
        period.order.status !== 'REFUNDED'
      ) {
        cancelledInvoices.push({
          orderId: period.order.id,
          number: period.order.number,
          total: toNumber(period.order.total),
          from: dateOnlyToInput(period.fromDate),
          to: dateOnlyToInput(period.toDate),
        });
      }
    }
  }

  // تاريخ النهاية هو آخر يوم مدفوع يقع اليوم أو بعده؛ فإن لم يوجد فاليوم
  let latestToDate = today;
  if (paidFutureToDates.length > 0) {
    latestToDate = new Date(
      Math.max(...paidFutureToDates.map((d) => d.getTime()))
    );
  }

  return {
    ok: true,
    plan: {
      endDate: dateOnlyToInput(latestToDate),
      keptPeriods,
      cancelledInvoices,
      removedVisits,
      removedPeriodIds,
    },
  };
}

/**
 * يقرأ فترات الاشتراك وفواتيرها وهيكل زياراتها بما يكفي للحاسبة آلياً.
 */
export async function loadEndingInput(
  tx: Prisma.TransactionClient,
  subscriptionId: string
): Promise<EndingPeriodInput[]> {
  return tx.washSubscriptionPeriod.findMany({
    where: { subscriptionId },
    select: {
      id: true,
      fromDate: true,
      toDate: true,
      status: true,
      order: {
        select: {
          id: true,
          number: true,
          total: true,
          paidAmount: true,
          status: true,
        },
      },
      _count: {
        select: { visits: true },
      },
    },
    orderBy: { fromDate: 'asc' },
  });
}

/**
 * يُنفّذ عملية إنهاء اشتراك الغسيل داخل معاملة قاعدة البيانات.
 * ما دُفع يُخدم حتى نهايته، وما لم يُدفع تُسترجع فواتيره وتُلغى زياراته.
 */
export async function executeWashEnding(
  tx: Prisma.TransactionClient,
  params: {
    subscriptionId: string;
    reason: string;
    userId: string | null;
    today: Date;
  }
) {
  const { subscriptionId: id, reason, userId, today } = params;

  const subscription = await tx.washSubscription.findUnique({
    where: { id },
    select: { id: true, code: true, notes: true, status: true, customerId: true },
  });
  if (!subscription) throw new AppError('اشتراك الغسيل غير موجود');
  if (subscription.status === 'ENDED') throw new AppError('الاشتراك منتهٍ بالفعل');

  const periods = await loadEndingInput(tx, id);
  const result = planWashEnding({ today, periods });
  if (!result.ok) throw new AppError(result.reason);

  const plan = result.plan;
  const targetEndDate = dateOnlyFromInput(plan.endDate);

  const noteLine = `أُنهي في ${formatDateOnly(today)}: ${reason}`;
  const newNotes = subscription.notes ? `${subscription.notes}\n${noteLine}` : noteLine;

  const claimed = await tx.washSubscription.updateMany({
    where: { id, status: { not: 'ENDED' } },
    data: {
      status: 'ENDED',
      endDate: targetEndDate,
      notes: newNotes,
    },
  });
  if (claimed.count === 0) throw new AppError('الاشتراك منتهٍ بالفعل');

  for (const inv of plan.cancelledInvoices) {
    const voided = await tx.order.updateMany({
      where: {
        id: inv.orderId,
        paidAmount: 0,
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      data: {
        status: 'CANCELLED',
        voidedAt: new Date(),
        voidReason: `إنهاء اشتراك ${subscription.code}: ${reason}`,
        voidedById: userId,
      },
    });
    if (voided.count === 0) {
      throw new AppError(`تغيّر سداد الفاتورة ${inv.number} — حدّث الصفحة`);
    }
  }

  const unpaidPeriodIds = plan.removedPeriodIds;

  if (unpaidPeriodIds.length > 0) {
    await tx.washVisit.deleteMany({
      where: { periodId: { in: unpaidPeriodIds } },
    });
    await tx.washSubscriptionPeriod.deleteMany({
      where: { id: { in: unpaidPeriodIds } },
    });
  }

  return {
    customerId: subscription.customerId,
    endDateFormatted: formatDateOnly(targetEndDate),
    cancelledInvoices: plan.cancelledInvoices,
  };
}
