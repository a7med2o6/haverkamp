import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BOOKING_STATUS } from '@/lib/labels';
import { cn, dayKey, formatDayLabel, weekDays } from '@/lib/utils';
import { WeekGrid, type DayColumn } from './week-grid';

export interface WeekBooking {
  id: string;
  code: string;
  scheduledAt: Date;
  status: string;
  name: string;
  car: string;
  service: string;
  hasJob: boolean;
}

/** ألوان الحالة على حافة البطاقة — تُقرأ باللمحة دون قراءة النص */
const STATUS_EDGE: Record<string, string> = {
  PENDING: 'border-s-warn',
  CONFIRMED: 'border-s-accent',
  IN_PROGRESS: 'border-s-info',
  COMPLETED: 'border-s-ok',
  CANCELLED: 'border-s-[var(--line-strong)]',
  NO_SHOW: 'border-s-danger',
};

/**
 * تقويم الحجوزات الأسبوعي.
 * الأسبوع أفق تخطيط الورشة: يُظهر توزّع الضغط ويبقي مساحة لقراءة اسم
 * العميل وخدمته — التقويم الشهري يضيّق الخانة حتى تختفي التفاصيل.
 */
export function WeekView({
  start,
  bookings,
  weekend,
  today,
  canWrite,
}: {
  start: Date;
  bookings: WeekBooking[];
  /** رموز أيام العطلة من إعدادات الدوام: FRI … */
  weekend: string[];
  today: Date;
  canWrite: boolean;
}) {
  const days = weekDays(start);
  const end = days[6];

  const byDay = new Map<string, WeekBooking[]>();
  for (const b of bookings) {
    const k = dayKey(b.scheduledAt);
    byDay.set(k, [...(byDay.get(k) ?? []), b]);
  }

  const shift = (weeks: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + weeks * 7);
    return dayKey(d);
  };

  const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
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

      <WeekGrid days={columns} canWrite={canWrite} />

      {/* دليل الألوان */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-2)]">
        {(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED'] as const).map((s) => (
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
