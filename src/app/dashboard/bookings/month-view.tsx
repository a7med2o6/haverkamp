import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BOOKING_STATUS } from '@/lib/labels';
import { DAY_CODES, cn, dayKey, formatMonthLabel, monthKey } from '@/lib/utils';
import { LEGEND_STATUSES, STATUS_CHIP, STATUS_EDGE, type CalendarBooking } from './calendar';
import type { MonthDay } from './month-grid';
import { MonthShell } from './month-shell';

/**
 * تقويم الحجوزات الشهري — الشهر كاملاً في شاشة واحدة.
 * أفق التخطيط عند الاستقبال شهر لا أسبوع: توزّع الضغط ومواعيد العملاء
 * البعيدة لا تظهر في سبعة أيام. الخانة الضيقة تكفي للساعة والاسم،
 * واللوح الجانبي يعرض تفاصيل اليوم المختار.
 */
export function MonthView({
  monthStart,
  days,
  bookings,
  weekend,
  today,
  canWrite,
  canWorkshop,
  customers,
}: {
  monthStart: Date;
  /** خانات الشبكة — أسابيع كاملة تتجاوز حدّي الشهر */
  days: Date[];
  bookings: CalendarBooking[];
  /** رموز أيام العطلة من إعدادات الدوام: FRI … */
  weekend: string[];
  today: Date;
  canWrite: boolean;
  canWorkshop: boolean;
  customers: Array<{ id: string; name: string; phone: string }>;
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
        {/* عنوان الشهر ومفتاح الألوان وشارة العدّاد */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[var(--text-0)]">
              {formatMonthLabel(monthStart)}
            </h2>
            <Badge tone="muted" className="tnum">
              {inMonthCount} حجز
            </Badge>
          </div>

          {/* دليل الألوان المدمج شريطياً */}
          <div className="ms-2 hidden sm:flex flex-wrap items-center gap-1.5">
            {LEGEND_STATUSES.map((s) => (
              <span
                key={s}
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border-s-2',
                  STATUS_CHIP[s],
                  STATUS_EDGE[s]
                )}
              >
                {BOOKING_STATUS[s].label}
              </span>
            ))}
          </div>
        </div>

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

      {/* المفتاح بالشهر: الانتقال لشهرٍ آخر يُبقي المكوّن حيّاً، فيبقى اختيار يومٍ من الشهر السابق لا خانة له */}
      <MonthShell
        key={monthKey(monthStart)}
        monthStart={monthStart}
        days={cells}
        canWrite={canWrite}
        canWorkshop={canWorkshop}
        customers={customers}
        today={today}
      />
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
