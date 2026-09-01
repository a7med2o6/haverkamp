'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString, phoneSchema } from '@/lib/action-utils';
import { serviceDef } from '@/lib/intake';

const bookingSchema = z.object({
  id: z.string().optional(),
  customerId: optionalString,
  vehicleId: optionalString,
  serviceKey: optionalString,
  serviceSpec: optionalString,
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

    /*
      الخدمة تصل بمفتاح الكتالوج، ونستنبط منها `serviceId` بالسلَق ليبقى
      الحجز مربوطاً بجدول الخدمات حيث يوجد مقابل — «حماية الرنقات» لا
      مقابل لها فتبقى بلا رابط، ومفتاحها هو ما يحفظ معناها.
    */
    const catalogue = serviceDef(data.serviceKey);
    if (data.serviceKey && !catalogue) throw new AppError('خدمة غير معروفة');

    const serviceId = catalogue?.slug
      ? ((await db.service.findUnique({
          where: { slug: catalogue.slug },
          select: { id: true },
        }))?.id ?? null)
      : null;

    if (id) {
      const updated = await db.booking.update({
        where: { id },
        data: { ...data, serviceId },
      });
      revalidatePath('/dashboard/bookings');
      return { id: updated.id, message: 'تم تحديث الحجز' };
    }

    const created = await db.booking.create({
      data: {
        ...data,
        serviceId,
        code: await nextNumber('booking'),
        source: 'WALK_IN',
      },
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
 * ينقل حجزاً إلى يوم آخر مع الحفاظ على ساعته.
 * يُستدعى من سحب البطاقة في التقويم، فالوجهة يوم لا لحظة.
 */
export const rescheduleBooking = action({
  permission: 'crm:write',
  schema: z.object({
    id: z.string(),
    /** يوم الوجهة بتوقيت الكويت: YYYY-MM-DD */
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صالح'),
  }),
  audit: { entity: 'Booking', action: 'RESCHEDULE' },
  handler: async ({ id, day }) => {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { scheduledAt: true, code: true, jobOrder: { select: { id: true } } },
    });
    if (!booking) throw new AppError('الحجز غير موجود');
    if (booking.jobOrder) {
      throw new AppError('الحجز صار أمر شغل — عدّل موعده من أمر الشغل');
    }

    // نقرأ ساعة الحجز بتوقيت الكويت ونعيد تركيبها على اليوم الجديد.
    // الكويت بلا توقيت صيفي فالإزاحة +03:00 ثابتة.
    const hm = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Kuwait',
    }).format(booking.scheduledAt);

    const scheduledAt = new Date(`${day}T${hm}:00+03:00`);
    if (Number.isNaN(scheduledAt.getTime())) throw new AppError('تاريخ غير صالح');

    await db.booking.update({ where: { id }, data: { scheduledAt } });
    revalidatePath('/dashboard/bookings');

    return { id, message: `تم نقل ${booking.code}` };
  },
});

/**
 * يجهّز الحجز لبيان التشغيل.
 *
 * لا يُنشئ أمر الشغل: كان التحويل ينشئه في الخلفية ببندٍ واحد بلا رقم
 * بيان ورقي ولا باقة ولا درجة عزل — فيخرج من هذا الباب أمرٌ ناقص ومن
 * باب «بيان تشغيل جديد» أمرٌ كامل، لنفس العمل. صار البابان باباً واحداً:
 * هذا يهيّئ العميل ثم يفتح بيان التشغيل معبّأً من الحجز.
 *
 * وما يبقى هنا هو ما لا يصلح في الصفحة: إنشاء ملف عميل من بيانات الزائر،
 * فهو كتابة لا تجري عند فتح صفحة.
 */
export const prepareBookingIntake = action({
  permission: 'workshop:write',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Booking', action: 'PREPARE_INTAKE' },
  handler: async ({ id }) => {
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        guestName: true,
        guestPhone: true,
        source: true,
        jobOrder: { select: { id: true } },
      },
    });

    if (!booking) throw new AppError('الحجز غير موجود');
    if (booking.jobOrder) throw new AppError('تم تحويل هذا الحجز إلى أمر شغل مسبقاً');

    let customerId = booking.customerId;

    // إنشاء ملف عميل من بيانات الزائر إن لم يكن مسجّلاً
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

      await db.booking.update({ where: { id }, data: { customerId } });
      revalidatePath('/dashboard/bookings');
    }

    return { id: booking.id };
  },
});

/**
 * يسجّل أن تذكير الحجز أُرسل.
 * يُستدعى من زر الإرسال اليدوي بعد فتح الواتساب. لا يضمن أن الموظف ضغط
 * «إرسال» في التطبيق، لكنه يكفي لإخراج الحجز من الطابور ومنع تذكير
 * مكرّر من المهمة المجدولة — وإعادة الإرسال متاحة دائماً.
 */
export const markReminderSent = action({
  permission: 'crm:write',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Booking', action: 'REMINDER' },
  handler: async ({ id }) => {
    await db.booking.update({
      where: { id },
      data: { reminderSentAt: new Date() },
    });
    revalidatePath('/dashboard/bookings');
    return { id, message: 'تم تسجيل التذكير' };
  },
});
