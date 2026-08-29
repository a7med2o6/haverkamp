'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, optionalString } from '@/lib/action-utils';

export const saveSupplier = action({
  permission: 'inventory:write',
  schema: z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2, 'اسم المورّد مطلوب'),
    phone: optionalString,
    email: optionalString,
    country: optionalString,
    address: optionalString,
    notes: optionalString,
  }),
  audit: { entity: 'Supplier', action: 'SAVE' },
  handler: async ({ id, ...data }) => {
    if (id) {
      await db.supplier.update({ where: { id }, data });
      revalidatePath('/dashboard/suppliers');
      return { id, message: 'تم تحديث المورّد' };
    }

    const created = await db.supplier.create({ data });
    revalidatePath('/dashboard/suppliers');
    return { id: created.id, message: `تمت إضافة ${created.name}` };
  },
});

export const deleteSupplier = action({
  permission: 'inventory:delete',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Supplier', action: 'DELETE' },
  handler: async ({ id }) => {
    const orders = await db.purchaseOrder.count({ where: { supplierId: id } });
    if (orders > 0) {
      throw new AppError(`لا يمكن الحذف — للمورّد ${orders} أمر شراء مرتبط`);
    }

    await db.supplier.delete({ where: { id } });
    revalidatePath('/dashboard/suppliers');
    return { id, message: 'تم حذف المورّد' };
  },
});
