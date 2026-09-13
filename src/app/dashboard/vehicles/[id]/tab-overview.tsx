import Link from 'next/link';
import { CalendarDays, ShieldCheck, TimerReset, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { withFrom } from '@/lib/back-link';
import { JOB_STATUS } from '@/lib/labels';
import { formatBookingTime, formatDate } from '@/lib/utils';
import {
  BOOKING_EVENT_SELECT,
  JOB_EVENT_SELECT,
  JOB_INVOICE_SELECT,
  bookingEvent,
  jobEvent,
  newestFirst,
  vehicleHref,
  withJobInvoices,
  type ProfilePerms,
  type WarrantyRow,
} from '@/app/dashboard/_profile/data';
import {
  AttentionPanel,
  EventList,
  Panel,
  PanelLink,
  type AttentionRowView,
} from '@/app/dashboard/_profile/parts';
import { RecordServiceButton } from '@/app/dashboard/customers/[id]/service-form';
import type { VehicleAttentionItem } from './attention';

export async function VehicleOverviewTab({
  vehicleId,
  carLabel,
  here,
  from,
  attention,
  rows,
  perms,
  now,
}: {
  vehicleId: string;
  carLabel: string;
  here: string;
  from?: string;
  attention: VehicleAttentionItem[];
  rows: WarrantyRow[];
  perms: ProfilePerms;
  now: Date;
}) {
  const [jobs, bookings] = await Promise.all([
    perms.workshop
      ? db.jobOrder.findMany({
          where: { vehicleId },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: JOB_EVENT_SELECT,
        })
      : [],
    // الحجز القادم ليس نشاطاً وقع — مكانه «القادم» في قسم الشغل والحجوزات
    db.booking.findMany({
      where: { vehicleId, scheduledAt: { lte: now } },
      orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: BOOKING_EVENT_SELECT,
    }),
  ]);

  const invoices =
    perms.invoices && jobs.length > 0
      ? await db.order.findMany({
          where: { jobOrderId: { in: jobs.map((job) => job.id) } },
          select: JOB_INVOICE_SELECT,
        })
      : [];

  const recent = withJobInvoices(
    [
      ...jobs.map((job) => jobEvent(job, here, 'vehicle')),
      ...bookings.map((booking) => bookingEvent(booking, here, perms.workshop, 'vehicle')),
    ],
    invoices
  )
    .sort(newestFirst)
    .slice(0, 5);

  const secondary = buttonVariants({ variant: 'secondary', size: 'sm' });
  const warrantiesHref = vehicleHref(vehicleId, { tab: 'warranties', from });

  const attentionRows = attention.map((item): AttentionRowView => {
    switch (item.kind) {
      case 'job':
        return {
          id: `job-${item.id}`,
          icon: Wrench,
          tile: 'bg-accent/12 text-accent',
          title: `أمر شغل ${item.number} — ${JOB_STATUS[item.status].label}`,
          detail: `باسم ${item.owner} · استُلم ${formatDate(item.receivedAt)}`,
          action: (
            <Link href={withFrom(`/dashboard/job-orders/${item.id}`, here)} className={secondary}>
              فتح الأمر
            </Link>
          ),
        };
      case 'booking': {
        const time = formatBookingTime(item.scheduledAt);
        return {
          id: `booking-${item.id}`,
          icon: CalendarDays,
          tile: 'bg-warn/12 text-warn',
          title: time ? `موعد اليوم ${time}` : 'موعد اليوم',
          detail: [item.code, item.detail].filter(Boolean).join(' · '),
          action: (
            <Link href={withFrom('/dashboard/bookings?view=list', here)} className={secondary}>
              الحجوزات
            </Link>
          ),
        };
      }
      case 'service':
        return {
          id: 'service',
          icon: ShieldCheck,
          tile: item.tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-warn/12 text-warn',
          title: `سيرفس الكفالة — ${item.label}`,
          detail: item.warranty,
          action: perms.write ? (
            <RecordServiceButton vehicleId={vehicleId} label={carLabel} labelled />
          ) : (
            <Link href={warrantiesHref} className={secondary}>
              الكفالات
            </Link>
          ),
        };
      case 'expiring':
        return {
          id: `expiring-${item.id}`,
          icon: TimerReset,
          tile: item.tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-warn/12 text-warn',
          title: `كفالة تقترب نهايتها — ${item.label}`,
          detail: `${item.warranty} · ${item.certificateNo}`,
          action: (
            <Link href={withFrom(`/dashboard/warranties/${item.id}`, here)} className={secondary}>
              فتح الكفالة
            </Link>
          ),
        };
    }
  });

  return (
    <div className="space-y-4">
      <AttentionPanel rows={attentionRows} calmText="لا شيء معلّق على هذه السيارة الآن." />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="آخر نشاط"
          action={
            recent.length > 0 ? (
              <PanelLink href={vehicleHref(vehicleId, { tab: 'work', from })}>
                {perms.workshop ? 'الشغل والحجوزات' : 'الحجوزات'}
              </PanelLink>
            ) : null
          }
        >
          {recent.length > 0 ? (
            <EventList events={recent} />
          ) : (
            <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">لا نشاط مسجّل على هذه السيارة بعد.</p>
          )}
        </Panel>

        <Panel
          title="الكفالات السارية"
          count={rows.length}
          action={rows.length > 0 ? <PanelLink href={warrantiesHref}>التفاصيل</PanelLink> : null}
        >
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">لا كفالة سارية على هذه السيارة.</p>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {rows.map((row) => (
                <Link
                  key={row.id}
                  href={withFrom(`/dashboard/warranties/${row.id}`, here)}
                  className="block px-4 py-3 transition-colors hover:bg-[var(--glass)] sm:px-5"
                >
                  <p className="truncate text-[13px] font-medium text-[var(--text-0)]">{row.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={row.badge.tone}>{row.badge.label}</Badge>
                    <span className="tnum text-[11px] text-[var(--text-2)]">حتى {formatDate(row.endDate)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
