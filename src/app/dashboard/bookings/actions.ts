'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString, phoneSchema } from '@/lib/action-utils';

const bookingSchema = z.object({
  id: z.string().optional(),
  customerId: optionalString,
  vehicleId: optionalString,
  serviceId: optionalString,
  guestName: optionalString,
  guestPhone: optionalString,
  guestCar: optionalString,
  scheduledAt: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  notes: optionalString,
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ]),
});

export const saveBooking = action({
  permission: 'crm:write',
  schema: bookingSchema,
  audit: { entity: 'Booking', action: 'SAVE' },
  handler: async (input) => {
    const { id, ...data } = input;

    if (!data.customerId && !data.guestName) {
      throw new AppError('اختر عميلاً مسجّلاً أو أدخل اسم الزائر');
    }

    if (id) {
      const updated = await db.booking.update({ where: { id }, data });
      revalidatePath('/dashboard/bookings');
      return { id: updated.id, message: 'تم تحديث الحجز' };
    }

    const created = await db.booking.create({
      data: { ...data, code: await nextNumber('booking'), source: 'WALK_IN' },
    });
    revalidatePath('/dashboard/bookings');
    return { id: created.id, message: `تم إنشاء الحجز ${created.code}` };
  },
});

export const setBookingStatus = action({
  permission: 'crm:write',
  schema: z.object({
    id: z.string(),
    status: z.enum([
      'PENDING',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ]),
  }),
  audit: { entity: 'Booking', action: 'STATUS' },
  handler: async ({ id, status }) => {
    await db.booking.update({ where: { id }, data: { status } });
    revalidatePath('/dashboard/bookings');
    return { id, message: 'تم تحديث حالة الحجز' };
  },
});

/**
 * يحوّل حجزاً إلى أمر شغل — ينشئ ملف عميل من بيانات الزائر إن لزم.
 */
export const convertBookingToJob = action({
  permission: 'workshop:write',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'JobOrder', action: 'FROM_BOOKING' },
  handler: async ({ id }) => {
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        service: { include: { translations: { where: { locale: 'ar' } } } },
        jobOrder: { select: { id: true } },
      },
    });

    if (!booking) throw new AppError('الحجز غير موجود');
    if (booking.jobOrder) throw new AppError('تم تحويل هذا الحجز إلى أمر شغل مسبقاً');

    let customerId = booking.customerId;

    // إنشاء عميل من بيانات الزائر إن لم يكن مسجّلاً
    if (!customerId) {
      if (!booking.guestPhone) {
        throw new AppError('لا يمكن التحويل — الحجز بدون عميل مسجّل ولا رقم هاتف');
      }
      const phone = phoneSchema.parse(booking.guestPhone);
      const existing = await db.customer.findFirst({ where: { phone } });

      customerId =
        existing?.id ??
        (
          await db.customer.create({
            data: {
              code: await nextNumber('customer'),
              name: booking.guestName ?? 'عميل من الموقع',
              phone,
              source: booking.source,
            },
          })
        ).id;
    }

    const job = await db.jobOrder.create({
      data: {
        number: await nextNumber('job'),
        bookingId: booking.id,
        customerId,
        vehicleId: booking.vehicleId,
        notes: booking.notes,
        items: booking.serviceId
          ? {
              create: {
                serviceId: booking.serviceId,
                label: booking.service?.translations[0]?.name ?? 'خدمة',
                qty: 1,
                unitPrice: 0,
                total: 0,
              },
            }
          : undefined,
      },
    });

    await db.booking.update({ where: { id }, data: { status: 'IN_PROGRESS', customerId } });

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/job-orders');
    return { id: job.id, message: `تم إنشاء أمر الشغل ${job.number}` };
  },
});
