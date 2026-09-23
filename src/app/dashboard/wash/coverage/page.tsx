import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { cn, dateOnlyToInput, formatDateOnly, todayDateOnly } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { BulkDayAction } from './bulk-day-action';
import { ScrollToToday } from './scroll-to-today';

export const metadata: Metadata = { title: 'تغطية غسيل الشهر' };
export const dynamic = 'force-dynamic';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const REASON_LABELS: Record<string, string> = {
  UNPAID: 'غير مسدّد',
  CAR_ABSENT: 'السيارة غير موجودة',
  CUSTOMER_TRAVEL: 'العميل مسافر',
  WEATHER: 'الطقس',
  HOLIDAY: 'عطلة رسمية',
  OPERATIONAL: 'من جهتنا (لم يحضر الغسّيل)',
  OTHER: 'سبب آخر',
};

function monthName(year: number, month: number) {
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function adjacentMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function coverageHref(year: number, month: number) {
  return `/dashboard/wash/coverage?year=${year}&month=${month}`;
}

function buildFilterHref(
  base: { year: number; month: number; area: string; washer: string },
  override: { area?: string; washer?: string }
) {
  const params = new URLSearchParams();
  params.set('year', String(base.year));
  params.set('month', String(base.month));
  const newArea = override.area !== undefined ? override.area : base.area;
  const newWasher = override.washer !== undefined ? override.washer : base.washer;
  if (newArea) params.set('area', newArea);
  if (newWasher) params.set('washer', newWasher);
  return `/dashboard/wash/coverage?${params.toString()}`;
}

function dayCategory(
  visit: { status: 'BLOCKED' | 'PLANNED' | 'COMPLETED' | 'SKIPPED'; scheduledDate: Date },
  today: Date
) {
  if (visit.status === 'COMPLETED') return 'completed' as const;
  if (visit.status === 'SKIPPED') return 'skipped' as const;
  if (visit.status === 'BLOCKED') return 'blocked' as const;
  return visit.scheduledDate < today ? ('missed' as const) : ('planned' as const);
}

const CELL = {
  completed: { glyph: '✓', label: 'تمّت', className: 'border-ok/35 bg-[var(--mark-ok)]/14 text-ok' },
  planned: { glyph: '○', label: 'مخطّطة', className: 'border-accent/30 bg-[var(--mark-accent)]/12 text-accent' },
  missed: { glyph: '!', label: 'فاتت بلا تسجيل', className: 'border-danger/45 bg-[var(--mark-danger)]/14 text-danger' },
  skipped: { glyph: '×', label: 'تعذّرت', className: 'border-warn/40 bg-[var(--mark-warn)]/14 text-warn' },
  blocked: { glyph: 'ـ', label: 'غير مسدّد', className: 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)]' },
};

