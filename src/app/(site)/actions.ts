'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';

/**
 * استقبال طلبات الحجز من الموقع العام.
 * نقطة مفتوحة بلا مصادقة، فالتحقق هنا هو خط الدفاع الوحيد:
 * حدود أطوال صارمة، ومصيدة للبوتات، ولا نكتب سوى حجزاً بحالة "بانتظار التأكيد".
 */
const bookingSchema = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(80),
  phone: z
    .string()
    .trim()
    .min(6, 'رقم الهاتف غير صالح')
    .max(20)
    .regex(/^[+\d\s-]+$/, 'رقم الهاتف غير صالح'),
  serviceSlug: z.string().trim().max(40).optional(),
  car: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  preferredAt: z.string().trim().max(30).optional(),
  /** حقل خفي — البشر لا يملؤونه، والبوتات تملؤه */
  website: z.string().max(0).optional(),
});

export type BookingResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function submitBooking(input: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);

  if (!parsed.success) {
    const first = Object.values(z.flattenError(parsed.error).fieldErrors).flat()[0];
    return { ok: false, error: first ?? 'تحقّق من البيانات المُدخلة' };
  }

  const { name, phone, serviceSlug, car, notes, preferredAt, website } = parsed.data;

  // مصيدة البوتات: نُظهر نجاحاً صامتاً حتى لا يتعلّم الآلي أن الحقل كاشف
  if (website) return { ok: true, code: '' };

  try {
    const service = serviceSlug
      ? await db.service.findUnique({ where: { slug: serviceSlug }, select: { id: true } })
      : null;

    // بلا موعد مفضّل: نجدوله غداً ويعدّله الاستقبال عند التأكيد
    const scheduledAt = preferredAt ? new Date(preferredAt) : new Date(Date.now() + 86400000);

    // نربطه بعميل مسجّل إن تطابق رقم الهاتف، وإلا يبقى زائراً
    const existing = await db.customer.findFirst({
      where: { phone },
      select: { id: true },
    });

    const booking = await db.booking.create({
      data: {
        code: await nextNumber('booking'),
        customerId: existing?.id ?? null,
        serviceId: service?.id ?? null,
        guestName: existing ? null : name,
        guestPhone: existing ? null : phone,
        guestCar: car || null,
        scheduledAt: Number.isNaN(scheduledAt.getTime())
          ? new Date(Date.now() + 86400000)
          : scheduledAt,
        notes: notes || null,
        status: 'PENDING',
        source: 'WEBSITE',
      },
    });

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard');

    return { ok: true, code: booking.code };
  } catch (e) {
    console.error('[submitBooking]', e);
    return { ok: false, error: 'تعذّر إرسال الطلب — حاول مرة أخرى أو راسلنا على واتساب' };
  }
}
