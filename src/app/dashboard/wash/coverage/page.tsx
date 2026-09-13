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
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { BulkDayAction } from './bulk-day-action';

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
  OPERATIONAL: 'سبب تشغيلي',
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
  const coverageRows = [...rows.values()].sort((a, b) =>
    a.subscription.area.localeCompare(b.subscription.area, 'ar') ||
    a.subscription.code.localeCompare(b.subscription.code)
  );
  const summary = { completed: 0, planned: 0, missed: 0, skipped: 0, blocked: 0 };
  for (const visit of visits) summary[dayCategory(visit, today)]++;
  const todayInput = dateOnlyToInput(today);
  const initialDate = today >= monthStart && today <= monthEnd ? todayInput : dateOnlyToInput(monthStart);
  const canWrite = can(session.user.role, 'wash:write');

  return (
    <>
      <PageHeader
        title="تغطية الشهر"
        description={monthName(year, month)}
        actions={
          <nav aria-label="التنقل بين أشهر التغطية" className="flex items-center gap-1.5">
            <Link
              href={coverageHref(previous.year, previous.month)}
              aria-disabled={previous.year < MIN_YEAR}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), previous.year < MIN_YEAR && 'pointer-events-none opacity-50')}
            >
              <ChevronRight /> السابق
            </Link>
            <Link href={coverageHref(currentYear, currentMonth)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              الشهر الحالي
            </Link>
            <Link
              href={coverageHref(next.year, next.month)}
              aria-disabled={next.year > MAX_YEAR}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), next.year > MAX_YEAR && 'pointer-events-none opacity-50')}
            >
              التالي <ChevronLeft />
            </Link>
          </nav>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(CELL) as Array<keyof typeof CELL>).map((key) => (
          <div key={key} className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-2)]">
              <span className={cn('flex size-6 items-center justify-center rounded-md border text-sm font-black', CELL[key].className)}>{CELL[key].glyph}</span>
              {CELL[key].label}
            </div>
            <p className="tnum mt-1 text-xl font-extrabold text-[var(--text-0)]">{summary[key]}</p>
          </div>
        ))}
      </div>

      <Card className="mb-4">
        <CardBody className="space-y-4">
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <label className="text-[12px] font-medium text-[var(--text-1)]">
              المنطقة
              <Select name="area" defaultValue={area} className="mt-1.5">
                <option value="">كل المناطق</option>
                {areas.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </label>
            <label className="text-[12px] font-medium text-[var(--text-1)]">
              الغسّيل
              <Select name="washer" defaultValue={washer} className="mt-1.5">
                <option value="">كل الغسّيلين</option>
                <option value="unassigned">غير مسند</option>
                {washers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </Select>
            </label>
            <button type="submit" className={buttonVariants({ variant: 'secondary' })}>تطبيق الفلاتر</button>
          </form>
          {canWrite && (
            <div className="border-t border-[var(--line)] pt-4">
              <BulkDayAction
                minDate={dateOnlyToInput(monthStart)}
                maxDate={dateOnlyToInput(monthEnd)}
                initialDate={initialDate}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>شبكة التغطية</CardTitle>
            <p className="mt-1 text-[12px] text-[var(--text-2)]">الجمعة والسبت مميّزان بصرياً، ولا يُستبعدان من الجدول.</p>
          </div>
          <Badge tone="neutral">{coverageRows.length} اشتراك</Badge>
        </CardHeader>
        <div className="max-h-[68vh] w-full overflow-auto" tabIndex={0} aria-label="جدول تغطية غسيل الشهر">
          <table className="min-w-max border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky start-0 top-0 z-30 min-w-64 border-b border-e border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-start text-[12px] text-[var(--text-1)]">
                  الاشتراك
                </th>
                {days.map((day) => {
                  const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;
                  return (
                    <th
                      key={day.toISOString()}
                      className={cn('sticky top-0 z-20 w-11 border-b border-e border-[var(--line)] bg-[var(--surface-2)] px-1 py-2 text-center', weekend && 'bg-[var(--surface-3)] text-warn')}
                    >
                      <span className="tnum block text-[13px] font-bold">{day.getUTCDate()}</span>
                      <span className="block text-[9px]">{day.getUTCDay() === 5 ? 'جم' : day.getUTCDay() === 6 ? 'سب' : 'ـ'}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {coverageRows.length === 0 ? (
                <tr><td colSpan={days.length + 1} className="px-5 py-14 text-center text-sm text-[var(--text-2)]">لا توجد غسلات مطابقة لهذا الشهر والفلاتر.</td></tr>
              ) : (
                coverageRows.map((row) => (
                  <tr key={row.subscription.id} className="hover:bg-[var(--glass)]">
                    <td className="sticky start-0 z-10 border-b border-e border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
                      <Link href={`/dashboard/wash/${row.subscription.id}`} className="tnum font-bold text-accent hover:underline" dir="ltr">
                        {row.subscription.code}
                      </Link>
                      <p className="mt-1 max-w-56 truncate font-semibold text-[var(--text-0)]">{row.subscription.customer.name}</p>
                      <p className="mt-0.5 max-w-56 truncate text-[10px] text-[var(--text-2)]">
                        {row.subscription.vehicle.make} {row.subscription.vehicle.model}
                        {row.subscription.vehicle.plateNo ? ` · ${row.subscription.vehicle.plateNo}` : ''}
                      </p>
                      <p className="mt-0.5 max-w-56 truncate text-[10px] text-[var(--text-2)]">
                        {row.subscription.area} · {[...row.washerNames].join('، ')}
                      </p>
                    </td>
                    {days.map((day) => {
                      const key = dateOnlyToInput(day);
                      const dayVisits = row.visits.filter((visit) => dateOnlyToInput(visit.scheduledDate) === key);
                      const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;
                      return (
                        <td key={key} className={cn('h-12 w-11 border-b border-e border-[var(--line)] p-1 text-center', weekend && 'bg-[var(--glass)]')}>
                          <div className="flex flex-col items-center gap-0.5">
                            {dayVisits.map((visit) => {
                              const category = dayCategory(visit, today);
                              const cell = CELL[category];
                              const reason = visit.skipReason ? ` — ${REASON_LABELS[visit.skipReason] ?? visit.skipReason}` : '';
                              return (
                                <span
                                  key={visit.id}
                                  title={`${cell.label}${reason} · ${formatDateOnly(visit.scheduledDate)}`}
                                  aria-label={`${cell.label}${reason}`}
                                  className={cn('flex size-7 items-center justify-center rounded-md border text-sm font-black', cell.className)}
                                >
                                  {cell.glyph}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] px-4 py-3 text-[11px] text-[var(--text-2)]">
          {(Object.keys(CELL) as Array<keyof typeof CELL>).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5"><strong className="text-[var(--text-0)]">{CELL[key].glyph}</strong>{CELL[key].label}</span>
          ))}
        </div>
      </Card>
    </>
  );
}
