import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import {
  dateOnlyFromInput,
  dateOnlyToInput,
  formatDateOnly,
  formatWeekday,
  todayDateOnly,
  toNumber,
} from '@/lib/utils';
import { routeUrl } from '@/lib/geo';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { TodayRoute } from './today-route';
import { washLocationLine } from '@/app/dashboard/wash/location';

export const metadata: Metadata = { title: 'جولة الغسيل' };
export const dynamic = 'force-dynamic';

export default async function WashTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: rawDate } = await searchParams;
  const session = await requirePermission('wash:visit');
  const today = todayDateOnly();

  /*
    تقييد النافذة الزمنية للتصفح (7 أيام ماضية و14 يوماً قادمة):
    تمنع الاستعلامات غير المحدودة وتحمي من تصفح سجلات قديمة لا شأن للغسّيل بها.
  */
  const minDate = new Date(today.getTime() - 7 * 86400000);
  const maxDate = new Date(today.getTime() + 14 * 86400000);

  let targetDate = today;
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const parsed = dateOnlyFromInput(rawDate);
    if (!Number.isNaN(parsed.getTime()) && dateOnlyToInput(parsed) === rawDate) {
      if (parsed < minDate) {
        targetDate = minDate;
      } else if (parsed > maxDate) {
        targetDate = maxDate;
      } else {
        targetDate = parsed;
      }
    }
  }

  const isToday = targetDate.getTime() === today.getTime();

  // حساب التواريخ المجاورة للتنقل مع حظر حواف النافذة
  const prevDate = new Date(targetDate.getTime() - 86400000);
  const nextDate = new Date(targetDate.getTime() + 86400000);
  const canPrev = prevDate >= minDate;
  const canNext = nextDate <= maxDate;

  const prevStr = dateOnlyToInput(prevDate);
  const nextStr = dateOnlyToInput(nextDate);

  const employee = await db.employee.findUnique({
    where: { userId: session.user.id },
    select: { id: true, fullName: true },
  });

  if (!employee) {
    const canReadWash = can(session.user.role, 'wash:read');
    return (
      <>
        <PageHeader title="جولة الغسيل" description={formatDateOnly(today)} />
        <Card className="mx-auto max-w-xl border-warn/40">
          <CardBody className="py-12 text-center">
            <AlertTriangle className="mx-auto size-10 text-warn" />
            <h1 className="mt-4 text-lg font-bold text-[var(--text-0)]">الحساب غير مرتبط بموظف</h1>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[var(--text-2)]">
              {canReadWash
                ? 'اربط هذا الحساب بملف الموظف حتى تظهر الزيارات المسندة إليه وحدها في جولة اليوم.'
                : 'يُرجى التواصل مع مدير الفرع لربط هذا الحساب بملف الموظف لعرض جولة اليوم.'}
            </p>
            {canReadWash && (
              <Link href="/dashboard/wash/coverage" className={`${buttonVariants({ variant: 'secondary' })} mt-5`}>
                عرض تغطية الشهر
              </Link>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  const visits = await db.washVisit.findMany({
    where: {
      assignedEmployeeId: employee.id,
      scheduledDate: targetDate,
      status: { in: ['PLANNED', 'COMPLETED', 'SKIPPED'] },
    },
    orderBy: [
      { period: { subscription: { area: 'asc' } } },
      { period: { subscription: { building: 'asc' } } },
      { createdAt: 'asc' },
    ],
    include: {
      period: {
        select: {
          subscription: {
            select: {
              area: true,
              block: true,
              street: true,
              building: true,
              locationNotes: true,
              lat: true,
              lng: true,
              customer: { select: { name: true, phone: true } },
              vehicle: { select: { make: true, model: true, plateNo: true } },
            },
          },
        },
      },
    },
  });

  const done = visits.filter((visit) => visit.status !== 'PLANNED').length;
  const remaining = visits.length - done;

  /*
    استعلام الجولة القادمة عند خلو اليوم المعروض من الزيارات:
    نكتفي باستعلام تجميعي واحد يرجع أول تاريخ به غسلات مخطط لها مع عددها دون تحميل التفاصيل.
  */
  let upcomingRound: { dateStr: string; dateLabel: string; count: number } | null = null;
  if (visits.length === 0) {
    const nextGroup = await db.washVisit.groupBy({
      by: ['scheduledDate'],
      where: {
        assignedEmployeeId: employee.id,
        scheduledDate: { gte: today },
        status: 'PLANNED',
      },
      orderBy: { scheduledDate: 'asc' },
      _count: { _all: true },
      take: 1,
    });

    if (nextGroup.length > 0) {
      const upcomingDate = nextGroup[0].scheduledDate;
      const count = nextGroup[0]._count._all;
      upcomingRound = {
        dateStr: dateOnlyToInput(upcomingDate),
        dateLabel: `${formatWeekday(upcomingDate)} ${formatDateOnly(upcomingDate)}`,
        count,
      };
    }
  }

  const mappedVisits = visits.map((visit) => {
    const subscription = visit.period.subscription;
    return {
      id: visit.id,
      status: visit.status as 'PLANNED' | 'COMPLETED' | 'SKIPPED',
      skipReason: visit.skipReason,
      customerName: subscription.customer.name,
      phone: subscription.customer.phone,
      car: `${subscription.vehicle.make} ${subscription.vehicle.model}`,
      plateNo: subscription.vehicle.plateNo,
      location: washLocationLine(subscription),
      locationNotes: subscription.locationNotes,
      lat: subscription.lat !== null ? toNumber(subscription.lat) : null,
      lng: subscription.lng !== null ? toNumber(subscription.lng) : null,
    };
  });

  // استخراج الإحداثيات لبناء رابط خريطة الجولة (حتى 10 نقاط)
  const pointsWithCoords = mappedVisits
    .filter((v) => v.lat !== null && v.lng !== null)
    .map((v) => ({ lat: v.lat!, lng: v.lng! }));

  const routeLink = isToday ? routeUrl(pointsWithCoords) : null;
  const dateFormatted = `${formatWeekday(targetDate)}، ${formatDateOnly(targetDate)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/*
        الاسم في رأس الشاشة والتاريخ في شريط الأيام تحته — فلا يُعادان هنا.
        شاشة الجوّال ضيّقة الطول، وثلاثة أسطر تقول الشيء نفسه تدفع أول
        سيارة خارج الشاشة.
      */}
      <PageHeader
        title={isToday ? 'جولة اليوم' : 'جولة الغسيل'}
        actions={
          <Badge tone={remaining === 0 && visits.length > 0 ? 'ok' : 'accent'}>
            {visits.length} زيارة
          </Badge>
        }
      />

      <TodayRoute
        visits={mappedVisits}
        isToday={isToday}
        doneCount={done}
        remainingCount={remaining}
        upcomingRound={upcomingRound}
        routeLink={routeLink}
        totalPointsCount={pointsWithCoords.length}
        dateControls={{
          dateFormatted,
          prevStr,
          nextStr,
          canPrev,
          canNext,
          isToday,
        }}
      />
    </div>
  );
}
