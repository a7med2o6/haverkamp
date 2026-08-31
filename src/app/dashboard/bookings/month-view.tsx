import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BOOKING_STATUS } from '@/lib/labels';
import { DAY_CODES, cn, dayKey, formatMonthLabel, monthKey } from '@/lib/utils';
import { LEGEND_STATUSES, STATUS_EDGE, type CalendarBooking } from './calendar';
import { MonthGrid, type MonthDay } from './month-grid';

/**
 * تقويم الحجوزات الشهري — الشهر كاملاً في شاشة واحدة.
 * أفق التخطيط عند الاستقبال شهر لا أسبوع: توزّع الضغط ومواعيد العملاء
 * البعيدة لا تظهر في سبعة أيام. الخانة الضيقة تكفي للساعة والاسم،
 * ومن أراد التفاصيل نقر على اليوم فانتقل إلى عرض الأسبوع.
 */
export function MonthView({
  monthStart,
  days,
  bookings,
  weekend,
  today,
  canWrite,
}: {
  monthStart: Date;
  /** خانات الشبكة — أسابيع كاملة تتجاوز حدّي الشهر */
  days: Date[];
  bookings: CalendarBooking[];
  /** رموز أيام العطلة من إعدادات الدوام: FRI … */
  weekend: string[];
  today: Date;
  canWrite: boolean;
}) {
  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const k = dayKey(b.scheduledAt);
    byDay.set(k, [...(byDay.get(k) ?? []), b]);
  }

  const todayK = dayKey(today);
  const month = monthStart.getMonth();

  const cells: MonthDay[] = days.map((d) => {
    const k = dayKey(d);
    return {
      key: k,
      date: d,
      inMonth: d.getMonth() === month,
      isOff: weekend.includes(DAY_CODES[d.getDay()]),
      isToday: k === todayK,
      bookings: (byDay.get(k) ?? []).sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
      ),
    };
  });

  const inMonthCount = cells.reduce(
    (n, c) => n + (c.inMonth ? c.bookings.length : 0),
    0
  );

  const shift = (months: number) =>
    monthKey(new Date(monthStart.getFullYear(), month + months, 1));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[var(--text-0)]">
          {formatMonthLabel(monthStart)}
          <span className="tnum ms-2 text-[13px] font-medium text-[var(--text-2)]">
            {inMonthCount} حجز
          </span>
        </h2>

        <div className="flex items-center gap-1.5">
          <NavLink href={`?view=month&month=${shift(-1)}`} label="الشهر السابق">
            <ChevronRight className="size-4" />
          </NavLink>
          <Link
            href="?view=month"
            className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-1)] transition-colors hover:border-accent hover:text-accent"
          >
            هذا الشهر
          </Link>
          <NavLink href={`?view=month&month=${shift(1)}`} label="الشهر التالي">
            <ChevronLeft className="size-4" />
          </NavLink>
        </div>
      </div>

      <MonthGrid days={cells} canWrite={canWrite} />

      {/* دليل الألوان */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-2)]">
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className={cn('inline-block h-3 w-0.5 rounded-full border-s-2', STATUS_EDGE[s])}
              style={{ borderInlineStartWidth: 3 }}
            />
            {BOOKING_STATUS[s].label}
          </span>
        ))}
      </div>
    </>
  );
}

function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-[var(--line)] text-[var(--text-2)] transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </Link>
  );
}
