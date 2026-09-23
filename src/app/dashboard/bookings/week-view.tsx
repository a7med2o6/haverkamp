'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BOOKING_STATUS } from '@/lib/labels';
import { DAY_CODES, cn, dayKey, formatDayLabel, weekDays } from '@/lib/utils';
import { LEGEND_STATUSES, STATUS_EDGE, type CalendarBooking } from './calendar';
import { CalendarShell, useCalendarShell } from './calendar-shell';
import { WeekGrid, type DayColumn } from './week-grid';

/**
 * تقويم الحجوزات الأسبوعي.
 * الأسبوع أفق التفاصيل: الخانة تتّسع لاسم العميل وخدمته وسيارته.
 * يشارك MonthView في نفس غلاف CalendarShell لإظهار اللوح الجانبي لليوم المختار.
 */
export function WeekView({
  start,
  bookings,
  weekend,
  today,
  canWrite,
  canWorkshop = false,
  customers = [],
}: {
  start: Date;
  bookings: CalendarBooking[];
  /** رموز أيام العطلة من إعدادات الدوام: FRI … */
  weekend: string[];
  today: Date;
  canWrite: boolean;
  canWorkshop?: boolean;
  customers?: Array<{ id: string; name: string; phone: string }>;
}) {
  const days = weekDays(start);
  const end = days[6];

  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const k = dayKey(b.scheduledAt);
    byDay.set(k, [...(byDay.get(k) ?? []), b]);
  }

  const shift = (weeks: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + weeks * 7);
    return dayKey(d);
  };

  const todayK = dayKey(today);

  const columns: DayColumn[] = days.map((d) => {
    const k = dayKey(d);
    return {
      key: k,
      date: d,
      isOff: weekend.includes(DAY_CODES[d.getDay()]),
      isToday: k === todayK,
      bookings: (byDay.get(k) ?? []).sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
      ),
    };
  });

  // يُقرأ مرةً عند التركيب فقط، فلا حاجة لتذكّره
  const defaultDay = columns.some((d) => d.isToday) ? todayK : dayKey(start);

  const {
    selectedDay,
    selectedDate,
    selectedDayBookings,
    expandedBookingId,
    handleSelectDay,
    handleSelectBooking,
    handleToggleExpand,
  } = useCalendarShell({
    days: columns,
    defaultDay,
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[var(--text-0)]">
          {formatDayLabel(start)} — {formatDayLabel(end)}
        </h2>

        <div className="flex items-center gap-1.5">
          <NavLink href={`?view=week&week=${shift(-1)}`} label="الأسبوع السابق">
            <ChevronRight className="size-4" />
          </NavLink>
          <Link
            href="?view=week"
            className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-1)] transition-colors hover:border-accent hover:text-accent"
          >
            هذا الأسبوع
          </Link>
          <NavLink href={`?view=week&week=${shift(1)}`} label="الأسبوع التالي">
            <ChevronLeft className="size-4" />
          </NavLink>
        </div>
      </div>

      <CalendarShell
        selectedDay={selectedDay}
        selectedDate={selectedDate}
        selectedDayBookings={selectedDayBookings}
        expandedBookingId={expandedBookingId}
        onToggleExpand={handleToggleExpand}
        canWrite={canWrite}
        canWorkshop={canWorkshop}
        customers={customers}
      >
        <WeekGrid
          days={columns}
          canWrite={canWrite}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
          onSelectBooking={handleSelectBooking}
        />
      </CalendarShell>

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
