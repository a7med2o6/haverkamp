'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { resolveSlot } from '@/lib/slots';

export type ConfirmState = { ok: boolean; error?: string };

/**
 * يقرأ الحجز من توكنه ويرفض ما لا يقبل تعديلاً من العميل.
 * القواعد واحدة للتأكيد ولتغيير الموعد، فلا يجوز أن يفترقا.
 */
async function openBooking(token: string) {
  const booking = await db.booking.findUnique({
    where: { confirmToken: token },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      jobOrder: { select: { id: true } },
    },
  });

  if (!booking) return { error: 'الرابط غير صالح' } as const;
  if (booking.status === 'CANCELLED') {
    return { error: 'هذا الحجز ملغي — تواصل معنا لحجز موعد جديد' } as const;
  }
  // دخل الورشة فعلاً — الموعد لم يعد ملك العميل وحده
  if (booking.jobOrder) {
    return { error: 'العمل على سيارتك بدأ — تواصل معنا لأي تعديل' } as const;
  }
  if (booking.scheduledAt.getTime() < Date.now()) {
    return { error: 'انقضى موعد هذا الحجز — تواصل معنا لحجز موعد جديد' } as const;
  }

  return { booking } as const;
}

/**
 * تأكيد الموعد من رابط التذكير.
 *
 * لا يمرّ بغلاف `action` لأنه لا يفترض جلسة: العميل ليس مستخدماً في
 * النظام، والتوكن وحده هو ما يُثبت أن الرابط وصل إلى صاحب الحجز.
 * ولأنه لا يقبل إلا التوكن، لا يستطيع من عرف كود حجز أن يؤكّده.
 */
export async function confirmBooking(token: string): Promise<ConfirmState> {
  const gate = await openBooking(token);
  if ('error' in gate) return { ok: false, error: gate.error };
  const { booking } = gate;

  // التأكيد لا يتراجع بالحالات المتقدّمة: من دخل الورشة لا يُعاد إلى «مؤكد»
  if (booking.status === 'PENDING') {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
  } else if (booking.status === 'CONFIRMED') {
    // مؤكد سلفاً من الاستقبال — نسجّل أن العميل أكّده بنفسه أيضاً
    await db.booking.update({
      where: { id: booking.id },
      data: { confirmedAt: new Date() },
    });
  }

  revalidatePath(`/b/${token}`);
  revalidatePath('/dashboard/bookings');
  return { ok: true };
}

/**
 * تغيير الموعد بيد العميل.
 *
 * يُطبَّق فوراً بلا موافقة الاستقبال — وهذا مقصود: التذكير الذي لا يقبل
 * إلا «نعم» يترك من لا يستطيع الحضور صامتاً، فيمرّ الموعد ويضيع الدور.
 * وما يحمي الورشة ليس الموافقة بل حدود الخانات: الدوام والعطلة والطاقة
 * الاستيعابية تُعاد قراءتها هنا من الإعدادات، فلا يصل العميل إلا إلى
 * خانة أتاحها النظام أصلاً.
 */
export async function rescheduleByCustomer(
  token: string,
  slotIso: string
): Promise<ConfirmState> {
  const gate = await openBooking(token);
  if ('error' in gate) return { ok: false, error: gate.error };
  const { booking } = gate;

  const slot = await resolveSlot(slotIso, { exceptId: booking.id });
  if (!slot.ok) return { ok: false, error: slot.error };

  await db.booking.update({
    where: { id: booking.id },
    data: {
      scheduledAt: slot.at,
      // اختيار موعد هو تأكيد له — لا معنى لتركه «بانتظار التأكيد»
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      rescheduledAt: new Date(),
      // الموعد تحرّك، فتذكير الموعد القديم لا يُحتسب — يُرسل تذكير جديد
      // قبل الموعد الجديد بيوم
      reminderSentAt: null,
    },
  });

  revalidatePath(`/b/${token}`);
  revalidatePath('/dashboard/bookings');
  return { ok: true };
}
