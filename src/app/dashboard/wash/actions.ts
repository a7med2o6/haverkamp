'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, moneySchema, optionalString } from '@/lib/action-utils';
import { dateOnlyFromInput, formatKWD, todayDateOnly, toNumber } from '@/lib/utils';
import { siteUrl } from '@/lib/site-url';
import { waMeLink } from '@/lib/whatsapp';
import { ensureWashShareToken } from '@/lib/wash-card';
import { parseLatLng } from '@/lib/geo';
import type { Prisma } from '@/generated/prisma/client';
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
  defaultWasherId: optionalString,
  mapPoint: optionalString,
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
  defaultWasherId,
  excludeId,
}: {
  customerId: string;
  vehicleId: string;
  servicePackageId?: string | null;
  defaultWasherId?: string | null;
  excludeId?: string;
}) {
  const [customer, vehicle, servicePackage, defaultWasher, existing] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: { name: true, isBlocked: true },
    }),
    db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } }),
    servicePackageId
      ? db.servicePackage.findUnique({ where: { id: servicePackageId }, select: { id: true } })
      : null,
    defaultWasherId
      ? db.employee.findUnique({
          where: { id: defaultWasherId },
          select: { status: true, skills: true },
        })
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
  if (defaultWasherId && !defaultWasher) throw new AppError('الغسّيل المعتاد غير موجود');
  if (defaultWasher && defaultWasher.status !== 'ACTIVE') {
    throw new AppError('يجب أن يكون الغسّيل المعتاد موظفاً نشطاً');
  }
  if (defaultWasher && !defaultWasher.skills.includes('WASHING')) {
    throw new AppError('الموظف المختار لا يملك مهارة الغسيل');
  }
  if (existing) {
    throw new AppError(`للسيارة اشتراك غير منتهٍ بالفعل: ${existing.code}`);
  }
}

/**
 * النقطة كما يكتبها المكتب — وخانةُ تاريخها لا تُلمس إلا إذا تحرّكت النقطة.
 *
 * `locationSetAt` تُسأل يوماً: متى قيس هذا الموقع؟ فلو بُصمت مع كل حفظٍ
 * للعقد، أجابت «الآن» عن نقطةٍ وُضعت قبل سنة، وصار تاريخُ التعديل يلبس
 * ثوب تاريخ القياس.
 */
function subscriptionCoordinates(
  mapPoint: string | null | undefined,
  before?: { lat: Prisma.Decimal | null; lng: Prisma.Decimal | null }
) {
  if (!mapPoint) return { lat: null, lng: null, locationSetAt: null };

  const parsed = parseLatLng(mapPoint);
  if ('error' in parsed) throw new AppError(parsed.error);

  const unchanged =
    before?.lat != null &&
    before?.lng != null &&
    toNumber(before.lat) === parsed.lat &&
    toNumber(before.lng) === parsed.lng;

  return unchanged
    ? { lat: parsed.lat, lng: parsed.lng }
    : { lat: parsed.lat, lng: parsed.lng, locationSetAt: new Date() };
}

export const createWashSubscription = action({
  permission: 'wash:write',
  schema: createSchema,
  audit: { entity: 'WashSubscription', action: 'CREATE' },
  handler: async (input) => {
    const { mapPoint, ...data } = input;
    await validateReferences(data);

    const created = await db
      .$transaction(async (tx) =>
        tx.washSubscription.create({
          data: {
            ...data,
            defaultWasherId: data.defaultWasherId ?? null,
            ...subscriptionCoordinates(mapPoint),
            code: await nextNumber('washSubscription'),
          },
        })
      )
      .catch(async (error: unknown) => {
        // الفهرس الجزئي يحسم سباق عمليتي حفظ؛ نعيد سببه التجاري لا خطأ قاعدة البيانات
        const existing = await db.washSubscription.findFirst({
          where: { vehicleId: input.vehicleId, status: { not: 'ENDED' } },
          select: { code: true },
        });
        if (existing) throw new AppError(`للسيارة اشتراك غير منتهٍ بالفعل: ${existing.code}`);
        throw error;
      });

    revalidateWash([created.id]);
    revalidatePath(`/dashboard/customers/${input.customerId}`);
    return { id: created.id, message: `تم إنشاء اشتراك الغسيل ${created.code}` };
  },
});

