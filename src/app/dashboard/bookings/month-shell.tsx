'use client';

import { useMemo } from 'react';
import { dayKey } from '@/lib/utils';
import { CalendarShell, useCalendarShell } from './calendar-shell';
import { MonthGrid, type MonthDay } from './month-grid';

/**
 * الحاوية التفاعلية للتقويم الشهري.
 * تدير اختيار اليوم والحجز المتوسع عبر CalendarShell، وتربط شبكة الشهر باللوح الجانبي.
 */
export function MonthShell({
  monthStart,
  days,
  canWrite,
  canWorkshop,
  customers,
  today,
}: {
  monthStart: Date;
  days: MonthDay[];
  canWrite: boolean;
  canWorkshop: boolean;
  customers: Array<{ id: string; name: string; phone: string }>;
  today: Date;
}) {
  const todayK = dayKey(today);

  // اليوم المختار افتراضياً: اليوم الحالي إن كان ضمن أيام الشهر المعروض، وإلا 1 من الشهر
  const defaultDay = useMemo(() => {
    const hasTodayInMonth = days.some((d) => d.isToday && d.inMonth);
    if (hasTodayInMonth) return todayK;
    return dayKey(monthStart);
  }, [days, todayK, monthStart]);

  const {
    selectedDay,
    selectedDate,
    selectedDayBookings,
    expandedBookingId,
    handleSelectDay,
    handleSelectBooking,
    handleToggleExpand,
  } = useCalendarShell({
    days,
    defaultDay,
  });

  return (
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
      <MonthGrid
        days={days}
        canWrite={canWrite}
        selectedDay={selectedDay}
        onSelectDay={handleSelectDay}
        onSelectBooking={handleSelectBooking}
        customers={customers}
      />
    </CalendarShell>
  );
}
