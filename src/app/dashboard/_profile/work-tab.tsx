import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BOOKING_EVENT_SELECT,
  JOB_EVENT_SELECT,
  PAGE_CAP,
  PAGE_STEP,
  bookingEvent,
  customerHref,
  jobEvent,
  newestFirst,
  type ProfilePerms,
} from './profile-data';
import { EmptyPanel, EventList, MonthGroups, Panel, PanelLink } from './profile-parts';

/** القادم حدٌّ مستقل: حجزٌ بعد شهور لا يزاحم ما جرى هذا الأسبوع على مقاعد الصفحة */
const UPCOMING_SHOWN = 5;

type WorkFilter = 'all' | 'job' | 'booking';

export async function WorkTab({
  customerId,
  here,
  from,
  perms,
  blocked,
  type,
  limit,
  now,
}: {
  customerId: string;
  here: string;
  from?: string;
  perms: ProfilePerms;
  blocked: boolean;
  type?: string;
  limit: number;
  now: Date;
}) {
  // من لا يرى الورشة لا مرشّح له: الحجوزات وحدها ما يُعرض
  const filter: WorkFilter =
    perms.workshop && (type === 'job' || type === 'booking') ? type : perms.workshop ? 'all' : 'booking';
  const wantJobs = perms.workshop && filter !== 'booking';
  const wantBookings = filter !== 'job';

  const upcomingWhere: Prisma.BookingWhereInput = {
    customerId,
    status: { in: ['PENDING', 'CONFIRMED'] },
    scheduledAt: { gte: now },
  };
  // «الماضي» كل ما ليس قادماً: ما فات موعده، أو ما خرج من الانتظار أياً كان تاريخه
  const pastWhere: Prisma.BookingWhereInput = {
    customerId,
    OR: [{ scheduledAt: { lt: now } }, { status: { notIn: ['PENDING', 'CONFIRMED'] } }],
  };

  const [jobCount, pastBookingCount, upcomingCount, jobs, pastBookings, upcoming] =
    await Promise.all([
      perms.workshop ? db.jobOrder.count({ where: { customerId } }) : 0,
      db.booking.count({ where: pastWhere }),
      db.booking.count({ where: upcomingWhere }),
      wantJobs
        ? db.jobOrder.findMany({
            where: { customerId },
            orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
            take: limit,
            select: JOB_EVENT_SELECT,
          })
        : [],
      wantBookings
        ? db.booking.findMany({
            where: pastWhere,
            orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
            take: limit,
            select: BOOKING_EVENT_SELECT,
          })
        : [],
      wantBookings
        ? db.booking.findMany({
            where: upcomingWhere,
            orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
            take: UPCOMING_SHOWN,
            select: BOOKING_EVENT_SELECT,
          })
        : [],
    ]);

  /*
    أخذُ `limit` من كل مصدر ثم الدمج والقصّ لا يُسقط صفّاً من أحدث `limit`
    عامّةً: ما لم يؤخذ من مصدرٍ أقدمُ من كل ما أُخذ منه.
  */
  const past = [
    ...jobs.map((job) => jobEvent(job, here)),
    ...pastBookings.map((booking) => bookingEvent(booking, here, customerId, perms.workshop)),
  ]
    .sort(newestFirst)
    .slice(0, limit);
  const pastTotal = (wantJobs ? jobCount : 0) + (wantBookings ? pastBookingCount : 0);
  const hasMore = pastTotal > past.length;
  const everything = jobCount + pastBookingCount + upcomingCount;

  if (everything === 0) {
    return (
      <EmptyPanel
        text={perms.workshop ? 'لا أوامر شغل ولا حجوزات لهذا العميل بعد.' : 'لا حجوزات لهذا العميل بعد.'}
        action={
          perms.write && perms.workshop && !blocked ? (
            <Link
              href={`/dashboard/job-orders/new?customer=${customerId}`}
              className={buttonVariants({ size: 'sm' })}
            >
              <Plus />
              بيان تشغيل جديد
            </Link>
          ) : null
        }
      />
    );
  }

  const chips: { key: WorkFilter; label: string; count: number }[] = [
    { key: 'all', label: 'الكل', count: everything },
    { key: 'job', label: 'أوامر الشغل', count: jobCount },
    { key: 'booking', label: 'الحجوزات', count: pastBookingCount + upcomingCount },
  ];
  const jobsList = `/dashboard/job-orders?filter=all&customer=${customerId}`;
  const bookingsList = `/dashboard/bookings?view=list&customer=${customerId}`;

  return (
    <div className="space-y-4">
      {perms.workshop && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="نوع السجل">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={customerHref(customerId, {
                tab: 'work',
                type: chip.key === 'all' ? undefined : chip.key,
                from,
              })}
              scroll={false}
              aria-current={filter === chip.key ? 'true' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors',
                filter === chip.key
                  ? 'border-accent/40 bg-accent/12 text-accent'
                  : 'border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-1)] hover:border-[var(--line-strong)]'
              )}
            >
              {chip.label}
              <span className="tnum text-[11px] opacity-70">{chip.count}</span>
            </Link>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <Panel
          title="قادم"
          icon={CalendarDays}
          count={upcomingCount}
          action={
            upcomingCount > upcoming.length ? (
              <PanelLink href={bookingsList}>كل الحجوزات</PanelLink>
            ) : null
          }
        >
          <EventList
            events={upcoming.map((booking) => bookingEvent(booking, here, customerId, perms.workshop))}
          />
        </Panel>
      )}

      {past.length > 0 ? (
        <MonthGroups
          events={past}
          footer={
            hasMore ? (
              limit < PAGE_CAP ? (
                <Link
                  href={customerHref(customerId, {
                    tab: 'work',
                    type: filter === 'all' || !perms.workshop ? undefined : filter,
                    limit: limit + PAGE_STEP,
                    from,
                  })}
                  scroll={false}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  عرض {Math.min(PAGE_STEP, pastTotal - past.length)} أخرى
                </Link>
              ) : (
                <>
                  {wantJobs && <PanelLink href={jobsList}>كل أوامر الشغل</PanelLink>}
                  {wantBookings && <PanelLink href={bookingsList}>كل الحجوزات</PanelLink>}
                </>
              )
            ) : null
          }
        />
      ) : (
        upcoming.length === 0 && (
          <EmptyPanel
            text="لا نتائج لهذا الفلتر."
            action={
              <Link
                href={customerHref(customerId, { tab: 'work', from })}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                مسح الفلتر
              </Link>
            }
          />
        )
      )}
    </div>
  );
}