export const updateWashSubscription = action({
  permission: 'wash:write',
  schema: updateSchema,
  audit: { entity: 'WashSubscription', action: 'UPDATE' },
  handler: async (input) => {
    const { id, defaultWasherId, mapPoint, ...data } = input;
    const before = await db.washSubscription.findUnique({
      where: { id },
      select: { customerId: true, defaultWasherId: true, lat: true, lng: true },
    });
    if (!before) throw new AppError('اشتراك الغسيل غير موجود');

    await validateReferences({ ...data, defaultWasherId, excludeId: id });

    const updated = await db
      .$transaction(async (tx) => {
        const subscription = await tx.washSubscription.update({
          where: { id },
          data: {
            ...data,
            defaultWasherId: defaultWasherId ?? null,
            ...subscriptionCoordinates(mapPoint, before),
          },
        });

        if (before.defaultWasherId !== (defaultWasherId ?? null)) {
          await tx.washVisit.updateMany({
            where: {
              period: { subscriptionId: id },
              status: { in: ['PLANNED', 'BLOCKED'] },
              scheduledDate: { gte: todayDateOnly() },
            },
            data: { assignedEmployeeId: defaultWasherId ?? null },
          });
        }

        return subscription;
      })
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
    revalidatePath('/dashboard/wash/today');
    revalidatePath('/dashboard/wash/coverage');
    revalidatePath(`/dashboard/wash/${id}`);
    revalidatePath('/dashboard/wash/billing');
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

    revalidateWash(result.subscriptionIds);

    return {
      message: `تم فتح ${result.created} فترة، و${result.alreadyOpen} كانت مفتوحة مسبقاً`,
      data: result,
    };
  },
});

const pauseSchema = z
  .object({
    subscriptionId: z.string().min(1, 'اشتراك الغسيل مطلوب'),
    fromDate: dateSchema,
    toDate: dateSchema,
    reason: optionalString,
  })
  .refine((input) => input.fromDate <= input.toDate, {
    path: ['toDate'],
    message: 'تاريخ النهاية يجب أن يساوي تاريخ البداية أو يأتي بعده',
  });

function revalidateWash(subscriptionIds: string[] = []) {
  revalidatePath('/dashboard/wash');
  revalidatePath('/dashboard/wash/today');
  revalidatePath('/dashboard/wash/coverage');
  revalidatePath('/dashboard/wash/billing');
  for (const subscriptionId of new Set(subscriptionIds)) {
    revalidatePath(`/dashboard/wash/${subscriptionId}`);
  }
}

export const createWashPause = action({
  permission: 'wash:write',
  schema: pauseSchema,
  audit: { entity: 'WashPause', action: 'CREATE' },
  handler: async ({ subscriptionId, fromDate, toDate, reason }, { userId }) => {
    const pause = await db.$transaction(async (tx) => {
      const subscription = await tx.washSubscription.findUnique({
        where: { id: subscriptionId },
        select: { id: true },
      });
      if (!subscription) throw new AppError('اشتراك الغسيل غير موجود');

      const overlap = await tx.washPause.findFirst({
        where: { subscriptionId, fromDate: { lte: toDate }, toDate: { gte: fromDate } },
        select: { id: true },
      });
      if (overlap) throw new AppError('فترة الإيقاف تتداخل مع إيقاف مسجّل لهذا الاشتراك');

      const created = await tx.washPause.create({
        data: { subscriptionId, fromDate, toDate, reason, createdByUserId: userId },
      });
      await tx.washVisit.updateMany({
        where: {
          period: { subscriptionId },
          scheduledDate: { gte: todayDateOnly(), lte: toDate },
          AND: { scheduledDate: { gte: fromDate } },
          status: { in: ['PLANNED', 'BLOCKED'] },
        },
        data: { status: 'SKIPPED', skipReason: 'CUSTOMER_TRAVEL' },
      });
      return created;
    });

    revalidateWash([subscriptionId]);
    return { id: pause.id, message: 'تم تسجيل إيقاف الاشتراك' };
  },
});

