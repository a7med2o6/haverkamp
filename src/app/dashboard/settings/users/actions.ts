'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, optionalString } from '@/lib/action-utils';
import type { Prisma } from '@/generated/prisma/client';

const ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'HR',
  'ACCOUNTANT',
  'CASHIER',
  'TECHNICIAN',
  'RECEPTIONIST',
  'WASHER',
] as const;

async function linkEmployee(
  tx: Prisma.TransactionClient,
  employeeId: string | null | undefined,
  userId: string,
  role: (typeof ROLES)[number]
) {
  if (role === 'WASHER' && !employeeId) {
    throw new AppError('الموظف المرتبط مطلوب لحساب الغسّيل');
  }

  if (employeeId) {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { status: true, skills: true, userId: true, fullName: true },
    });
    if (!employee) throw new AppError('الموظف المختار غير موجود');
    if (employee.status !== 'ACTIVE') {
      throw new AppError('يجب أن يكون الموظف المرتبط نشطاً');
    }
    if (role === 'WASHER' && !employee.skills.includes('WASHING')) {
      throw new AppError(`الموظف ${employee.fullName} لا يملك مهارة الغسيل`);
    }
    if (employee.userId && employee.userId !== userId) {
      throw new AppError('هذا الموظف مرتبط بحساب آخر بالفعل');
    }
  }

  // تغيير الاختيار أو مسحه يفصل الرابط القديم داخل المعاملة نفسها.
  await tx.employee.updateMany({
    where: { userId, ...(employeeId ? { id: { not: employeeId } } : {}) },
    data: { userId: null },
  });

  if (employeeId) {
    const linked = await tx.employee.updateMany({
      where: {
        id: employeeId,
        status: 'ACTIVE',
        OR: [{ userId: null }, { userId }],
      },
      data: { userId },
    });
    // يحسم سباق نافذتين اختارتا الموظف نفسه برسالة تجارية مفهومة.
    if (linked.count !== 1) throw new AppError('هذا الموظف مرتبط بحساب آخر بالفعل');
  }
}

export const saveUser = action({
  permission: 'settings:write',
  schema: z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2, 'الاسم مطلوب'),
    email: z.string().trim().email('البريد الإلكتروني غير صالح'),
    phone: optionalString,
    role: z.enum(ROLES),
    isActive: z.boolean(),
    employeeId: optionalString,
    // مطلوبة عند الإنشاء فقط
    password: z.string().optional(),
  }),
  audit: { entity: 'User', action: 'SAVE' },
  handler: async ({ id, password, email, employeeId, ...rest }) => {
    const data = { ...rest, email: email.toLowerCase() };

    if (id) {
      // تغيير كلمة المرور اختياري عند التعديل
      const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
      if (password && password.length < 8) {
        throw new AppError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      }

      await db.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new AppError('المستخدم غير موجود');

        await linkEmployee(tx, employeeId, id, data.role);
        await tx.user.update({
          where: { id },
          data: { ...data, ...(passwordHash ? { passwordHash } : {}) },
        });
      });
      revalidatePath('/dashboard/settings/users');
      revalidatePath('/dashboard/wash/today');
      return { id, message: 'تم تحديث المستخدم' };
    }

    if (!password || password.length < 8) {
      throw new AppError('كلمة المرور مطلوبة و8 أحرف على الأقل');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...data, passwordHash } });
      await linkEmployee(tx, employeeId, user.id, data.role);
      return user;
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard/wash/today');
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
