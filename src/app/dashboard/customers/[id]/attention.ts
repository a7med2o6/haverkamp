import type { JobStatus } from '@/generated/prisma/enums';
import { db } from '@/lib/db';
import { bookingServiceLabel, serviceStatus, warrantyLabel } from '@/lib/intake';
import { kuwaitDayRange } from '@/lib/reminders';
import { dayKey, toNumber } from '@/lib/utils';
import { TONE_RANK, joinDetail, vehicleLabel, type ProfilePerms } from '@/app/dashboard/_profile/data';

/*
  «يحتاج انتباه» مرتّب بما ينتظر الآن قبل ما يُذكَّر به: السيارة الواقفة
  في الورشة والعميل القادم اليوم أولاً، ثم سيرفس الكفالة، ثم ما عليه من
  فواتير وشهر غسيل. والمصادر تُسأل بقدر الصلاحية: من لا يرى الورشة لا
  تُقرأ أوامرها له، ومن لا يرى الفواتير لا يُعرف له مالٌ على أحد.
*/

export type AttentionItem =
  | {
      kind: 'job';
      id: string;
      number: string;
      vehicle: string | null;
      status: JobStatus;
      receivedAt: Date;
    }
  | {
      kind: 'booking';
      id: string;
      code: string;
      detail: string | null;
      scheduledAt: Date;
    }
  | {
      kind: 'service';
      vehicleId: string;
      vehicle: string;
      plateNo: string | null;
      warranty: string;
      tone: 'warn' | 'danger';
      label: string;
    }
  | {
      kind: 'invoice';
      id: string;
      number: string;
      vehicle: string | null;
      remaining: number;
      createdAt: Date;
    }
  | {
      kind: 'wash';
      subscriptionId: string;
      vehicle: string;
      year: number;
      month: number;
      amount: number;
    };

const OPEN_JOB = ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] as const;

export async function loadAttention(
  customerId: string,
  perms: Pick<ProfilePerms, 'workshop' | 'invoices' | 'wash'>,
  now: Date
): Promise<AttentionItem[]> {
  const today = kuwaitDayRange(dayKey(now));

  const [jobs, bookings, vehicles, invoices, periods] = await Promise.all([
    perms.workshop
      ? db.jobOrder.findMany({
          where: { customerId, status: { in: [...OPEN_JOB] } },
          orderBy: { receivedAt: 'asc' },
          select: {
            id: true,
            number: true,
            status: true,
            receivedAt: true,
            vehicle: { select: { make: true, model: true } },
          },
        })
      : [],
    db.booking.findMany({
      where: {
        customerId,
        scheduledAt: { gte: today.start, lte: today.end },
        status: { in: ['PENDING', 'CONFIRMED'] },
        jobOrder: null,
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        code: true,
        scheduledAt: true,
        serviceKey: true,
        serviceSpec: true,
        vehicle: { select: { make: true, model: true } },
        service: {
          select: { translations: { where: { locale: 'ar' }, select: { name: true } } },
        },
      },
    }),
    db.vehicle.findMany({
      where: {
        customerId,
        // الكفالة لصاحبها الذي دفعها لا لمالك السيارة اليوم — لا ينبَّه مشترٍ بسيرفس كفالةٍ ليست له
        warranties: { some: { customerId, isVoid: false, serviceEveryMonths: { not: null } } },
      },
      select: {
        id: true,
        make: true,
        model: true,
        plateNo: true,
        services: { orderBy: { visitedAt: 'desc' }, take: 1, select: { visitedAt: true } },
        warranties: {
          where: { customerId, isVoid: false, serviceEveryMonths: { not: null } },
          select: {
            subject: true,
            serviceEveryMonths: true,
            startDate: true,
            endDate: true,
            isVoid: true,
            service: {
              select: { translations: { where: { locale: 'ar' }, select: { name: true } } },
            },
          },
        },
      },
    }),
    perms.invoices
      ? db.order.findMany({
          where: {
            customerId,
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            paidAmount: { lt: db.order.fields.total },
            // فاتورة الاشتراك يذكرها سطر شهر الغسيل — لمن يراه — فلا تُذكر مرّتين
            ...(perms.wash ? { channel: { not: 'SUBSCRIPTION' as const } } : {}),
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            number: true,
            total: true,
            paidAmount: true,
            createdAt: true,
            jobOrder: { select: { vehicle: { select: { make: true, model: true } } } },
          },
        })
      : [],
    perms.wash
      ? db.washSubscriptionPeriod.findMany({
          where: { status: 'DUE', subscription: { customerId } },
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
          select: {
            year: true,
            month: true,
            priceSnapshot: true,
            subscription: {
              select: { id: true, vehicle: { select: { make: true, model: true } } },
            },
          },
        })
      : [],
  ]);

  const serviceItems = vehicles
    .flatMap((vehicle) => {
      const lastService = vehicle.services[0]?.visitedAt ?? null;
      const worst = vehicle.warranties
        .map((warranty) => ({ warranty, status: serviceStatus(warranty, lastService, now) }))
        .filter(({ status }) => status.required && (status.tone === 'warn' || status.tone === 'danger'))
        .sort((a, b) => TONE_RANK[b.status.tone] - TONE_RANK[a.status.tone])[0];
      if (!worst) return [];
      return [
        {
          kind: 'service' as const,
          vehicleId: vehicle.id,
          vehicle: `${vehicle.make} ${vehicle.model}`,
          plateNo: vehicle.plateNo,
          warranty: warrantyLabel(worst.warranty),
          tone: worst.status.tone as 'warn' | 'danger',
          label: worst.status.label,
        },
      ];
    })
    .sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);

  return [
    ...jobs.map((job) => ({
      kind: 'job' as const,
      id: job.id,
      number: job.number,
      vehicle: vehicleLabel(job.vehicle),
      status: job.status,
      receivedAt: job.receivedAt,
    })),
    ...bookings.map((booking) => ({
      kind: 'booking' as const,
      id: booking.id,
      code: booking.code,
      detail: joinDetail(vehicleLabel(booking.vehicle), bookingServiceLabel(booking)),
      scheduledAt: booking.scheduledAt,
    })),
    ...serviceItems,
    ...invoices.map((invoice) => ({
      kind: 'invoice' as const,
      id: invoice.id,
      number: invoice.number,
      vehicle: vehicleLabel(invoice.jobOrder?.vehicle),
      remaining:
        Math.round((toNumber(invoice.total) - toNumber(invoice.paidAmount)) * 1000) / 1000,
      createdAt: invoice.createdAt,
    })),
    ...periods.map((period) => ({
      kind: 'wash' as const,
      subscriptionId: period.subscription.id,
      vehicle: `${period.subscription.vehicle.make} ${period.subscription.vehicle.model}`,
      year: period.year,
      month: period.month,
      amount: toNumber(period.priceSnapshot),
    })),
  ];
}
