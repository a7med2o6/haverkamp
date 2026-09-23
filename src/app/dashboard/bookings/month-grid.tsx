'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, dayKey, formatBookingTime, formatWeekday } from '@/lib/utils';
import { STATUS_CHIP, STATUS_EDGE, type CalendarBooking } from './calendar';
import { BookingFormButton } from './bookings-client';
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
 * الخانة هنا أضيق من عمود الأسبوع، فالبطاقة تُختصر إلى الساعة والاسم.
 * النقر على اليوم أو البطاقة يحدده في اللوح الجانبي دون مغادرة الصفحة.
 */
export function MonthGrid({
  days,
  canWrite,
  selectedDay,
  onSelectDay,
  onSelectBooking,
  customers = [],
}: {
  days: MonthDay[];
  canWrite: boolean;
  selectedDay?: string;
  onSelectDay?: (key: string) => void;
  onSelectBooking?: (id: string, dayKey: string) => void;
  customers?: Array<{ id: string; name: string; phone: string }>;
}) {
  const dnd = useReschedule();
  const todayK = dayKey(new Date());

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
          {days.map((d) => {
            const isSelected = selectedDay === d.key;
            const isPastDay = d.key < todayK;

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
                  'group relative flex min-h-24 flex-col rounded-[var(--radius-sm)] border p-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  d.isToday ? 'border-accent bg-accent/5' : 'border-[var(--line)]',
                  d.inMonth ? 'bg-[var(--surface-1)]' : 'bg-transparent',
                  !d.inMonth && 'opacity-45',
                  d.isOff && d.inMonth && 'bg-[var(--surface-2)]',
                  dnd.over === d.key && 'border-accent bg-accent/10 ring-1 ring-accent',
                  isSelected && 'ring-2 ring-accent z-10'
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'tnum rounded px-1 text-[12px] font-bold select-none',
                      d.isToday
                        ? 'text-accent font-extrabold'
                        : isPastDay
                          ? 'text-[var(--text-2)]'
                          : 'text-[var(--text-0)]'
                    )}
                  >
                    {d.date.getDate()}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* زر الإضافة السريعة: يظهر عند الحوم على الخانة في الشهر الحالي وغير الماضية */}
                    {canWrite && d.inMonth && !isPastDay && (
                      <div
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >
                        <BookingFormButton
                          customers={customers}
                          defaultScheduledAt={`${d.key}T10:00`}
                        >
                          <button
                            type="button"
                            aria-label="إضافة حجز"
                            title="إضافة حجز"
                            className="grid size-5 place-items-center rounded bg-accent/20 hover:bg-accent text-accent hover:text-[var(--accent-ink)] transition-colors text-[12px] font-bold"
                          >
                            +
                          </button>
                        </BookingFormButton>
                      </div>
                    )}

                    {d.bookings.length > 0 && (
                      <span className="tnum text-[10px] text-[var(--text-2)]">
                        {d.bookings.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  {d.bookings.slice(0, MAX_CHIPS).map((b) => (
                    <Chip
                      key={b.id}
                      booking={b}
                      day={d.key}
                      canWrite={canWrite}
                      dnd={dnd}
                      onSelectBooking={onSelectBooking}
                    />
                  ))}

                  {d.bookings.length > MAX_CHIPS && (
                    <span className="block px-1 text-[10px] font-semibold text-accent">
                      +{d.bookings.length - MAX_CHIPS} أخرى
                    </span>
                  )}

                  {d.bookings.length === 0 && dnd.over === d.key && (
                    <p className="grid h-full place-items-center text-[10px] text-accent">
                      أفلت هنا
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* شريط الجوال الأفقي (< md) */}
      <MobileMonthStrip
        days={days}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
      />
    </>
  );
}

/** شريط أفقي لأيام الشهر على الجوال — يُمرّر الحاوية فقط لتثبيت اليوم المختار في المشهد */
function MobileMonthStrip({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: MonthDay[];
  selectedDay?: string;
  onSelectDay?: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inMonthDays = useMemo(() => days.filter((d) => d.inMonth), [days]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedDay) return;

    const selectedEl = container.querySelector<HTMLElement>(`[data-day="${selectedDay}"]`);
    if (!selectedEl) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedEl.getBoundingClientRect();

    const scrollDelta =
      itemRect.left + itemRect.width / 2 - (containerRect.left + containerRect.width / 2);
    container.scrollBy({ left: scrollDelta, behavior: 'smooth' });
  }, [selectedDay]);

  return (
    <div className="md:hidden">
      <div
        ref={containerRef}
        className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {inMonthDays.map((d) => {
          const isSelected = selectedDay === d.key;
          // كل أسماء الأيام تبدأ بـ«ال»، فحرفها الأول «ا» للجميع؛ هذه اختصاراتها المتعارفة
          const weekdayInitial = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'][d.date.getDay()];
          const hasBookings = d.bookings.length > 0;

          return (
            <button
              key={d.key}
              type="button"
              data-day={d.key}
              onClick={() => onSelectDay?.(d.key)}
              className={cn(
                'flex flex-col items-center justify-center shrink-0 w-12 h-14 rounded-[var(--radius-sm)] border text-center transition-all select-none',
                isSelected
                  ? 'bg-accent text-[var(--accent-ink)] border-accent shadow-sm font-bold'
                  : d.isToday
                    ? 'border-accent text-accent bg-accent/10 font-bold'
                    : 'border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-1)] hover:border-[var(--line-strong)]'
              )}
            >
              <span className="text-[10px] font-medium opacity-80">{weekdayInitial}</span>
              <span className="tnum text-[14px] leading-tight font-bold">{d.date.getDate()}</span>
              {hasBookings ? (
                <span
                  className={cn(
                    'size-1.5 rounded-full mt-0.5',
                    isSelected ? 'bg-[var(--accent-ink)]' : 'bg-accent'
                  )}
                />
              ) : (
                <span className="size-1.5 mt-0.5 opacity-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** بطاقة مختصرة: الساعة والاسم — النقر يحدد الحجز في اللوح الجانبي بدلاً من الانتقال */
function Chip({
  booking: b,
  day,
  canWrite,
  dnd,
  onSelectBooking,
}: {
  booking: CalendarBooking;
  day: string;
  canWrite: boolean;
  dnd: ReturnType<typeof useReschedule>;
  onSelectBooking?: (id: string, dayKey: string) => void;
}) {
  const time = formatBookingTime(b.scheduledAt);
  const isMoving = dnd.moving === b.id;
  const draggable = canWrite && !b.hasJob && !dnd.pending;
  const isCancelled = b.status === 'CANCELLED';

  return (
    <div
      role="button"
      tabIndex={0}
      title={[time ?? 'بدون وقت', b.name, b.service, b.car].filter(Boolean).join(' · ')}
      draggable={draggable}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBooking?.(b.id, day);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          e.preventDefault();
          onSelectBooking?.(b.id, day);
        }
      }}
      onDragStart={(e) => {
        if (!draggable) return e.preventDefault();
        e.dataTransfer.effectAllowed = 'move';
        dnd.begin(b, day);
      }}
      onDragEnd={() => dnd.end()}
      className={cn(
        'flex items-baseline gap-1 rounded-[4px] border-s-2 border-[var(--line)] px-1.5 py-1 transition-colors hover:border-accent cursor-pointer select-none',
        STATUS_EDGE[b.status] ?? 'border-s-[var(--line-strong)]',
        STATUS_CHIP[b.status] ?? 'bg-[var(--surface-2)]',
        draggable && 'cursor-grab active:cursor-grabbing',
        dnd.dragging?.id === b.id && 'opacity-40',
        isMoving && 'pointer-events-none opacity-50'
      )}
    >
      {isMoving ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : (
        <span className="tnum shrink-0 text-[10px] font-semibold text-[var(--text-1)]" dir="ltr">
          {time ?? 'بدون وقت'}
        </span>
      )}
      <span
        className={cn(
          'truncate text-[11px] text-[var(--text-0)]',
          isCancelled && 'line-through opacity-75'
        )}
      >
        {b.name}
      </span>
    </div>
  );
}
