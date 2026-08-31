'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatBookingTime, formatDayLabel, formatWeekday } from '@/lib/utils';
import { STATUS_EDGE, type CalendarBooking } from './calendar';
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
 */
export function WeekGrid({ days, canWrite }: { days: DayColumn[]; canWrite: boolean }) {
  const dnd = useReschedule();

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
            'flex min-h-40 flex-col rounded-[var(--radius-lg)] border bg-[var(--surface-1)] transition-colors',
            d.isToday ? 'border-accent' : 'border-[var(--line)]',
            d.isOff && 'opacity-60',
            dnd.over === d.key && 'border-accent bg-accent/5 ring-1 ring-accent'
          )}
        >
          <div
            className={cn(
              'border-b px-3 py-2.5',
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

              return (
                <Link
                  key={b.id}
                  href={`?view=list&filter=all&q=${b.code}`}
                  draggable={draggable}
                  onDragStart={(e) => {
                    if (!draggable) return e.preventDefault();
                    e.dataTransfer.effectAllowed = 'move';
                    dnd.begin(b, d.key);
                  }}
                  onDragEnd={() => dnd.end()}
                  className={cn(
                    'block rounded-[var(--radius-sm)] border border-s-2 border-[var(--line)] bg-[var(--surface-2)] p-2 transition-all hover:border-accent',
                    STATUS_EDGE[b.status] ?? 'border-s-[var(--line-strong)]',
                    draggable && 'cursor-grab active:cursor-grabbing',
                    dnd.dragging?.id === b.id && 'opacity-40',
                    isMoving && 'pointer-events-none opacity-50'
                  )}
                >
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className="tnum text-[11px] font-semibold text-[var(--text-1)]">
                      {isMoving ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        (time ?? 'بدون وقت')
                      )}
                    </span>
                    {b.hasJob && <Badge tone="ok">أمر شغل</Badge>}
                  </div>
                  <p className="mt-1 truncate text-[12px] font-semibold text-[var(--text-0)]">
                    {b.name}
                  </p>
                  {b.service && (
                    <p className="truncate text-[11px] text-[var(--text-2)]">{b.service}</p>
                  )}
                  {b.car && <p className="truncate text-[11px] text-[var(--text-2)]">{b.car}</p>}
                </Link>
              );
            })}

            {d.bookings.length === 0 && !d.isOff && (
              <p className="grid h-full place-items-center text-[11px] text-[var(--text-2)]">
                {dnd.over === d.key ? 'أفلت هنا' : '—'}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
