import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BOOKING_STATUS } from '@/lib/labels';
import {
  cn,
  dayKey,
  formatBookingTime,
  formatDayLabel,
  formatWeekday,
  weekDays,
} from '@/lib/utils';

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
}: {
  start: Date;
  bookings: WeekBooking[];
  /** رموز أيام العطلة من إعدادات الدوام: FRI … */
  weekend: string[];
  today: Date;
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

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const list = (byDay.get(k) ?? []).sort(
            (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
          );
          const isOff = weekend.includes(DAY_CODES[d.getDay()]);
          const isToday = k === todayK;

          return (
            <div
              key={k}
              className={cn(
                'flex min-h-40 flex-col rounded-[var(--radius-lg)] border bg-[var(--surface-1)]',
                isToday ? 'border-accent' : 'border-[var(--line)]',
                isOff && 'opacity-60'
              )}
            >
              <div
                className={cn(
                  'border-b px-3 py-2.5',
                  isToday ? 'border-accent/40 bg-accent/10' : 'border-[var(--line)]'
                )}
              >
                <p className="text-[13px] font-bold text-[var(--text-0)]">{formatWeekday(d)}</p>
                <p className="tnum mt-0.5 text-[11px] text-[var(--text-2)]">
                  {formatDayLabel(d)}
                  {isOff ? ' · إجازة' : list.length ? ` · ${list.length} حجز` : ' · فاضي'}
                </p>
              </div>

              <div className="flex-1 space-y-1.5 p-2">
                {list.map((b) => {
                  const time = formatBookingTime(b.scheduledAt);

                  return (
                    <Link
                      key={b.id}
                      href={`?view=list&focus=${b.code}`}
                      className={cn(
                        'block rounded-[var(--radius-sm)] border border-s-2 border-[var(--line)] bg-[var(--surface-2)] p-2 transition-colors hover:border-accent',
                        STATUS_EDGE[b.status] ?? 'border-s-[var(--line-strong)]'
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="tnum text-[11px] font-semibold text-[var(--text-1)]">
                          {time ?? 'بدون وقت'}
                        </span>
                        {b.hasJob && <Badge tone="ok">أمر شغل</Badge>}
                      </div>
                      <p className="mt-1 truncate text-[12px] font-semibold text-[var(--text-0)]">
                        {b.name}
                      </p>
                      {b.service && (
                        <p className="truncate text-[11px] text-[var(--text-2)]">{b.service}</p>
                      )}
                      {b.car && (
                        <p className="truncate text-[11px] text-[var(--text-2)]">{b.car}</p>
                      )}
                    </Link>
                  );
                })}

                {list.length === 0 && !isOff && (
                  <p className="grid h-full place-items-center text-[11px] text-[var(--text-2)]">
                    —
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