export default async function WashCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; area?: string; washer?: string }>;
}) {
  const session = await requirePermission('wash:read');
  const params = await searchParams;
  const today = todayDateOnly();
  const todayInput = dateOnlyToInput(today);
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const requestedYear = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : currentYear;
  const requestedMonth = params.month && /^\d{1,2}$/.test(params.month) ? Number(params.month) : currentMonth;
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, requestedYear));
  const month = Math.min(12, Math.max(1, requestedMonth));
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const days = Array.from({ length: monthEnd.getUTCDate() }, (_, index) =>
    new Date(Date.UTC(year, month - 1, index + 1))
  );
  const previous = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);

  const allVisits = await db.washVisit.findMany({
    where: { scheduledDate: { gte: monthStart, lte: monthEnd } },
    orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      assignedEmployee: { select: { id: true, fullName: true } },
      period: {
        select: {
          subscription: {
            select: {
              id: true,
              code: true,
              area: true,
              customer: { select: { name: true } },
              vehicle: { select: { make: true, model: true, plateNo: true } },
            },
          },
        },
      },
    },
  });

  /* حساب أقرب وأبعد تاريخ زيارة في الشهر لخفت عرض الأيام التي تسبقها أو تليها */
  let minVisitTime = Infinity;
  let maxVisitTime = -Infinity;
  for (const visit of allVisits) {
    const t = visit.scheduledDate.getTime();
    if (t < minVisitTime) minVisitTime = t;
    if (t > maxVisitTime) maxVisitTime = t;
  }

  const areas = [...new Set(allVisits.map((visit) => visit.period.subscription.area))].sort((a, b) =>
    a.localeCompare(b, 'ar')
  );
  const washers = [
    ...new Map(
      allVisits
        .filter((visit) => visit.assignedEmployee)
        .map((visit) => [visit.assignedEmployee!.id, visit.assignedEmployee!])
    ).values(),
  ].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));

  const hasUnassignedVisits = allVisits.some((visit) => visit.assignedEmployeeId === null);
  const totalWasherOptions = washers.length + (hasUnassignedVisits ? 1 : 0);

  const area = params.area && areas.includes(params.area) ? params.area : '';
  const washer =
    params.washer === 'unassigned' || washers.some((item) => item.id === params.washer)
      ? params.washer ?? ''
      : '';

  const visits = allVisits.filter((visit) => {
    if (area && visit.period.subscription.area !== area) return false;
    if (washer === 'unassigned' && visit.assignedEmployeeId !== null) return false;
    if (washer && washer !== 'unassigned' && visit.assignedEmployeeId !== washer) return false;
    return true;
  });

  const rows = new Map<
    string,
    {
      subscription: (typeof visits)[number]['period']['subscription'];
      visits: typeof visits;
      washerNames: Set<string>;
    }
  >();
  for (const visit of visits) {
    const subscription = visit.period.subscription;
    const row = rows.get(subscription.id) ?? {
      subscription,
      visits: [],
      washerNames: new Set<string>(),
    };
    row.visits.push(visit);
    row.washerNames.add(visit.assignedEmployee?.fullName ?? 'غير مسند');
    rows.set(subscription.id, row);
  }
  const coverageRows = [...rows.values()].sort(
    (a, b) =>
      a.subscription.area.localeCompare(b.subscription.area, 'ar') ||
      a.subscription.code.localeCompare(b.subscription.code)
  );

  const summary = { completed: 0, planned: 0, missed: 0, skipped: 0, blocked: 0 };
  let earliestMissedDate: Date | null = null;
  for (const visit of visits) {
    const cat = dayCategory(visit, today);
    summary[cat]++;
    if (cat === 'missed') {
      if (!earliestMissedDate || visit.scheduledDate < earliestMissedDate) {
        earliestMissedDate = visit.scheduledDate;
      }
    }
  }

  /*
    نافذة جولة المشرف تسمح بـ 7 أيام ماضية فقط.
    إذا كان أول يوم فوت ضمن النافذة ينقل إليها مباشرة؛ وإلا يربط بمرساة الشبكة.
  */
  const roundMinDate = new Date(today.getTime() - 7 * 86400000);
  const isMissedInRoundWindow =
    earliestMissedDate && earliestMissedDate >= roundMinDate && earliestMissedDate <= today;
  const missedHref = isMissedInRoundWindow
    ? `/dashboard/wash/today?date=${dateOnlyToInput(earliestMissedDate!)}`
    : '#coverage-grid';

  /*
    تعطيل اليوم يبدأ من اليوم: على يومٍ مضى يحوّل ما فات بلا تسجيل إلى «عطلة»
    فيمحو الدليل على أنه فات. ولشهرٍ انقضى كلّه لا يُعرض الزر أصلاً.
  */
  const bulkMinDateObj = today > monthStart ? (today > monthEnd ? monthEnd : today) : monthStart;
  const bulkMinDate = dateOnlyToInput(bulkMinDateObj);
  const bulkMaxDate = dateOnlyToInput(monthEnd);
  const canWrite = can(session.user.role, 'wash:write');
  const isTodayInViewedMonth = today >= monthStart && today <= monthEnd;

  return (
    <>
      {isTodayInViewedMonth && <ScrollToToday />}

      <PageHeader
        title="تغطية الشهر"
        description={monthName(year, month)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && monthEnd >= today && <BulkDayAction minDate={bulkMinDate} maxDate={bulkMaxDate} />}
            <nav aria-label="التنقل بين أشهر التغطية" className="flex items-center gap-1.5">
              <Link
                href={coverageHref(previous.year, previous.month)}
                aria-disabled={previous.year < MIN_YEAR}
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'sm' }),
                  previous.year < MIN_YEAR && 'pointer-events-none opacity-50'
                )}
              >
                <ChevronRight /> السابق
              </Link>
              <Link
                href={coverageHref(currentYear, currentMonth)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                الشهر الحالي
              </Link>
              <Link
                href={coverageHref(next.year, next.month)}
                aria-disabled={next.year > MAX_YEAR}
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'sm' }),
                  next.year > MAX_YEAR && 'pointer-events-none opacity-50'
                )}
              >
                التالي <ChevronLeft />
              </Link>
            </nav>
          </div>
        }
      />

      {/* شريط المجموع المدمج الذي يعمل أيضاً كدليل ألوان لعدم تكرار التذييل */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] p-2.5 sm:gap-4 sm:px-4">
        {(Object.keys(CELL) as Array<keyof typeof CELL>).map((key) => {
          const item = CELL[key];
          const count = summary[key];
          const isMissed = key === 'missed';

          if (isMissed && count > 0) {
            return (
              <Link
                key={key}
                href={missedHref}
                title="الانتقال إلى أول يوم فاتت فيه غسلات لتسجيل الجولة"
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-danger/40 bg-[var(--mark-danger)]/18 px-3 py-1.5 text-danger transition-colors hover:bg-[var(--mark-danger)]/30"
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md border text-xs font-black',
                    item.className
                  )}
                >
                  {item.glyph}
                </span>
                <span className="text-[12px] font-bold">{item.label}</span>
                <span className="tnum text-base font-extrabold">{count}</span>
              </Link>
            );
          }

          return (
            <div
              key={key}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-1)]"
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-md border text-xs font-black',
                  item.className
                )}
              >
                {item.glyph}
              </span>
              <span className="text-[12px] font-medium">{item.label}</span>
              <span className="tnum text-base font-extrabold text-[var(--text-0)]">{count}</span>
            </div>
          );
        })}
      </div>

      {/* شريحة الفلاتر السريعة بدون زر تطبيق */}
      {(areas.length > 1 || totalWasherOptions > 1) && (
        <div className="mb-4 space-y-2.5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-3">
          {areas.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="me-1.5 text-[11px] font-semibold text-[var(--text-2)]">المنطقة:</span>
              <Link
                href={buildFilterHref({ year, month, area, washer }, { area: '' })}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  area === ''
                    ? 'bg-accent text-[var(--accent-ink)] font-bold'
                    : 'bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--glass-strong)] border border-[var(--line)]'
                )}
              >
                كل المناطق
              </Link>
              {areas.map((item) => (
                <Link
                  key={item}
                  href={buildFilterHref({ year, month, area, washer }, { area: item })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    area === item
                      ? 'bg-accent text-[var(--accent-ink)] font-bold'
                      : 'bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--glass-strong)] border border-[var(--line)]'
                  )}
                >
                  {item}
                </Link>
              ))}
            </div>
          )}

          {totalWasherOptions > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="me-1.5 text-[11px] font-semibold text-[var(--text-2)]">الغسّيل:</span>
              <Link
                href={buildFilterHref({ year, month, area, washer }, { washer: '' })}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  washer === ''
                    ? 'bg-accent text-[var(--accent-ink)] font-bold'
                    : 'bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--glass-strong)] border border-[var(--line)]'
                )}
              >
                كل الغسّالين
              </Link>
              {hasUnassignedVisits && (
                <Link
                  href={buildFilterHref({ year, month, area, washer }, { washer: 'unassigned' })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    washer === 'unassigned'
                      ? 'bg-accent text-[var(--accent-ink)] font-bold'
                      : 'bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--glass-strong)] border border-[var(--line)]'
                  )}
                >
                  غير مسند
                </Link>
              )}
              {washers.map((item) => (
                <Link
                  key={item.id}
                  href={buildFilterHref({ year, month, area, washer }, { washer: item.id })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    washer === item.id
                      ? 'bg-accent text-[var(--accent-ink)] font-bold'
                      : 'bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--glass-strong)] border border-[var(--line)]'
                  )}
                >
                  {item.fullName}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <Card className="overflow-hidden" id="coverage-grid">
        <CardHeader>
          <div>
            <CardTitle>شبكة التغطية</CardTitle>
            <p className="mt-1 text-[12px] text-[var(--text-2)]">
              الجمعة والسبت مميّزان بصرياً، ولا يُستبعدان من الجدول.
            </p>
          </div>
          <Badge tone="neutral">{coverageRows.length} اشتراك</Badge>
        </CardHeader>
        <div data-coverage-scroll className="max-h-[68vh] w-full overflow-auto" tabIndex={0} aria-label="جدول تغطية غسيل الشهر">
          <table className="min-w-max border-collapse text-xs">
            <thead>
              <tr>
                <th data-coverage-sticky className="sticky start-0 top-0 z-30 min-w-44 sm:min-w-60 border-b border-e border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-start text-[12px] text-[var(--text-1)]">
                  الاشتراك
                </th>
                {days.map((day) => {
                  const isTodayDay = dateOnlyToInput(day) === todayInput;
                  const dayTime = day.getTime();
                  const isQuiet = dayTime < minVisitTime || dayTime > maxVisitTime;
                  const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;

                  return (
                    <th
                      key={day.toISOString()}
                      {...(isTodayDay ? { 'data-today': 'true' } : {})}
                      className={cn(
                        'sticky top-0 z-20 w-11 border-b border-e border-[var(--line)] px-1 py-2 text-center transition-colors',
                        isTodayDay
                          ? 'bg-accent/20 text-accent font-bold border-b-2 border-b-accent'
                          : weekend
                          ? 'bg-[var(--surface-3)]/60 text-warn/90'
                          : 'bg-[var(--surface-2)]',
                        isQuiet && !isTodayDay && 'opacity-60'
                      )}
                    >
                      {isTodayDay && (
                        <span className="block text-[9px] font-black leading-none text-accent mb-0.5">
                          اليوم
                        </span>
                      )}
                      <span className="tnum block text-[13px] font-bold">{day.getUTCDate()}</span>
                      <span className="block text-[9px]">
                        {day.getUTCDay() === 5 ? 'جم' : day.getUTCDay() === 6 ? 'سب' : 'ـ'}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {coverageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={days.length + 1}
                    className="px-5 py-14 text-center text-sm text-[var(--text-2)]"
                  >
                    لا توجد غسلات مطابقة لهذا الشهر والفلاتر.
                  </td>
                </tr>
              ) : (
                coverageRows.map((row) => {
                  const washerTitle = !washer
                    ? `الغسّال: ${[...row.washerNames].join('، ')}`
                    : undefined;

                  return (
                    <tr key={row.subscription.id} className="hover:bg-[var(--glass)]">
                      <td
                        title={washerTitle}
                        className="sticky start-0 z-10 border-b border-e border-[var(--line)] bg-[var(--surface-1)] px-3 py-1.5 min-w-44 sm:min-w-60"
                      >
                        {/* السطر الأول: كود الاشتراك واسم العميل */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            href={`/dashboard/wash/${row.subscription.id}`}
                            className="tnum shrink-0 font-bold text-accent hover:underline"
                            dir="ltr"
                          >
                            {row.subscription.code}
                          </Link>
                          <span
                            className="truncate font-semibold text-[var(--text-0)]"
                            title={row.subscription.customer.name}
                          >
                            {row.subscription.customer.name}
                          </span>
                        </div>

                        {/* السطر الثاني: السيارة واللوحة والمنطقة */}
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-2)]">
                          {row.subscription.vehicle.make} {row.subscription.vehicle.model}
                          {row.subscription.vehicle.plateNo ? (
                            <>
                              {' · '}
                              <span dir="ltr" className="tnum">
                                {row.subscription.vehicle.plateNo}
                              </span>
                            </>
                          ) : null}
                          {' · '}
                          {row.subscription.area}
                        </p>
                      </td>

                      {days.map((day) => {
                        const key = dateOnlyToInput(day);
                        const dayVisits = row.visits.filter(
                          (visit) => dateOnlyToInput(visit.scheduledDate) === key
                        );
                        const isTodayDay = key === todayInput;
                        const dayTime = day.getTime();
                        const isQuiet = dayTime < minVisitTime || dayTime > maxVisitTime;
                        const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;

                        return (
                          <td
                            key={key}
                            className={cn(
                              'h-10 w-11 border-b border-e border-[var(--line)] p-1 text-center',
                              isTodayDay
                                ? 'bg-[var(--mark-accent)]/10'
                                : weekend
                                ? 'bg-[var(--glass)]/40'
                                : '',
                              isQuiet && !isTodayDay && 'opacity-60'
                            )}
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                              {dayVisits.map((visit) => {
                                const category = dayCategory(visit, today);
                                const cell = CELL[category];
                                // السبب يُقال للمتعذّرة وحدها؛ «غير مسدّد — غير مسدّد» تكرارٌ لا خبر
                                const reason = category === 'skipped' && visit.skipReason
                                  ? ` — ${REASON_LABELS[visit.skipReason] ?? visit.skipReason}`
                                  : '';
                                const isMakeup =
                                  visit.dueDate &&
                                  dateOnlyToInput(visit.scheduledDate) !== dateOnlyToInput(visit.dueDate);
                                const makeupNote = isMakeup
                                  ? ` — تعويض عن ${formatDateOnly(visit.dueDate)}`
                                  : '';
                                const cellTitle = `${cell.label}${reason}${makeupNote} · ${formatDateOnly(
                                  visit.scheduledDate
                                )}`;

                                return (
                                  <Link
                                    key={visit.id}
                                    href={`/dashboard/wash/${row.subscription.id}`}
                                    title={cellTitle}
                                    aria-label={cellTitle}
                                    className={cn(
                                      'relative flex size-7 items-center justify-center rounded-md border text-sm font-black transition-transform hover:scale-105',
                                      cell.className
                                    )}
                                  >
                                    {cell.glyph}
                                    {isMakeup && (
                                      <span className="absolute -top-0.5 -end-0.5 size-2 rounded-full bg-accent ring-1 ring-[var(--surface-1)]" />
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </Card>
    </>
  );
}
