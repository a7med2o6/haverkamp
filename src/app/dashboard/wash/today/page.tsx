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
import { Card, CardBody } from '@/components/ui/card';
import { TodayRoute, type WasherChipInfo, type OverdueDayInfo } from './today-route';
import { washLocationLine } from '@/app/dashboard/wash/location';
import type { Prisma } from '@/generated/prisma/client';

export const metadata: Metadata = { title: 'جولة الغسيل' };
export const dynamic = 'force-dynamic';

export default async function WashTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; washer?: string }>;
}) {
  const { date: rawDate, washer: rawWasher } = await searchParams;
  const session = await requirePermission('wash:visit');
  const today = todayDateOnly();
  const isWasher = session.user.role === 'WASHER';

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
  const targetDateStr = dateOnlyToInput(targetDate);

  // حساب التواريخ المجاورة للتنقل مع حظر حواف النافذة
  const prevDate = new Date(targetDate.getTime() - 86400000);
  const nextDate = new Date(targetDate.getTime() + 86400000);
  const canPrev = prevDate >= minDate;
  const canNext = nextDate <= maxDate;

  const prevStr = dateOnlyToInput(prevDate);
  const nextStr = dateOnlyToInput(nextDate);
  const dateFormatted = `${formatWeekday(targetDate)}، ${formatDateOnly(targetDate)}`;

  // نمط الغسّيل: يعرض زياراته هو فقط ولا يتيح الفلترة أو الإشراف
  if (isWasher) {
    const employee = await db.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true, fullName: true },
    });

    if (!employee) {
      return (
        <>
          <PageHeader title="جولة الغسيل" description={formatDateOnly(today)} />
          <Card className="mx-auto max-w-xl border-warn/40">
            <CardBody className="py-12 text-center">
              <AlertTriangle className="mx-auto size-10 text-warn" />
              <h1 className="mt-4 text-lg font-bold text-[var(--text-0)]">الحساب غير مرتبط بموظف</h1>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[var(--text-2)]">
                يُرجى التواصل مع مدير الفرع لربط هذا الحساب بملف الموظف لعرض جولة اليوم.
              </p>
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
        dueDate: visit.dueDate,
        scheduledDate: visit.scheduledDate,
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
        assignedEmployee: null,
      };
    });

    const pointsWithCoords = mappedVisits
      .filter((v) => v.lat !== null && v.lng !== null)
      .map((v) => ({ lat: v.lat!, lng: v.lng! }));

    const routeLink = isToday ? routeUrl(pointsWithCoords) : null;

    return (
      <div className="mx-auto max-w-6xl space-y-4">
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
          canRecord={isToday}
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
            currentDateStr: targetDateStr,
          }}
          isSupervisor={false}
        />
      </div>
    );
  }

  // نمط المشرف: الإشراف الميداني لجميع الأدوار الإدارية ذات صلاحية wash:visit
  /*
    تنبيه الغسلات المتأخرة غير المسجلة لـ 14 يوماً مضت:
    استعلام تجميعي مفرد لتجنّب استدعاء تفاصيل الصفوف الكثيرة.
  */
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 86400000);
  const overdueGroups = await db.washVisit.groupBy({
    by: ['scheduledDate'],
    where: {
      status: 'PLANNED',
      scheduledDate: { gte: fourteenDaysAgo, lt: today },
    },
    orderBy: { scheduledDate: 'asc' },
    _count: { _all: true },
  });

  const overdueDays: OverdueDayInfo[] = overdueGroups.map((g) => {
    const d = g.scheduledDate;
    const count = g._count._all;
    const dateStr = dateOnlyToInput(d);
    return {
      dateStr,
      dateLabel: `${formatWeekday(d)} ${formatDateOnly(d)}`,
      count,
      isNavigable: d >= minDate,
    };
  });
  const totalOverdueCount = overdueDays.reduce((acc, d) => acc + d.count, 0);

  /*
    استعلام زيارات اليوم لجميع الغسّالين:
    تُجلب بيانات الموظف المسند لإعادة التجميع والفلترة بحسب الغسّال.
  */
  const dayVisits = await db.washVisit.findMany({
    where: {
      scheduledDate: targetDate,
      status: { in: ['PLANNED', 'COMPLETED', 'SKIPPED'] },
    },
    orderBy: [
      { period: { subscription: { area: 'asc' } } },
      { period: { subscription: { building: 'asc' } } },
      { createdAt: 'asc' },
    ],
    include: {
      assignedEmployee: { select: { id: true, fullName: true } },
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

  // حساب توزيع الزيارات على الغسّالين والزيارات غير المسندة
  const washerCountsMap = new Map<string, { id: string; fullName: string; count: number }>();
  let unassignedCount = 0;

  for (const visit of dayVisits) {
    if (visit.assignedEmployee) {
      const empId = visit.assignedEmployee.id;
      const existing = washerCountsMap.get(empId);
      if (existing) {
        existing.count++;
      } else {
        washerCountsMap.set(empId, {
          id: empId,
          fullName: visit.assignedEmployee.fullName,
          count: 1,
        });
      }
    } else {
      unassignedCount++;
    }
  }

  const washerChips: WasherChipInfo[] = Array.from(washerCountsMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'ar')
  );

  // التحقق من صلاحية الفلتر washer الممرر في العنوان
  let selectedWasher: string | null = null;
  if (rawWasher) {
    if (rawWasher === 'unassigned' && unassignedCount > 0) {
      selectedWasher = 'unassigned';
    } else if (washerCountsMap.has(rawWasher)) {
      selectedWasher = rawWasher;
    }
  }

  // تصفية المعروض بحسب الغسّال المختار
  const filteredVisits = selectedWasher
    ? dayVisits.filter((v) =>
        selectedWasher === 'unassigned'
          ? !v.assignedEmployee
          : v.assignedEmployee?.id === selectedWasher
      )
    : dayVisits;

  const done = filteredVisits.filter((visit) => visit.status !== 'PLANNED').length;
  const remaining = filteredVisits.length - done;

  /*
    حساب الجولة القادمة عند خلو القائمة الحالية من الزيارات:
    تراعي الفلترة المختارة إن وُجدت.
  */
  let upcomingRound: { dateStr: string; dateLabel: string; count: number } | null = null;
  if (filteredVisits.length === 0) {
    const upcomingWhere: Prisma.WashVisitWhereInput = {
      scheduledDate: { gte: today },
      status: 'PLANNED',
    };
    if (selectedWasher === 'unassigned') {
      upcomingWhere.assignedEmployeeId = null;
    } else if (selectedWasher) {
      upcomingWhere.assignedEmployeeId = selectedWasher;
    }

    const nextGroup = await db.washVisit.groupBy({
      by: ['scheduledDate'],
      where: upcomingWhere,
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

  const canReschedule = can(session.user.role, 'wash:write');

  const mappedVisits = filteredVisits.map((visit) => {
    const subscription = visit.period.subscription;
    return {
      id: visit.id,
      dueDate: visit.dueDate,
      scheduledDate: visit.scheduledDate,
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
      assignedEmployee: visit.assignedEmployee
        ? { id: visit.assignedEmployee.id, fullName: visit.assignedEmployee.fullName }
        : null,
    };
  });

  // مسار الخريطة يُشغَّل فقط عند اختيار غسّال مفرد وفي اليوم الحالي
  const pointsWithCoords = mappedVisits
    .filter((v) => v.lat !== null && v.lng !== null)
    .map((v) => ({ lat: v.lat!, lng: v.lng! }));

  const routeLink = isToday && selectedWasher !== null ? routeUrl(pointsWithCoords) : null;

  /*
    المشرف يسجّل أيّ يومٍ مضى، فعليه يُستدرك ما نسيه الغسّيل؛ والقادم لا يُسجَّل.
    هذا ما يقبله visitMutationContext نفسه، والشاشة لا تعرض ما يرفضه الخادم.
  */
  const canRecord = targetDate <= today;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={isToday ? 'جولة اليوم' : 'جولة الغسيل'}
        actions={
          <Badge
            tone={dayVisits.length > 0 && dayVisits.every((v) => v.status !== 'PLANNED') ? 'ok' : 'accent'}
          >
            {dayVisits.length} زيارة
          </Badge>
        }
      />

      <TodayRoute
        visits={mappedVisits}
        isToday={isToday}
        canRecord={canRecord}
        canReschedule={canReschedule}
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
          currentDateStr: targetDateStr,
        }}
        isSupervisor={true}
        overdueBannerInfo={{
          days: overdueDays,
          totalCount: totalOverdueCount,
        }}
        washerFilterInfo={{
          chips: washerChips,
          unassignedCount,
          selectedWasher,
          totalDayVisitsCount: dayVisits.length,
        }}
      />
    </div>
  );
}
