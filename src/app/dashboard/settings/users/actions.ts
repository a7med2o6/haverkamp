'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, optionalString } from '@/lib/action-utils';

const ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'HR',
  'ACCOUNTANT',
  'CASHIER',
  'TECHNICIAN',
  'RECEPTIONIST',
] as const;

export const saveUser = action({
  permission: 'settings:write',
  schema: z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2, 'الاسم مطلوب'),
    email: z.string().trim().email('البريد الإلكتروني غير صالح'),
    phone: optionalString,
    role: z.enum(ROLES),
    isActive: z.boolean(),
    // مطلوبة عند الإنشاء فقط
    password: z.string().optional(),
  }),
  audit: { entity: 'User', action: 'SAVE' },
  handler: async ({ id, password, email, ...rest }) => {
    const data = { ...rest, email: email.toLowerCase() };

    if (id) {
      // تغيير كلمة المرور اختياري عند التعديل
      const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
      if (password && password.length < 8) {
        throw new AppError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      }

      await db.user.update({
        where: { id },
        data: { ...data, ...(passwordHash ? { passwordHash } : {}) },
      });
      revalidatePath('/dashboard/settings/users');
      return { id, message: 'تم تحديث المستخدم' };
    }

    if (!password || password.length < 8) {
      throw new AppError('كلمة المرور مطلوبة و8 أحرف على الأقل');
    }

    const created = await db.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    });

    revalidatePath('/dashboard/settings/users');
    return { id: created.id, message: `تم إنشاء حساب ${created.name}` };
  },
});

export const toggleUserActive = action({
  permission: 'settings:write',
  schema: z.object({ id: z.string(), isActive: z.boolean() }),
  audit: { entity: 'User', action: 'TOGGLE' },
  handler: async ({ id, isActive }, { userId }) => {
    if (id === userId && !isActive) {
      throw new AppError('لا يمكنك إيقاف حسابك الشخصي');
    }

    // لا نسمح بإيقاف آخر مالك نشط — وإلا يُقفل النظام على الجميع
    if (!isActive) {
      const target = await db.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === 'OWNER') {
        const activeOwners = await db.user.count({ where: { role: 'OWNER', isActive: true } });
        if (activeOwners <= 1) {
          throw new AppError('لا يمكن إيقاف آخر حساب مالك نشط في النظام');
        }
      }
    }

    await db.user.update({ where: { id }, data: { isActive } });
    revalidatePath('/dashboard/settings/users');
    return { id, message: isActive ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب' };
  },
});