export const deleteWashPause = action({
  permission: 'wash:write',
  schema: z.object({ pauseId: z.string().min(1) }),
  audit: { entity: 'WashPause', action: 'DELETE' },
  handler: async ({ pauseId }) => {
    const subscriptionId = await db.$transaction(async (tx) => {
      const pause = await tx.washPause.findUnique({ where: { id: pauseId } });
      if (!pause) throw new AppError('إيقاف الاشتراك غير موجود');

      const baseWhere = {
        scheduledDate: { gte: new Date(Math.max(pause.fromDate.getTime(), todayDateOnly().getTime())), lte: pause.toDate },
        status: 'SKIPPED' as const,
        skipReason: 'CUSTOMER_TRAVEL' as const,
      };

      await tx.washVisit.updateMany({
        where: {
          ...baseWhere,
          period: { subscriptionId: pause.subscriptionId, status: 'ELIGIBLE' },
        },
        data: { status: 'PLANNED', skipReason: null },
      });
      /*
        لا يميّز السجل بين إيقاف العقد وبين «العميل مسافر» التي سجّلها
        الغسّيل منفرداً داخل نفس المدى؛ إلغاء الإيقاف يعيد الاثنين، وهذا
        مقبول تشغيلياً ما دام السبب والمدى متطابقين.
      */
      await tx.washVisit.updateMany({
        where: {
          ...baseWhere,
          period: { subscriptionId: pause.subscriptionId, status: { not: 'ELIGIBLE' } },
        },
        data: { status: 'BLOCKED', skipReason: 'UNPAID' },
      });
      await tx.washPause.delete({ where: { id: pauseId } });
      return pause.subscriptionId;
    });

    revalidateWash([subscriptionId]);
    return { id: pauseId, message: 'تم إلغاء الإيقاف وإعادة الغسلات القادمة' };
  },
});

const visitIdSchema = z.object({ visitId: z.string().min(1, 'الغسلة مطلوبة') });
const washerSkipReasons = ['CAR_ABSENT', 'CUSTOMER_TRAVEL', 'WEATHER', 'OTHER'] as const;

async function visitMutationContext(
  visitId: string,
  userId: string,
  allowedStatuses: readonly ('PLANNED' | 'COMPLETED' | 'SKIPPED')[]
) {
  const [user, visit] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { role: true, employee: { select: { id: true } } },
    }),
    db.washVisit.findUnique({
      where: { id: visitId },
      select: {
        status: true,
        scheduledDate: true,
        assignedEmployeeId: true,
        period: { select: { subscriptionId: true } },
      },
    }),
  ]);
  if (!user || !visit) throw new AppError('الغسلة غير موجودة');
  if (!allowedStatuses.includes(visit.status as (typeof allowedStatuses)[number])) {
    throw new AppError('تغيّرت حالة الغسلة — حدّث الصفحة وحاول مرة أخرى');
  }

  const today = todayDateOnly();
  if (user.role === 'WASHER') {
    if (!user.employee) throw new AppError('حساب الغسّيل غير مرتبط بموظف');
    if (visit.assignedEmployeeId !== user.employee.id) {
      throw new AppError('هذه الغسلة ليست مسندة إليك');
    }
    if (visit.scheduledDate.getTime() !== today.getTime()) {
      throw new AppError('يمكن للغسّيل تسجيل غسلات يومه فقط');
    }
  } else if (visit.scheduledDate > today) {
    throw new AppError('لا يمكن تسجيل غسلة في تاريخ مستقبلي');
  }

  return {
    employeeId: user.employee?.id ?? null,
    subscriptionId: visit.period.subscriptionId,
    authorizationWhere: (user.role === 'WASHER'
      ? { assignedEmployeeId: user.employee!.id, scheduledDate: today }
      : { scheduledDate: { lte: today } }) satisfies Prisma.WashVisitWhereInput,
  };
}

export const completeWashVisit = action({
  permission: 'wash:visit',
  schema: visitIdSchema,
  audit: { entity: 'WashVisit', action: 'COMPLETE' },
  handler: async ({ visitId }, { userId }) => {
    const context = await visitMutationContext(visitId, userId, ['PLANNED']);
    const updated = await db.washVisit.updateMany({
      where: { id: visitId, status: 'PLANNED', ...context.authorizationWhere },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedByEmployeeId: context.employeeId,
        recordedByUserId: userId,
        skipReason: null,
      },
    });
    if (updated.count !== 1) throw new AppError('تغيّرت حالة الغسلة — حدّث الصفحة');
    revalidateWash([context.subscriptionId]);
    return { id: visitId, message: 'تم تسجيل الغسيل' };
  },
});

