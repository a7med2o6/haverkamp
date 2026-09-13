import type { JobStatus } from '@/generated/prisma/enums';
import { db } from '@/lib/db';
import { bookingServiceLabel } from '@/lib/intake';
import { kuwaitDayRange } from '@/lib/reminders';
import { dayKey, expiryStatus } from '@/lib/utils';
import {
  OPEN_JOB_STATUSES,
  mostUrgentService,
  type ProfilePerms,
  type Tone,
  type WarrantyRow,
} from '@/app/dashboard/_profile/data';

/*
  «يحتاج انتباه» للسيارة: ما هو واقف الآن قبل ما يُذكَّر به — أمرٌ مفتوح
  عليها، موعدها اليوم، سيرفس كفالتها، ثم كفالةٌ تقترب نهايتها. والمال
  ليس هنا: الفاتورة على صاحبها، وملفّه يذكرها.
*/

/** نافذة «تنتهي قريباً» — الشهر يكفي لاتصالٍ يعرض التجديد قبل الفوات */
const EXPIRING_DAYS = 30;

export type VehicleAttentionItem =
  | {
      kind: 'job';
      id: string;
      number: string;
      status: JobStatus;
      receivedAt: Date;
      owner: string;
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
      warranty: string;
      tone: 'warn' | 'danger';
      label: string;
    }
  | {
      kind: 'expiring';
      id: string;
      warranty: string;
      certificateNo: string;
      label: string;
      tone: Tone;
    };

export async function loadVehicleAttention(
  vehicleId: string,
  /** كفالات السيارة السارية محسوبةً في الصفحة — لا تُقرأ مرّتين */
  rows: WarrantyRow[],
  perms: Pick<ProfilePerms, 'workshop'>,
  now: Date
): Promise<VehicleAttentionItem[]> {
  const today = kuwaitDayRange(dayKey(now));

  const [jobs, bookings] = await Promise.all([
    perms.workshop
      ? db.jobOrder.findMany({
          where: { vehicleId, status: { in: [...OPEN_JOB_STATUSES] } },
          orderBy: { receivedAt: 'asc' },
          select: {
            id: true,
            number: true,
            status: true,
            receivedAt: true,
            customer: { select: { name: true } },
          },
        })
      : [],
    db.booking.findMany({
      where: {
        vehicleId,
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
        service: {
          select: { translations: { where: { locale: 'ar' }, select: { name: true } } },
        },
      },
    }),
  ]);

  const urgent = mostUrgentService(rows);
  const service =
    urgent && (urgent.service.tone === 'warn' || urgent.service.tone === 'danger')
      ? [
          {
            kind: 'service' as const,
            warranty: urgent.row.name,
            tone: urgent.service.tone,
            label: urgent.service.label,
          },
        ]
      : [];

  const expiring = rows.flatMap((row) => {
    const expiry = expiryStatus(row.endDate);
    return expiry.days !== null && expiry.days >= 0 && expiry.days <= EXPIRING_DAYS
      ? [
          {
            kind: 'expiring' as const,
            id: row.id,
            warranty: row.name,
            certificateNo: row.certificateNo,
            label: expiry.label,
            tone: expiry.tone,
          },
        ]
      : [];
  });

  return [
    ...jobs.map((job) => ({
      kind: 'job' as const,
      id: job.id,
      number: job.number,
      status: job.status,
      receivedAt: job.receivedAt,
      owner: job.customer.name,
    })),
    ...bookings.map((booking) => ({
      kind: 'booking' as const,
      id: booking.id,
      code: booking.code,
      detail: bookingServiceLabel(booking),
      scheduledAt: booking.scheduledAt,
    })),
    ...service,
    ...expiring,
  ];
}
