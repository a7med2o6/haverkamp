'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString, phoneSchema } from '@/lib/action-utils';

const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'اسم العميل مطلوب'),
  phone: phoneSchema,
  altPhone: optionalString,
  email: z.union([z.string().email('البريد الإلكتروني غير صالح'), z.literal('')]).optional(),
  civilId: optionalString,
  address: optionalString,
  area: optionalString,
  notes: optionalString,
  source: z.enum([
    'WALK_IN',
    'WEBSITE',
    'WHATSAPP',
    'INSTAGRAM',
    'REFERRAL',
    'GOOGLE_ADS',
    'OTHER',
  ]),
});

export const saveCustomer = action({
  permission: 'crm:write',
  schema: customerSchema,
  audit: { entity: 'Customer', action: 'SAVE' },
  handler: async (input) => {
    const { id, email, ...rest } = input;
    const data = { ...rest, email: email || null };

    if (id) {
      const updated = await db.customer.update({ where: { id }, data });
      revalidatePath('/dashboard/customers');
      revalidatePath(`/dashboard/customers/${id}`);
      return { id: updated.id, message: 'تم تحديث بيانات العميل' };
    }

    const created = await db.customer.create({
      data: { ...data, code: await nextNumber('customer') },
    });
    revalidatePath('/dashboard/customers');
    return { id: created.id, message: `تم إنشاء العميل ${created.code}` };
  },
});

export const deleteCustomer = action({
  permission: 'crm:delete',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Customer', action: 'DELETE' },
  handler: async ({ id }) => {
    // نمنع الحذف إن وُجدت فواتير أو أوامر شغل مرتبطة — نكتفي بالحظر
    const [orders, jobs] = await Promise.all([
      db.order.count({ where: { customerId: id } }),
      db.jobOrder.count({ where: { customerId: id } }),
    ]);

    if (orders > 0 || jobs > 0) {
      throw new AppError(
        'لا يمكن حذف عميل له فواتير أو أوامر شغل — استخدم خيار الحظر بدلاً من ذلك'
      );
    }

    await db.customer.delete({ where: { id } });
    revalidatePath('/dashboard/customers');
    return { id, message: 'تم حذف العميل' };
  },
});

export const toggleCustomerBlock = action({
  permission: 'crm:write',
  schema: z.object({ id: z.string(), isBlocked: z.boolean() }),
  audit: { entity: 'Customer', action: 'BLOCK' },
  handler: async ({ id, isBlocked }) => {
    await db.customer.update({ where: { id }, data: { isBlocked } });
    revalidatePath('/dashboard/customers');
    revalidatePath(`/dashboard/customers/${id}`);
    return { id, message: isBlocked ? 'تم حظر العميل' : 'تم رفع الحظر عن العميل' };
  },
});

// ── السيارات ──────────────────────────────────────────────

const vehicleSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1, 'العميل مطلوب'),
  make: z.string().trim().min(1, 'الماركة مطلوبة'),
  model: z.string().trim().min(1, 'الموديل مطلوب'),
  year: z
    .union([z.string(), z.number()])
    .transform((v) => (v === '' || v === null ? null : Number(v)))
    .refine((v) => v === null || (v >= 1950 && v <= new Date().getFullYear() + 2), 'سنة الصنع غير صالحة')
    .nullable()
    .optional(),
  color: optionalString,
  plateNo: optionalString,
  vin: optionalString,
  notes: optionalString,
});

export const saveVehicle = action({
  permission: 'crm:write',
  schema: vehicleSchema,
  audit: { entity: 'Vehicle', action: 'SAVE' },
  handler: async (input) => {
    const { id, ...data } = input;

    if (id) {
      const updated = await db.vehicle.update({ where: { id }, data });
      revalidatePath(`/dashboard/customers/${data.customerId}`);
      revalidatePath('/dashboard/vehicles');
      return { id: updated.id, message: 'تم تحديث بيانات السيارة' };
    }

    const created = await db.vehicle.create({ data });
    revalidatePath(`/dashboard/customers/${data.customerId}`);
    revalidatePath('/dashboard/vehicles');
    return { id: created.id, message: 'تمت إضافة السيارة' };
  },
});

export const deleteVehicle = action({
  permission: 'crm:delete',
  schema: z.object({ id: z.string(), customerId: z.string() }),
  audit: { entity: 'Vehicle', action: 'DELETE' },
  handler: async ({ id, customerId }) => {
    const jobs = await db.jobOrder.count({ where: { vehicleId: id } });
    if (jobs > 0) throw new AppError('لا يمكن حذف سيارة مرتبطة بأوامر شغل');

    await db.vehicle.delete({ where: { id } });
    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath('/dashboard/vehicles');
    return { id, message: 'تم حذف السيارة' };
  },
});
