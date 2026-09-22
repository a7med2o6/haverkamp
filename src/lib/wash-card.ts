import { cache } from 'react';
import { randomUUID } from 'node:crypto';
import type { WashSkipReason, WashSubscriptionStatus, WashVisitStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { washLocationLine } from '@/app/dashboard/wash/location';
import { todayDateOnly, toNumber } from '@/lib/utils';

/**
 * كارت متابعة اشتراك الغسيل للعميل — ما يراه صاحب الاشتراك في نسخته العامة (/w/[token]).
 *
 * يُقرأ مفتاحه في الذاكرة المؤقتة (cache) فلا يُعَدَّد الاستعلام في الطلب الواحد.
 * وتُحسب أرقام غسلات الشهر وتاريخ تجديده بتوقيت الكويت والـ UTC حمايةً
 * للتاريخ من الانزياح عبر المناطق الزمنية.
 */

async function load(token: string) {
  if (!token) return null;

  const subscription = await db.washSubscription.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      code: true,
      status: true,
      monthlyPrice: true,
      startDate: true,
      endDate: true,
      area: true,
      block: true,
      street: true,
      building: true,
      locationNotes: true,
      lat: true,
      lng: true,
      customer: { select: { name: true, phone: true } },
      vehicle: { select: { make: true, model: true, year: true, plateNo: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        /*
          عقدٌ قديم له عشرات الأشهر وفي كل شهر خمس عشرة غسلة. والصفحة لا
          تعرض إلا شهرها الجاري وستّة قبله، فلا يُجرّ الباقي في كل فتحة.
        */
        take: 7,
        select: {
          id: true,
          year: true,
          month: true,
          fromDate: true,
          toDate: true,
          priceSnapshot: true,
          status: true,
          order: {
            select: {
              id: true,
              total: true,
              paidAmount: true,
              status: true,
            },
          },
          visits: {
            orderBy: { scheduledDate: 'asc' },
            select: {
              id: true,
              scheduledDate: true,
              status: true,
              skipReason: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  if (!subscription) return null;

  const phoneSetting = await db.siteSetting.findUnique({
    where: { key: 'contact.phone' },
    select: { value: true },
  });
  const shopPhone = (phoneSetting?.value as string | undefined) ?? '';

  const today = todayDateOnly();

  /*
    الشهر الحالي هو الذي يضم اليوم (fromDate <= today <= toDate)؛
    فإن لم يوجد فالفترة الأحدث في السجل بحسب (year, month).
  */
  let currentRaw = subscription.periods.find(
    (p) => p.fromDate <= today && today <= p.toDate
  );
  if (!currentRaw && subscription.periods.length > 0) {
    currentRaw = subscription.periods[0];
  }

  let current = null;
  if (currentRaw) {
    const monthLabel = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(currentRaw.year, currentRaw.month - 1, 1)));

    const renewsOn = new Date(currentRaw.toDate.getTime() + 86_400_000);
    const msLeft = currentRaw.toDate.getTime() - today.getTime();
    const daysLeft = Math.max(0, Math.round(msLeft / 86_400_000));

    const priceSnapshot = toNumber(currentRaw.priceSnapshot);
    const orderTotal = currentRaw.order ? toNumber(currentRaw.order.total) : priceSnapshot;
    const orderPaid = currentRaw.order ? toNumber(currentRaw.order.paidAmount) : 0;

    const isFullyPaid =
      currentRaw.status === 'ELIGIBLE' ||
      currentRaw.status === 'CLOSED' ||
      (currentRaw.order ? orderPaid >= orderTotal && orderTotal > 0 : false);

    const doneCount = currentRaw.visits.filter((v) => v.status === 'COMPLETED').length;
    const remainingCount = currentRaw.visits.filter((v) => v.status === 'PLANNED').length;
    const skippedCount = currentRaw.visits.filter((v) => v.status === 'SKIPPED').length;
    const blockedCount = currentRaw.visits.filter((v) => v.status === 'BLOCKED').length;

    const nextPlannedVisit = currentRaw.visits.find(
      (v) => v.status === 'PLANNED' && v.scheduledDate >= today
    );

    current = {
      id: currentRaw.id,
      year: currentRaw.year,
      month: currentRaw.month,
      monthLabel,
      fromDate: currentRaw.fromDate,
      toDate: currentRaw.toDate,
      renewsOn,
      daysLeft,
      price: {
        due: orderTotal,
        paid: orderPaid,
        isFullyPaid,
      },
      counts: {
        done: doneCount,
        remaining: remainingCount,
        skipped: skippedCount,
        blocked: blockedCount,
        total: currentRaw.visits.length,
      },
      nextWash: nextPlannedVisit
        ? {
            id: nextPlannedVisit.id,
            scheduledDate: nextPlannedVisit.scheduledDate,
          }
        : null,
      visits: currentRaw.visits.map((v) => ({
        id: v.id,
        scheduledDate: v.scheduledDate,
        status: v.status as WashVisitStatus,
        skipReason: v.skipReason as WashSkipReason | null,
        completedAt: v.completedAt,
      })),
    };
  }

  // الأشهر السابقة: باقي الفترات (الأحدث أولاً، بحد أقصى 6)
  const historyPeriods = currentRaw
    ? subscription.periods.filter((p) => p.id !== currentRaw.id)
    : subscription.periods;

  const history = historyPeriods.slice(0, 6).map((p) => {
    const monthLabelStr = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(p.year, p.month - 1, 1)));

    return {
      id: p.id,
      year: p.year,
      month: p.month,
      monthLabel: monthLabelStr,
      done: p.visits.filter((v) => v.status === 'COMPLETED').length,
      total: p.visits.length,
    };
  });

  return {
    subscription: {
      id: subscription.id,
      code: subscription.code,
      status: subscription.status as WashSubscriptionStatus,
      monthlyPrice: toNumber(subscription.monthlyPrice),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      location: washLocationLine(subscription),
      locationNotes: subscription.locationNotes,
      lat: subscription.lat !== null ? toNumber(subscription.lat) : null,
      lng: subscription.lng !== null ? toNumber(subscription.lng) : null,
      customer: {
        name: subscription.customer.name,
        phone: subscription.customer.phone,
      },
      vehicle: {
        make: subscription.vehicle.make,
        model: subscription.vehicle.model,
        year: subscription.vehicle.year,
        plateNo: subscription.vehicle.plateNo,
      },
    },
    current,
    history,
    shop: {
      phone: shopPhone,
    },
  };
}

export type WashCardDoc = NonNullable<Awaited<ReturnType<typeof load>>>;

export const getWashCardByToken = cache((token: string) => load(token));

/**
 * توفير مفتاح المشاركة لاشتراك الغسيل عند الحاجة، مع منع السباق التزامني.
 */
export async function ensureWashShareToken(subscriptionId: string): Promise<string> {
  const current = await db.washSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    select: { shareToken: true },
  });
  if (current.shareToken) return current.shareToken;

  await db.washSubscription.updateMany({
    where: { id: subscriptionId, shareToken: null },
    data: { shareToken: randomUUID() },
  });
  const after = await db.washSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    select: { shareToken: true },
  });
  return after.shareToken!;
}
