'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn, formatBookingTime, formatDayLabel, formatWeekday } from '@/lib/utils';
import { STATUS_EDGE, type CalendarBooking } from './calendar';
import { useReschedule } from './use-reschedule';

export interface MonthDay {
  key: string;
  date: Date;
  /** من الشهر المعروض — أطراف الشبكة من الشهرين المجاورين */
  inMonth: boolean;
  isOff: boolean;
  isToday: boolean;
  bookings: CalendarBooking[];
}

/** ما تتّسع له الخانة قبل أن يصير الباقي «+N» */
const MAX_CHIPS = 3;

/**
 * شبكة الشهر كاملاً — سبعة أعمدة وأسابيع كاملة.
 * الخانة هنا أضيق من عمود الأسبوع، فالبطاقة تُختصر إلى الساعة والاسم
 * والباقي يُقرأ في عرض الأسبوع. على الجوال تسقط الشبكة إلى قائمة أيام،
 * فسبع خانات في عرض الهاتف لا تُقرأ.
 */
export function MonthGrid({ days, canWrite }: { days: MonthDay[]; canWrite: boolean }) {
  const dnd = useReschedule();

  return (
    <>
      {/* الشبكة — من المتوسط فما فوق */}
      <div className="hidden md:block">
        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {days.slice(0, 7).map((d) => (
            <p
              key={d.key}
              className="truncate px-1 text-center text-[11px] font-semibold text-[var(--text-2)]"
            >
              {formatWeekday(d.date)}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <div
              key={d.key}
              onDragOver={(e) => {
                if (!canWrite || !dnd.dragging) return;
                e.preventDefault();
                dnd.enter(d.key);
              }}
              onDragLeave={() => dnd.leave(d.key)}
              onDrop={(e) => {
                if (!canWrite) return;
                e.preventDefault();
                dnd.drop(d.key);
              }}
              className={cn(
                'flex min-h-28 flex-col rounded-[var(--radius-sm)] border p-1.5 transition-colors lg:min-h-32',
                d.isToday ? 'border-accent bg-accent/5' : 'border-[var(--line)]',
                d.inMonth ? 'bg-[var(--surface-1)]' : 'bg-transparent',
                !d.inMonth && 'opacity-45',
                d.isOff && d.inMonth && 'bg-[var(--surface-2)]',
                dnd.over === d.key && 'border-accent bg-accent/10 ring-1 ring-accent'
              )}
            >
              <div className="mb-1 flex items-baseline justify-between gap-1">
                <Link
                  href={`?view=week&week=${d.key}`}
                  title="عرض أسبوع هذا اليوم"
                  className={cn(
                    'tnum rounded px-1 text-[12px] font-bold transition-colors hover:text-accent',
                    d.isToday ? 'text-accent' : 'text-[var(--text-0)]'
                  )}
                >
                  {d.date.getDate()}
                </Link>
                {d.bookings.length > 0 && (
                  <span className="tnum text-[10px] text-[var(--text-2)]">
                    {d.bookings.length}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-1">
                {d.bookings.slice(0, MAX_CHIPS).map((b) => (
                  <Chip key={b.id} booking={b} day={d.key} canWrite={canWrite} dnd={dnd} />
                ))}

                {d.bookings.length > MAX_CHIPS && (
                  <Link
                    href={`?view=week&week=${d.key}`}
                    className="block px-1 text-[10px] font-semibold text-accent hover:underline"
                  >
                    +{d.bookings.length - MAX_CHIPS} أخرى
                  </Link>
                )}

                {d.bookings.length === 0 && dnd.over === d.key && (
                  <p className="grid h-full place-items-center text-[10px] text-accent">
                    أفلت هنا
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الجوال — أيام الشهر التي فيها حجوزات فقط */}
      <div className="space-y-2 md:hidden">
        {days
          .filter((d) => d.inMonth && d.bookings.length > 0)
          .map((d) => (
            <div
              key={d.key}
              className={cn(
                'rounded-[var(--radius-lg)] border bg-[var(--surface-1)] p-2.5',
                d.isToday ? 'border-accent' : 'border-[var(--line)]'
              )}
            >
              <p className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold text-[var(--text-0)]">
                  {formatWeekday(d.date)}{' '}
                  <span className="tnum font-medium text-[var(--text-2)]">
                    {formatDayLabel(d.date)}
                  </span>
                </span>
                <span className="tnum text-[11px] text-[var(--text-2)]">
                  {d.bookings.length} حجز
                </span>
              </p>
              <div className="space-y-1">
                {d.bookings.map((b) => (
                  <Chip key={b.id} booking={b} day={d.key} canWrite={false} dnd={dnd} />
                ))}
              </div>
            </div>
          ))}

        {days.every((d) => !d.inMonth || d.bookings.length === 0) && (
          <p className="rounded-[var(--radius-lg)] border border-[var(--line)] p-6 text-center text-[13px] text-[var(--text-2)]">
            لا توجد حجوزات هذا الشهر
          </p>
        )}
      </div>
    </>
  );
}

/** بطاقة مختصرة: الساعة والاسم — تفاصيل الخدمة والسيارة في عرض الأسبوع */
function Chip({
  booking: b,
  day,
  canWrite,
  dnd,
}: {
  booking: CalendarBooking;
  day: string;
  canWrite: boolean;
  dnd: ReturnType<typeof useReschedule>;
}) {
  const time = formatBookingTime(b.scheduledAt);
  const isMoving = dnd.moving === b.id;
  // أمر الشغل يثبّت الموعد — النقل يجري من أمر الشغل عندها
  const draggable = canWrite && !b.hasJob && !dnd.pending;

  return (
    <Link
      href={`?view=list&filter=all&q=${b.code}`}
      title={[time ?? 'بدون وقت', b.name, b.service, b.car].filter(Boolean).join(' · ')}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return e.preventDefault();
        e.dataTransfer.effectAllowed = 'move';
        dnd.begin(b, day);
      }}
      onDragEnd={() => dnd.end()}
      className={cn(
        'flex items-baseline gap-1 rounded-[4px] border-s-2 border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-1 transition-colors hover:border-accent',
        STATUS_EDGE[b.status] ?? 'border-s-[var(--line-strong)]',
        draggable && 'cursor-grab active:cursor-grabbing',
        dnd.dragging?.id === b.id && 'opacity-40',
        isMoving && 'pointer-events-none opacity-50'
      )}
    >
      {isMoving ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : (
        <span className="tnum shrink-0 text-[10px] font-semibold text-[var(--text-1)]">
          {time ?? '—'}
        </span>
      )}
      <span className="truncate text-[11px] text-[var(--text-0)]">{b.name}</span>
    </Link>
  );
}
