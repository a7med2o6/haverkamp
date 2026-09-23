import { todayDateOnly } from '@/lib/utils';

/**
 * نافذة التعويض المتاحة تبدأ من اليوم وتمتد حتى 7 أيام بعد نهاية فترة الاستحقاق.
 *
 * السببان لاختيار 7 أيام:
 * 1. الغسلة الفائتة في آخر يوم من الفترة يجب أن تجد مكاناً تُقضى فيه بعد نهاية الفترة.
 * 2. تحديد المدى بـ 7 أيام يمنع التعويض من الانجراف ليصبح شهراً إضافياً مجانياً.
 */
export function makeupWindow(
  period: { toDate: Date },
  today: Date = todayDateOnly()
): { earliest: Date; latest: Date } {
  const DAY_MS = 86_400_000;
  const latest = new Date(period.toDate.getTime() + 7 * DAY_MS);
  return { earliest: today, latest };
}

/**
 * فحص أهلية الغسلة للتعويض:
 * - غسلة مخطط لها في الماضي ولم تُسجّل (PLANNED و scheduledDate < today).
 * - غسلة متعذّرة لسبب غير UNPAID (SKIPPED و skipReason !== 'UNPAID').
 *
 * الاستثناء الوحيد: الغسلة المتعذّرة لعدم السداد (UNPAID) لا تُعوض مطلقاً لأنها لم تُستحق أصلًا.
 */
export function isMakeupEligible(
  visit: {
    status: string;
    skipReason: string | null;
    scheduledDate: Date;
  },
  today: Date = todayDateOnly()
): boolean {
  if (visit.status === 'PLANNED' && visit.scheduledDate.getTime() < today.getTime()) {
    return true;
  }
  if (visit.status === 'SKIPPED' && visit.skipReason !== 'UNPAID') {
    return true;
  }
  return false;
}

/**
 * يقترح أقرب يوم متاح للتعويض ابتداءً من اليوم وحتى آخر يوم في نافذة التعويض.
 *
 * يشترط أن يكون اليوم خالياً من أي غسلة سابقة للسيارة (باستثناء المتعذّرة)
 * وألا يقع ضمن أي فترة إيقاف مسجّلة للاشتراك.
 */
export function suggestMakeupDate(args: {
  today: Date;
  latest: Date;
  occupied: Date[];
  pauses: Array<{ fromDate: Date; toDate: Date }>;
}): Date | null {
  const DAY_MS = 86_400_000;
  let current = args.today.getTime();
  const latestTime = args.latest.getTime();

  const occupiedSet = new Set(args.occupied.map((d) => d.getTime()));

  while (current <= latestTime) {
    const isOccupied = occupiedSet.has(current);
    const isPaused = args.pauses.some(
      (p) => p.fromDate.getTime() <= current && current <= p.toDate.getTime()
    );

    if (!isOccupied && !isPaused) {
      return new Date(current);
    }
    current += DAY_MS;
  }

  return null;
}
