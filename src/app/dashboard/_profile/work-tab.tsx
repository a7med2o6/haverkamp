import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BOOKING_EVENT_SELECT,
  JOB_EVENT_SELECT,
  JOB_INVOICE_SELECT,
  PAGE_CAP,
  PAGE_STEP,
  bookingEvent,
  jobEvent,
  newestFirst,
  scopeWhere,
  withJobInvoices,
  type HrefParams,
  type ProfilePerms,
  type ProfileScope,
} from './data';
import { EmptyPanel, EventList, MonthGroups, Panel, PanelLink } from './parts';

/** القادم حدٌّ مستقل: حجزٌ بعد شهور لا يزاحم ما جرى هذا الأسبوع على مقاعد الصفحة */
const UPCOMING_SHOWN = 5;

type WorkFilter = 'all' | 'job' | 'booking';

export async function WorkTab({
  scope,
  here,
  hrefFor,
  perms,
  blocked,
  newJobHref,
  jobsListHref,
  bookingsListHref,
  type,
  limit,
  now,
}: {
  scope: ProfileScope;
  here: string;
  /** رابط هذا القسم بمعلماته — الصفحة تضيف `from` */
  hrefFor: (params: HrefParams) => string;
  perms: ProfilePerms;
  blocked: boolean;
  newJobHref: string;
  /** قوائم الأقسام الكاملة بعد سقف «عرض المزيد» — حيث تقبل القائمة هذا المرشّح */
  jobsListHref?: string;
  bookingsListHref?: string;
  type?: string;
  limit: number;
  now: Date;
}) {
  const view = 'vehicleId' in scope ? 'vehicle' : 'customer';
  const where = scopeWhere(scope);

  // من لا يرى الورشة لا مرشّح له: الحجوزات وحدها ما يُعرض
  const filter: WorkFilter =
    perms.workshop && (type === 'job' || type === 'booking') ? type : perms.workshop ? 'all' : 'booking';
  const wantJobs = perms.workshop && filter !== 'booking';
  const wantBookings = filter !== 'job';

  const upcomingWhere: Prisma.BookingWhereInput = {
    ...where,
    status: { in: ['PENDING', 'CONFIRMED'] },
    scheduledAt: { gte: now },
  };
  // «الماضي» كل ما ليس قادماً: ما فات موعده، أو ما خرج من الانتظار أياً كان تاريخه
  const pastWhere: Prisma.BookingWhereInput = {
    ...where,
    OR: [{ scheduledAt: { lt: now } }, { status: { notIn: ['PENDING', 'CONFIRMED'] } }],
  };

  const [jobCount, pastBookingCount, upcomingCount, jobs, pastBookings, upcoming] =
    await Promise.all([
      perms.workshop ? db.jobOrder.count({ where }) : 0,
      db.booking.count({ where: pastWhere }),
      db.booking.count({ where: upcomingWhere }),
      wantJobs
        ? db.jobOrder.findMany({
            where,
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

  // ملف العميل له قسم فواتير؛ ملف السيارة يعرض فاتورة كل أمر على صفّه
  const invoices =
    view === 'vehicle' && perms.invoices && jobs.length > 0
      ? await db.order.findMany({
          where: { jobOrderId: { in: jobs.map((job) => job.id) } },
          select: JOB_INVOICE_SELECT,
        })
      : [];

  /*
    أخذُ `limit` من كل مصدر ثم الدمج والقصّ لا يُسقط صفّاً من أحدث `limit`
    عامّةً: ما لم يؤخذ من مصدرٍ أقدمُ من كل ما أُخذ منه.
  */
  const past = withJobInvoices(
    [
      ...jobs.map((job) => jobEvent(job, here, view)),
      ...pastBookings.map((booking) => bookingEvent(booking, here, perms.workshop, view)),
    ],
    invoices
  )
    .sort(newestFirst)
    .slice(0, limit);
  const pastTotal = (wantJobs ? jobCount : 0) + (wantBookings ? pastBookingCount : 0);
  const hasMore = pastTotal > past.length;
  const everything = jobCount + pastBookingCount + upcomingCount;
  const subject = view === 'vehicle' ? 'لهذه السيارة' : 'لهذا العميل';

  if (everything === 0) {
    return (
      <EmptyPanel
        text={
          perms.workshop ? `لا أوامر شغل ولا حجوزات ${subject} بعد.` : `لا حجوزات ${subject} بعد.`
        }
        action={
          perms.workshopWrite && !blocked ? (
            <Link href={newJobHref} className={buttonVariants({ size: 'sm' })}>
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

  return (
    <div className="space-y-4">
      {perms.workshop && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="نوع السجل">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={hrefFor({ tab: 'work', type: chip.key === 'all' ? undefined : chip.key })}
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
            upcomingCount > upcoming.length && bookingsListHref ? (
              <PanelLink href={bookingsListHref}>كل الحجوزات</PanelLink>
            ) : null
          }
        >
          <EventList
            events={upcoming.map((booking) => bookingEvent(booking, here, perms.workshop, view))}
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
                  href={hrefFor({
                    tab: 'work',
                    type: filter === 'all' || !perms.workshop ? undefined : filter,
                    limit: limit + PAGE_STEP,
                  })}
                  scroll={false}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  عرض {Math.min(PAGE_STEP, pastTotal - past.length)} أخرى
                </Link>
              ) : (
                <>
                  {wantJobs && jobsListHref && <PanelLink href={jobsListHref}>كل أوامر الشغل</PanelLink>}
                  {wantBookings && bookingsListHref && (
                    <PanelLink href={bookingsListHref}>كل الحجوزات</PanelLink>
                  )}
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
                href={hrefFor({ tab: 'work' })}
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
