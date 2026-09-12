'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, moneySchema, optionalString } from '@/lib/action-utils';
import { dateOnlyFromInput } from '@/lib/utils';
import { openWashMonthRecords } from './month-service';

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ البدء مطلوب')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'تاريخ البدء غير صالح')
  .transform((value) => dateOnlyFromInput(value));

const subscriptionFields = {
  customerId: z.string().min(1, 'العميل مطلوب'),
  vehicleId: z.string().min(1, 'السيارة مطلوبة'),
  servicePackageId: optionalString,
  area: z.string().trim().min(1, 'المنطقة مطلوبة'),
  block: optionalString,
  street: optionalString,
  building: optionalString,
  locationNotes: optionalString,
  startDate: dateSchema,
  monthlyPrice: moneySchema,
  notes: optionalString,
};

const createSchema = z.object(subscriptionFields);
const updateSchema = z.object({ id: z.string().min(1), ...subscriptionFields });

const openMonthSchema = z.object({
  year: z.number().int().min(2000, 'السنة غير صالحة').max(2100, 'السنة غير صالحة'),
  month: z.number().int().min(1, 'الشهر غير صالح').max(12, 'الشهر غير صالح'),
});

async function validateReferences({
  customerId,
  vehicleId,
  servicePackageId,
  excludeId,
}: {
  customerId: string;
  vehicleId: string;
  servicePackageId?: string | null;
  excludeId?: string;
}) {
  const [customer, vehicle, servicePackage, existing] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: { name: true, isBlocked: true },
    }),
    db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } }),
    servicePackageId
      ? db.servicePackage.findUnique({ where: { id: servicePackageId }, select: { id: true } })
      : null,
    db.washSubscription.findFirst({
      where: {
        vehicleId,
        status: { not: 'ENDED' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { code: true },
    }),
  ]);

  if (!customer) throw new AppError('العميل غير موجود');
  if (customer.isBlocked) {
    throw new AppError(`العميل ${customer.name} محظور — ارفع الحظر قبل إنشاء أو تعديل الاشتراك`);
  }
  if (!vehicle) throw new AppError('السيارة غير موجودة');
  if (servicePackageId && !servicePackage) throw new AppError('باقة الغسيل المختارة غير موجودة');
  if (existing) {
    throw new AppError(`للسيارة اشتراك غير منتهٍ بالفعل: ${existing.code}`);
  }
}

export const createWashSubscription = action({
  permission: 'wash:write',
  schema: createSchema,
  audit: { entity: 'WashSubscription', action: 'CREATE' },
  handler: async (input) => {
    await validateReferences(input);

    const created = await db.washSubscription
      .create({
        data: {
          ...input,
          code: await nextNumber('washSubscription'),
        },
      })
      .catch(async (error: unknown) => {
        // الفهرس الجزئي يحسم سباق عمليتي حفظ؛ نعيد سببه التجاري لا خطأ قاعدة البيانات
        const existing = await db.washSubscription.findFirst({
          where: { vehicleId: input.vehicleId, status: { not: 'ENDED' } },
          select: { code: true },
        });
        if (existing) throw new AppError(`للسيارة اشتراك غير منتهٍ بالفعل: ${existing.code}`);
        throw error;
      });

    revalidatePath('/dashboard/wash');
    revalidatePath(`/dashboard/customers/${input.customerId}`);
    return { id: created.id, message: `تم إنشاء اشتراك الغسيل ${created.code}` };
  },
});

export const updateWashSubscription = action({
  permission: 'wash:write',
  schema: updateSchema,
  audit: { entity: 'WashSubscription', action: 'UPDATE' },
  handler: async (input) => {
    const { id, ...data } = input;
    const before = await db.washSubscription.findUnique({
      where: { id },
      select: { customerId: true },
    });
    if (!before) throw new AppError('اشتراك الغسيل غير موجود');

    await validateReferences({ ...data, excludeId: id });

    const updated = await db.washSubscription
      .update({ where: { id }, data })
      .catch(async (error: unknown) => {
        const existing = await db.washSubscription.findFirst({
          where: {
            vehicleId: data.vehicleId,
            status: { not: 'ENDED' },
            id: { not: id },
          },
          select: { code: true },
        });
        if (existing) throw new AppError(`للسيارة اشتراك غير منتهٍ بالفعل: ${existing.code}`);
        throw error;
      });

    revalidatePath('/dashboard/wash');
    revalidatePath(`/dashboard/customers/${data.customerId}`);
    if (before.customerId !== data.customerId) {
      revalidatePath(`/dashboard/customers/${before.customerId}`);
    }
    return { id: updated.id, message: `تم تحديث اشتراك الغسيل ${updated.code}` };
  },
});

export const openWashMonth = action({
  permission: 'wash:write',
  schema: openMonthSchema,
  audit: { entity: 'WashSubscriptionPeriod', action: 'OPEN' },
  handler: async ({ year, month }) => {
    const result = await openWashMonthRecords(year, month);

    revalidatePath('/dashboard/wash');
    revalidatePath('/dashboard/wash/billing');

    return {
      message: `تم فتح ${result.created} فترة، و${result.alreadyOpen} كانت مفتوحة مسبقاً`,
      data: result,
    };
  },
});