export const skipWashVisit = action({
  permission: 'wash:visit',
  schema: z.object({
    visitId: z.string().min(1, 'الغسلة مطلوبة'),
    reason: z.enum(washerSkipReasons),
    notes: optionalString,
  }),
  audit: { entity: 'WashVisit', action: 'SKIP' },
  handler: async ({ visitId, reason, notes }, { userId }) => {
    const context = await visitMutationContext(visitId, userId, ['PLANNED']);
    const updated = await db.washVisit.updateMany({
      where: { id: visitId, status: 'PLANNED', ...context.authorizationWhere },
      data: {
        status: 'SKIPPED',
        skipReason: reason,
        notes,
        completedAt: null,
        completedByEmployeeId: null,
        recordedByUserId: userId,
      },
    });
    if (updated.count !== 1) throw new AppError('تغيّرت حالة الغسلة — حدّث الصفحة');
    revalidateWash([context.subscriptionId]);
    return { id: visitId, message: 'تم تسجيل التعذّر' };
  },
});

export const undoWashVisit = action({
  permission: 'wash:visit',
  schema: visitIdSchema,
  audit: { entity: 'WashVisit', action: 'UNDO' },
  handler: async ({ visitId }, { userId }) => {
    const context = await visitMutationContext(visitId, userId, ['COMPLETED', 'SKIPPED']);
    const updated = await db.washVisit.updateMany({
      where: {
        id: visitId,
        status: { in: ['COMPLETED', 'SKIPPED'] },
        ...context.authorizationWhere,
      },
      data: {
        status: 'PLANNED',
        skipReason: null,
        notes: null,
        completedAt: null,
        completedByEmployeeId: null,
        recordedByUserId: null,
      },
    });
    if (updated.count !== 1) throw new AppError('تغيّرت حالة الغسلة — حدّث الصفحة');
    revalidateWash([context.subscriptionId]);
    return { id: visitId, message: 'عادت الغسلة إلى مخطّطة' };
  },
});

/*
  هذا لا يُسجّل غسلةً واحدة بل يُلغي يوماً على المشتركين كافة — قرارُ مشرفٍ
  لا قرارُ واقفٍ عند سيارة. فبقي خلف الكتابة لا خلف الزيارة.
*/
export const skipWashDay = action({
  permission: 'wash:write',
  schema: z.object({ date: dateSchema, reason: z.enum(['HOLIDAY', 'WEATHER']) }),
  audit: { entity: 'WashVisit', action: 'SKIP_DAY' },
  handler: async ({ date, reason }) => {
    const affected = await db.washVisit.findMany({
      where: { scheduledDate: date, status: 'PLANNED' },
      select: { period: { select: { subscriptionId: true } } },
    });
    const updated = await db.washVisit.updateMany({
      where: { scheduledDate: date, status: 'PLANNED' },
      data: { status: 'SKIPPED', skipReason: reason },
    });
    revalidateWash(affected.map((visit) => visit.period.subscriptionId));
    return {
      message: `تم تسجيل تعذّر ${updated.count} غسلة`,
      data: { count: updated.count },
    };
  },
});

/**
 * رابط كارت متابعة الغسيل للعميل، ورسالة واتساب جاهزة به.
 */
export const shareWashSubscription = action({
  permission: 'wash:write',
  schema: z.object({ id: z.string().min(1) }),
  audit: { entity: 'WashSubscription', action: 'SHARE' },
  handler: async ({ id }) => {
    const subscription = await db.washSubscription.findUnique({
      where: { id },
      select: {
        code: true,
        monthlyPrice: true,
        customer: { select: { name: true, phone: true } },
        vehicle: { select: { make: true, model: true, year: true } },
      },
    });
    if (!subscription) throw new AppError('اشتراك الغسيل غير موجود');

    const token = await ensureWashShareToken(id);
    const url = `${siteUrl()}/w/${token}`;
    const price = formatKWD(toNumber(subscription.monthlyPrice));
    const car = `${subscription.vehicle.make} ${subscription.vehicle.model}${
      subscription.vehicle.year ? ` ${subscription.vehicle.year}` : ''
    }`;

    const text = [
      `مرحباً ${subscription.customer?.name ?? 'عميلنا العزيز'}،`,
      '',
      `🚗 اشتراك الغسيل: ${subscription.code}`,
      `🚘 السيارة: ${car}`,
      `💰 الاشتراك الشهري: ${price}`,
      '',
      'لمتابعة غسلاتك وموعد الغسلة القادمة:',
      url,
    ].join('\n');

    // أوّل إرسالٍ يسكّ المفتاح، ورمزُ الصفحة يُبنى منه — فتُبطل لتظهره
    revalidatePath(`/dashboard/wash/${id}`);

    return {
      id,
      data: {
        url,
        whatsapp: subscription.customer?.phone ? waMeLink(subscription.customer.phone, text) : null,
      },
    };
  },
});

