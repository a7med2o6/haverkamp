'use client';

import { useState } from 'react';
import type { CalendarBooking } from './calendar';
import { DayPanel } from './day-panel';

export interface CalendarShellDay {
  key: string;
  date: Date;
  bookings: CalendarBooking[];
}

/**
 * الخطّاط والمنطق المشترك لشبكات التقويم (الشهر والأسبوع).
 * يدير اختيار اليوم وتوسيع الحجز ويربط التقويم باللوح الجانبي.
 */
export function useCalendarShell({
  days,
  defaultDay,
}: {
  days: CalendarShellDay[];
  defaultDay: string;
}) {
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const selectedItem = days.find((d) => d.key === selectedDay);
  const selectedDate = selectedItem?.date ?? new Date(`${selectedDay}T00:00:00`);
  const selectedDayBookings = selectedItem?.bookings ?? [];

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

  return {
    selectedDay,
    selectedDate,
    selectedDayBookings,
    expandedBookingId,
    handleSelectDay,
    handleSelectBooking,
    handleToggleExpand,
  };
}

/**
 * هيكل التقويم التفاعلي: يعرض شبكة الأيام وبجوارها لوح اليوم على سطح المكتب،
 * وأسفل الشبكة على الشاشات الأصغر (الجوال والتابلت md–lg).
 */
export function CalendarShell({
  selectedDay,
  selectedDate,
  selectedDayBookings,
  expandedBookingId,
  onToggleExpand,
  canWrite,
  canWorkshop = false,
  customers = [],
  children,
}: {
  selectedDay: string;
  selectedDate: Date;
  selectedDayBookings: CalendarBooking[];
  expandedBookingId: string | null;
  onToggleExpand: (id: string) => void;
  canWrite: boolean;
  canWorkshop?: boolean;
  customers?: Array<{ id: string; name: string; phone: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:items-start">
      <div className="min-w-0">
        {children}
        <DayPanel
          variant="inline"
          selectedDay={selectedDay}
          selectedDate={selectedDate}
          bookings={selectedDayBookings}
          expandedBookingId={expandedBookingId}
          onToggleExpand={onToggleExpand}
          canWrite={canWrite}
          canWorkshop={canWorkshop}
          customers={customers}
        />
      </div>

      <DayPanel
        variant="aside"
        selectedDay={selectedDay}
        selectedDate={selectedDate}
        bookings={selectedDayBookings}
        expandedBookingId={expandedBookingId}
        onToggleExpand={onToggleExpand}
        canWrite={canWrite}
        canWorkshop={canWorkshop}
        customers={customers}
      />
    </div>
  );
}
