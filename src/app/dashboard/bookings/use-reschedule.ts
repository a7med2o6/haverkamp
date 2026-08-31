'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { rescheduleBooking } from './actions';
import type { CalendarBooking } from './calendar';

/**
 * سحب بطاقة الحجز إلى يوم آخر — منطق مشترك بين التقويم الأسبوعي والشهري.
 * نحفظ يوم المصدر مع البطاقة لنتجاهل الإفلات في مكانها دون البحث في الأيام.
 */
export function useReschedule() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drag, setDrag] = useState<{ booking: CalendarBooking; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  return {
    /** تحديث جارٍ — نجمّد السحب ريثما ينتهي */
    pending,
    /** الحجز المسحوب حالياً */
    dragging: drag?.booking ?? null,
    /** مفتاح اليوم الذي يحوم فوقه المؤشّر */
    over,
    /** الحجز الذي يُنقل الآن — نُخفيه من مكانه القديم ريثما يُحدَّث */
    moving,

    begin(booking: CalendarBooking, from: string) {
      setDrag({ booking, from });
    },
    end() {
      setDrag(null);
      setOver(null);
    },
    enter(key: string) {
      setOver(key);
    },
    leave(key: string) {
      setOver((k) => (k === key ? null : k));
    },
    drop(target: string) {
      setOver(null);
      const current = drag;
      setDrag(null);
      if (!current || current.from === target) return;

      setMoving(current.booking.id);
      startTransition(async () => {
        const res = await rescheduleBooking({ id: current.booking.id, day: target });
        setMoving(null);

        if (res.ok) {
          toast.success(res.message ?? 'تم نقل الحجز');
          router.refresh();
        } else {
          toast.error(res.error);
        }
      });
    },
  };
}
