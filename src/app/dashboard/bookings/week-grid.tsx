'use client';

import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatBookingTime, formatDayLabel, formatWeekday } from '@/lib/utils';
import { STATUS_CHIP, STATUS_EDGE, type CalendarBooking } from './calendar';
import { useReschedule } from './use-reschedule';

export interface DayColumn {
  key: string;
  date: Date;
  isOff: boolean;
  isToday: boolean;
  bookings: CalendarBooking[];
}

/**
 * شبكة أيام الأسبوع.
 * السحب بين الأعمدة يؤجّل الحجز يوماً كاملاً بساعته — أسرع من فتح نافذة
 * التعديل، وهو أكثر ما يتكرّر في الاستقبال. الأصناف نفسها تعمل باللمس
 * عبر أزرار النقل في نافذة التعديل، فالسحب إضافة لا بديل.
 * النقر على اليوم أو شريحة الحجز يحدده في اللوح الجانبي.
 */
export function WeekGrid({
  days,
  canWrite,
  selectedDay,
  onSelectDay,
  onSelectBooking,
}: {
  days: DayColumn[];
  canWrite: boolean;
  selectedDay?: string;
  onSelectDay?: (key: string) => void;
  onSelectBooking?: (id: string, dayKey: string) => void;
}) {
  const dnd = useReschedule();

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((d) => {
        const isSelected = selectedDay === d.key;

        return (
          <div
            key={d.key}
            role="button"
            tabIndex={0}
            onClick={() => onSelectDay?.(d.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectDay?.(d.key);
              }
            }}
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
              'flex min-h-40 flex-col rounded-[var(--radius-lg)] border bg-[var(--surface-1)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent',
              d.isToday ? 'border-accent' : 'border-[var(--line)]',
              d.isOff && 'opacity-60',
              dnd.over === d.key && 'border-accent bg-accent/5 ring-1 ring-accent',
              isSelected && 'ring-2 ring-accent z-10 relative'
            )}
          >
            <div
              className={cn(
                'border-b px-3 py-2.5 rounded-t-[var(--radius-lg)]',
                d.isToday ? 'border-accent/40 bg-accent/10' : 'border-[var(--line)]'
              )}
            >
              <p className="text-[13px] font-bold text-[var(--text-0)]">{formatWeekday(d.date)}</p>
              <p className="tnum mt-0.5 text-[11px] text-[var(--text-2)]">
                {formatDayLabel(d.date)}
                {d.isOff
                  ? ' · إجازة'
                  : d.bookings.length
                    ? ` · ${d.bookings.length} حجز`
                    : ' · فاضي'}
              </p>
            </div>

            <div className="flex-1 space-y-1.5 p-2">
              {d.bookings.map((b) => {
                const time = formatBookingTime(b.scheduledAt);
                const isMoving = dnd.moving === b.id;
                // أمر الشغل يثبّت الموعد — النقل يجري من أمر الشغل عندها
                const draggable = canWrite && !b.hasJob && !dnd.pending;
                const isCancelled = b.status === 'CANCELLED';

                return (
                  <div
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    draggable={draggable}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBooking?.(b.id, d.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelectBooking?.(b.id, d.key);
                      }
                    }}
                    onDragStart={(e) => {
                      if (!draggable) return e.preventDefault();
                      e.dataTransfer.effectAllowed = 'move';
                      dnd.begin(b, d.key);
                    }}
                    onDragEnd={() => dnd.end()}
                    className={cn(
                      'block rounded-[var(--radius-sm)] border border-s-2 border-[var(--line)] p-2 transition-all hover:border-accent cursor-pointer select-none',
                      STATUS_EDGE[b.status] ?? 'border-s-[var(--line-strong)]',
                      STATUS_CHIP[b.status] ?? 'bg-[var(--surface-2)]',
                      draggable && 'cursor-grab active:cursor-grabbing',
                      dnd.dragging?.id === b.id && 'opacity-40',
                      isMoving && 'pointer-events-none opacity-50'
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-1.5">
                      <span className="tnum text-[11px] font-semibold text-[var(--text-1)]" dir="ltr">
                        {isMoving ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          (time ?? 'بدون وقت')
                        )}
                      </span>
                      {b.hasJob && <Badge tone="ok">أمر شغل</Badge>}
                    </div>
                    <p
                      className={cn(
                        'mt-1 truncate text-[12px] font-semibold text-[var(--text-0)]',
                        isCancelled && 'line-through opacity-75'
                      )}
                    >
                      {b.name}
                    </p>
                    {b.service && (
                      <p className="truncate text-[11px] text-[var(--text-2)]">{b.service}</p>
                    )}
                    {b.car && <p className="truncate text-[11px] text-[var(--text-2)]">{b.car}</p>}
                  </div>
                );
              })}

              {d.bookings.length === 0 && !d.isOff && (
                <p className="grid h-full place-items-center text-[11px] text-[var(--text-2)]">
                  {dnd.over === d.key ? 'أفلت هنا' : '—'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
