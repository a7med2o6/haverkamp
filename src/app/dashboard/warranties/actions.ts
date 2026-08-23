'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, optionalString } from '@/lib/action-utils';

/** إلغاء شهادة كفالة أو إعادة تفعيلها — لا تُحذف أبداً للحفاظ على الأثر */
export const setWarrantyVoid = action({
  permission: 'crm:write',
  schema: z.object({
    id: z.string(),
    isVoid: z.boolean(),
    reason: optionalString,
  }),
  audit: { entity: 'Warranty', action: 'VOID' },
  handler: async ({ id, isVoid, reason }) => {
    const warranty = await db.warranty.findUnique({
      where: { id },
      select: { certificateNo: true, terms: true, isVoid: true },
    });
    if (!warranty) throw new AppError('الشهادة غير موجودة');
    if (warranty.isVoid === isVoid) throw new AppError('لا تغيير على حالة الشهادة');

    // سبب الإلغاء يُلحق ببنود الشهادة حتى يظهر لمن يفتحها لاحقاً
    const terms =
      isVoid && reason
        ? `${warranty.terms ? `${warranty.terms}\n\n` : ''}⛔ أُلغيت الكفالة — ${reason}`
        : warranty.terms;

    await db.warranty.update({ where: { id }, data: { isVoid, terms } });

    revalidatePath('/dashboard/warranties');
    revalidatePath(`/dashboard/warranties/${id}`);
    return {
      id,
      message: isVoid
        ? `تم إلغاء الشهادة ${warranty.certificateNo}`
        : `تمت إعادة تفعيل الشهادة ${warranty.certificateNo}`,
    };
  },
});
