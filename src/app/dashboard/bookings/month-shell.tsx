'use client';

import { useMemo, useState } from 'react';
import { dayKey } from '@/lib/utils';
import { DayPanel } from './day-panel';
import { MonthGrid, type MonthDay } from './month-grid';

/**
 * الحاوية التفاعلية للتقويم الشهري على جانب سطح المكتب.
 * تدير اختيار اليوم والحجز المتوسع، وتربط شبكة الشهر باللوح الجانبي.
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

  const [selectedDay, setSelectedDay] = useState<string>(defaultDay);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // البحث عن تاريخ وموضوع اليوم المختار
  const selectedMonthDay = days.find((d) => d.key === selectedDay);
  const selectedDate = selectedMonthDay?.date ?? new Date(`${selectedDay}T00:00:00`);
  const selectedDayBookings = selectedMonthDay?.bookings ?? [];

  function handleSelectDay(key: string) {
    setSelectedDay(key);
  }

  function handleSelectBooking(bookingId: string, dayKeyVal: string) {
    setSelectedDay(dayKeyVal);
    setExpandedBookingId((prev) => (prev === bookingId ? null : bookingId));
  }

  function handleToggleExpand(bookingId: string) {
    setExpandedBookingId((prev) => (prev === bookingId ? null : bookingId));
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:items-start">
      <div className="min-w-0">
        <MonthGrid
          days={days}
          canWrite={canWrite}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
          onSelectBooking={handleSelectBooking}
        />
      </div>

      <DayPanel
        selectedDay={selectedDay}
        selectedDate={selectedDate}
        bookings={selectedDayBookings}
        expandedBookingId={expandedBookingId}
        onToggleExpand={handleToggleExpand}
        canWrite={canWrite}
        canWorkshop={canWorkshop}
        customers={customers}
      />
    </div>
  );
}
