'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString } from '@/lib/action-utils';
import type { Prisma } from '@/generated/prisma/client';
import { todayDateOnly, toNumber } from '@/lib/utils';

/** يقرّب إلى 3 خانات عشرية (فلس) لتفادي أخطاء الفاصلة العائمة */
function fils(n: number) {
  return Math.round(n * 1000) / 1000;
}

async function makeSubscriptionPeriodEligible(
  tx: Prisma.TransactionClient,
  orderId: string,
  eligibleAt: Date
) {
  const period = await tx.washSubscriptionPeriod.findUnique({
    where: { orderId },
    select: { id: true, subscriptionId: true },
  });
  if (!period) return null;

  const updated = await tx.washSubscriptionPeriod.updateMany({
    where: { id: period.id, status: 'DUE' },
    data: { status: 'ELIGIBLE', eligibleAt },
  });
  if (updated.count === 0) return period.subscriptionId;

  await tx.washVisit.updateMany({
    where: {
      periodId: period.id,
      status: 'BLOCKED',
      scheduledDate: { gte: todayDateOnly() },
    },
    data: { status: 'PLANNED', skipReason: null },
  });
  return period.subscriptionId;
}

const itemSchema = z.object({
  productId: z.string(),
  label: z.string(),
  qty: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
});

const paymentSchema = z.object({
  method: z.enum(['CASH', 'KNET', 'VISA', 'TRANSFER', 'LINK', 'CREDIT']),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  reference: optionalString,
});

export const createPosOrder = action({
  permission: 'pos:write',
  schema: z.object({
    customerId: optionalString,
    items: z.array(itemSchema).min(1, 'أضف صنفاً واحداً على الأقل للفاتورة'),
    discountAmount: z.number().nonnegative().default(0),
    discountNote: optionalString,
    payments: z.array(paymentSchema).default([]),
    notes: optionalString,
    park: z.boolean().default(false), // حفظ كفاتورة معلّقة بدون دفع
  }),
  audit: { entity: 'Order', action: 'POS_SALE' },
  handler: async (input, { userId }) => {
    const { customerId, items, discountAmount, discountNote, payments, notes, park } = input;

    const subtotal = fils(
      items.reduce((sum, i) => sum + i.qty * i.unitPrice - i.discount, 0)
    );
    const total = fils(subtotal - discountAmount);

    if (total < 0) throw new AppError('قيمة الخصم أكبر من إجمالي الفاتورة');

    const paidAmount = fils(payments.reduce((sum, p) => sum + p.amount, 0));
    if (!park && paidAmount > total) {
      throw new AppError('المبلغ المدفوع أكبر من إجمالي الفاتورة');
    }

    const status = park
      ? ('DRAFT' as const)
      : paidAmount >= total
        ? ('COMPLETED' as const)
        : paidAmount > 0
          ? ('PARTIAL' as const)
          : ('DRAFT' as const);

    // وردية الصندوق المفتوحة الحالية لهذا المستخدم (إن وُجدت)
    const session = await db.registerSession.findFirst({
      where: { openedById: userId, closedAt: null },
      orderBy: { openedAt: 'desc' },
    });

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: await nextNumber('invoice'),
          channel: 'POS',
          status,
          customerId: customerId || null,
          cashierId: userId,
          registerSessionId: session?.id ?? null,
          subtotal,
          discountAmount,
          discountNote,
          total,
          paidAmount,
          notes,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              label: i.label,
              qty: i.qty,
              unitPrice: i.unitPrice,
              discount: i.discount,
              total: fils(i.qty * i.unitPrice - i.discount),
            })),
          },
          payments: {
            create: payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference,
              registerSessionId: session?.id ?? null,
            })),
          },
        },
      });

      // الفاتورة المعلّقة لم تُبَع بعد — لا نخصم مخزونها حتى تُدفع
      if (status === 'DRAFT') return created;

      // خصم المخزون للأصناف الملموسة فقط
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product?.trackStock) continue;

        const balance = Number(product.stockQty) - item.qty;
        if (balance < 0) {
          throw new AppError(
            `الرصيد غير كافٍ لـ "${product.nameAr}" — المتاح ${product.stockQty} ${product.unit}`
          );
        }

        await tx.product.update({ where: { id: item.productId }, data: { stockQty: balance } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            qty: item.qty,
            balance,
            reference: created.number,
            note: 'بيع نقطة بيع',
            userId,
          },
        });
      }

      return created;
    });

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/products');

    return {
      id: order.id,
      message: park ? `تم حفظ الفاتورة ${order.number} كمعلّقة` : `تم إصدار الفاتورة ${order.number}`,
      // نقطة البيع تعرض الرقم وتفتح الإيصال للطباعة بعد البيع
      data: { number: order.number, parked: park },
    };
  },
});

// ═══════════════════════════════════════════════════════════
//  وردية الصندوق
// ═══════════════════════════════════════════════════════════

export const openRegister = action({
  permission: 'pos:write',
  schema: z.object({
    openingFloat: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
  }),
  audit: { entity: 'RegisterSession', action: 'OPEN' },
  handler: async ({ openingFloat }, { userId }) => {
    const open = await db.registerSession.findFirst({
      where: { openedById: userId, closedAt: null },
    });
    if (open) throw new AppError('لديك وردية مفتوحة بالفعل — أغلقها أولاً');

    const session = await db.registerSession.create({
      data: { openedById: userId, openingFloat },
    });

    revalidatePath('/dashboard/pos');
    return { id: session.id, message: 'تم فتح وردية الصندوق' };
  },
});

export const closeRegister = action({
  permission: 'pos:write',
  schema: z.object({
    id: z.string(),
    closingCash: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
    notes: optionalString,
  }),
  audit: { entity: 'RegisterSession', action: 'CLOSE' },
  handler: async ({ id, closingCash, notes }) => {
    const session = await db.registerSession.findUnique({
      where: { id },
      include: { payments: { where: { method: 'CASH' }, select: { amount: true } } },
    });
    if (!session) throw new AppError('الوردية غير موجودة');
    if (session.closedAt) throw new AppError('الوردية مغلقة بالفعل');

    /*
      المتوقع = رصيد البداية + ما قُبض نقداً في هذه الوردية.
      كان يُجمع من دفعات فواتيرها، والفاتورة تنتقل إلى وردية آخر تحصيل
      بدفعاتها القديمة كلها — فتُحسب في الدرج نقودٌ قُبضت أمس في درج غيره.
      فصار يُجمع من الدفعات المقبوضة فيها وحدها.
    */
    const cashReceived = session.payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const expectedCash = fils(Number(session.openingFloat) + cashReceived);
    const variance = fils(closingCash - expectedCash);

    await db.registerSession.update({
      where: { id },
      data: { closedAt: new Date(), closingCash, expectedCash, variance, notes },
    });

    revalidatePath('/dashboard/pos');

    const verdict =
      variance === 0
        ? 'الصندوق مطابق'
        : variance > 0
          ? `زيادة ${variance.toFixed(3)} د.ك`
          : `عجز ${Math.abs(variance).toFixed(3)} د.ك`;

    return { id, message: `تم إغلاق الوردية — ${verdict}` };
  },
});

// ═══════════════════════════════════════════════════════════
//  الفواتير المعلّقة
// ═══════════════════════════════════════════════════════════

/**
 * يحذف فاتورة معلّقة بعد استرجاع بنودها إلى السلة.
 * المعلّقة لا تخصم مخزوناً، فالحذف لا يحتاج إرجاع أرصدة.
 */
export const discardParkedOrder = action({
  permission: 'pos:write',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Order', action: 'DISCARD_PARKED' },
  handler: async ({ id }) => {
    const order = await db.order.findUnique({
      where: { id },
      select: { status: true, number: true, jobOrderId: true },
    });

    if (!order) throw new AppError('الفاتورة غير موجودة');
    if (order.status !== 'DRAFT') {
      throw new AppError('لا يمكن حذف فاتورة مدفوعة — استخدم المرتجع بدلاً من ذلك');
    }
    if (order.jobOrderId) {
      throw new AppError('هذه فاتورة أمر شغل — تُدار من صفحة أمر الشغل');
    }

    await db.order.delete({ where: { id } });

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/invoices');
    return { id, message: `تم استرجاع الفاتورة ${order.number}` };
  },
});

// ═══════════════════════════════════════════════════════════
//  تحصيل لاحق على فاتورة (الآجل والدفع الجزئي)
// ═══════════════════════════════════════════════════════════

/**
 * خصم على مستوى الفاتورة — يعيد حساب الإجمالي والحالة.
 * لا يُسمح بخصم ينزل بالإجمالي تحت ما حُصِّل فعلاً.
 */
export const setOrderDiscount = action({
  permission: 'pos:write',
  schema: z.object({
    orderId: z.string(),
    discountAmount: z.union([z.string(), z.number()]).transform(Number),
    discountNote: optionalString,
  }),
  audit: { entity: 'Order', action: 'DISCOUNT' },
  handler: async ({ orderId, discountAmount, discountNote }) => {
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      throw new AppError('قيمة الخصم غير صالحة');
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        subtotal: true,
        taxAmount: true,
        paidAmount: true,
        status: true,
        channel: true,
        number: true,
        jobOrderId: true,
        customerId: true,
      },
    });
    if (!order) throw new AppError('الفاتورة غير موجودة');
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new AppError('لا يمكن تعديل خصم فاتورة ملغاة أو مرتجعة');
    }

    const discount = fils(discountAmount);
    const subtotal = toNumber(order.subtotal);
    if (discount > subtotal) throw new AppError('الخصم أكبر من قيمة الفاتورة');

    const total = fils(subtotal - discount + toNumber(order.taxAmount));
    const paid = toNumber(order.paidAmount);
    if (total < paid) {
      throw new AppError(`لا يمكن أن يقل الإجمالي عن المحصّل — ${paid.toFixed(3)} د.ك`);
    }

    const settled = paid >= total;
    const washSubscriptionId = await db.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        data: {
          discountAmount: discount,
          discountNote,
          total,
          status: settled ? 'COMPLETED' : paid > 0 ? 'PARTIAL' : 'DRAFT',
        },
      });
      // إلغاءٌ سبق إلى الصفّ لا يُمحى بخصمٍ متأخّر
      if (updated.count === 0) {
        throw new AppError('لا يمكن تعديل خصم فاتورة ملغاة أو مرتجعة');
      }

      if (order.channel === 'SUBSCRIPTION' && settled) {
        return makeSubscriptionPeriodEligible(tx, orderId, new Date());
      }
      return null;
    });

    /*
      الخصم يغيّر ما يُطلب من العميل، وما يُطلب يُعرض في غير صفحة الفاتورة:
      أمرُ شغلها يعرض إجماليها، وملفُّ صاحبها يعرض مستحقّه، واللوحة تعرض
      مبيعات يومها. فتُبطَل كواشيها جميعاً وإلا بقي المعروض ما قبل الخصم.
    */
    revalidatePath(`/dashboard/invoices/${orderId}`);
    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/job-orders');
    if (order.jobOrderId) revalidatePath(`/dashboard/job-orders/${order.jobOrderId}`);
    if (order.customerId) revalidatePath(`/dashboard/customers/${order.customerId}`);
    revalidatePath('/dashboard/wash');
    revalidatePath('/dashboard/wash/billing');
    if (washSubscriptionId) {
      revalidatePath('/dashboard/wash/today');
      revalidatePath('/dashboard/wash/coverage');
      revalidatePath(`/dashboard/wash/${washSubscriptionId}`);
    }
    revalidatePath('/dashboard');

    return {
      id: orderId,
      message: discount > 0 ? `تم تسجيل خصم ${discount.toFixed(3)} د.ك` : 'تم إلغاء الخصم',
    };
  },
});

export const collectPayment = action({
  permission: 'pos:write',
  schema: z.object({
    orderId: z.string(),
    method: z.enum(['CASH', 'KNET', 'VISA', 'TRANSFER', 'LINK', 'CREDIT']),
    amount: z.union([z.string(), z.number()]).transform(Number),
    reference: optionalString,
  }),
  audit: { entity: 'Payment', action: 'COLLECT' },
  handler: async ({ orderId, method, amount, reference }, { userId }) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('المبلغ يجب أن يكون أكبر من صفر');
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        total: true,
        paidAmount: true,
        status: true,
        channel: true,
        number: true,
        jobOrderId: true,
        customerId: true,
      },
    });
    if (!order) throw new AppError('الفاتورة غير موجودة');
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new AppError('لا يمكن التحصيل على فاتورة ملغاة أو مرتجعة');
    }
    if (order.channel === 'SUBSCRIPTION' && method === 'CREDIT') {
      /*
        الآجل سيجعل الفاتورة مسدّدة ويفتح خط السير بلا دخول مال فعلي،
        فيكسر قاعدة الدفع المسبق بصمت؛ لذلك لا يبدأ الاشتراك إلا بدفع حقيقي.
      */
      throw new AppError('اشتراك الغسيل يجب أن يُدفع بوسيلة دفع فعلية قبل بدء الخدمة');
    }

    const total = toNumber(order.total);
    const remaining = fils(total - toNumber(order.paidAmount));
    if (remaining <= 0) throw new AppError('الفاتورة مسدّدة بالكامل');
    if (amount > remaining) {
      throw new AppError(`المتبقي ${remaining.toFixed(3)} د.ك فقط`);
    }

    const wasUnpaidDraft = order.status === 'DRAFT';
    const paidAmount = fils(toNumber(order.paidAmount) + amount);
    const settled = paidAmount >= total;

    // وردية الصندوق المفتوحة — لتدخل هذه الدفعة في تسوية درجها
    const session = await db.registerSession.findFirst({
      where: { openedById: userId, closedAt: null },
      orderBy: { openedAt: 'desc' },
    });

    let washSubscriptionId: string | null = null;
    await db.$transaction(async (tx) => {
      // الدفعة تُحسب في درج الوردية التي قُبضت فيها — لا في وردية بيع الفاتورة
      await tx.payment.create({
        data: { orderId, method, amount, reference, registerSessionId: session?.id ?? null },
      });

      /*
        مشروطٌ بألّا تكون أُلغيت أو رُدّت: إلغاءٌ سبقنا إلى قفل الصفّ لا
        تُعيده هذه الدفعة سارية — تفشل وتُلغى معاملتها ودفعتها معها.
      */
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        data: { paidAmount, status: settled ? 'COMPLETED' : 'PARTIAL' },
      });
      if (updated.count === 0) {
        throw new AppError('لا يمكن التحصيل على فاتورة ملغاة أو مرتجعة');
      }

      if (order.channel === 'SUBSCRIPTION' && settled) {
        washSubscriptionId = await makeSubscriptionPeriodEligible(tx, orderId, new Date());
      }

      // مسودة لم تُخصم من المخزون بعد — نخصمه الآن عند أول تحصيل
      if (wasUnpaidDraft) {
        const items = await tx.orderItem.findMany({
          where: { orderId },
          select: { productId: true, qty: true },
        });

        for (const item of items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product?.trackStock) continue;

          const balance = Number(product.stockQty) - Number(item.qty);
          if (balance < 0) {
            throw new AppError(
              `الرصيد غير كافٍ لـ "${product.nameAr}" — المتاح ${product.stockQty} ${product.unit}`
            );
          }

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: balance },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'OUT',
              qty: item.qty,
              balance,
              reference: order.number,
              note: 'تحصيل فاتورة معلّقة',
              userId,
            },
          });
        }
      }
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${orderId}`);
    revalidatePath('/dashboard/products');
    // «مستحق عليه» في ملفّ العميل يتبع المحصَّل، فيُبطَل كاشه معها
    if (order.jobOrderId) revalidatePath(`/dashboard/job-orders/${order.jobOrderId}`);
    if (order.customerId) revalidatePath(`/dashboard/customers/${order.customerId}`);
    revalidatePath('/dashboard/wash');
    revalidatePath('/dashboard/wash/billing');
    if (washSubscriptionId) {
      revalidatePath('/dashboard/wash/today');
      revalidatePath('/dashboard/wash/coverage');
      revalidatePath(`/dashboard/wash/${washSubscriptionId}`);
    }
    revalidatePath('/dashboard');

    return {
      id: orderId,
      message: settled
        ? `تم التحصيل — الفاتورة ${order.number} مسدّدة بالكامل`
        : `تم تحصيل ${amount.toFixed(3)} د.ك — المتبقي ${(remaining - amount).toFixed(3)}`,
    };
  },
});

// ═══════════════════════════════════════════════════════════
//  إلغاء الفاتورة وردّها
// ═══════════════════════════════════════════════════════════

/**
 * يعيد إلى المخزون ما خرج منه بهذه الفاتورة — من حركاتها لا من بنودها:
 * الفاتورة لا تقول هل خُصم مخزونها أصلاً (المعلّقة لا تخصم، والمحصَّلة
 * تخصم)، وحركاتُ الصادر بمرجع رقمها تقول ذلك يقيناً.
 */
async function returnOrderStock(
  tx: Prisma.TransactionClient,
  number: string,
  userId: string,
  note: string
) {
  // ردٌّ سبق لا يُكرَّر — لا يعود الصنف إلى الرفّ مرتين
  const returned = await tx.stockMovement.count({ where: { reference: number, type: 'RETURN' } });
  if (returned > 0) return;

  const out = await tx.stockMovement.findMany({
    where: { reference: number, type: 'OUT' },
    select: { productId: true, qty: true },
  });

  for (const m of out) {
    const product = await tx.product.update({
      where: { id: m.productId },
      data: { stockQty: { increment: m.qty } },
      select: { stockQty: true },
    });
    await tx.stockMovement.create({
      data: {
        productId: m.productId,
        type: 'RETURN',
        qty: m.qty,
        balance: product.stockQty,
        reference: number,
        note,
        userId,
      },
    });
  }
}

const voidSchema = z.object({
  orderId: z.string(),
  // السبب ليس زينة: فاتورةٌ تُلغى بلا سبب تُسأل عنها في كل جرد
  reason: z.string().trim().min(3, 'اكتب سبب الإلغاء'),
});

/** ما يقرأ الفاتورة أو أثرها — يُبطَل مع إلغائها أو ردّها */
function revalidateVoided(order: {
  id: string;
  customerId: string | null;
  jobOrderId: string | null;
}) {
  revalidatePath('/dashboard/invoices');
  revalidatePath(`/dashboard/invoices/${order.id}`);
  revalidatePath('/dashboard/pos');
  revalidatePath('/dashboard/products');
  revalidatePath('/dashboard/job-orders');
  if (order.jobOrderId) revalidatePath(`/dashboard/job-orders/${order.jobOrderId}`);
  if (order.customerId) revalidatePath(`/dashboard/customers/${order.customerId}`);
  revalidatePath('/dashboard');
}

/** ما يُبقي الفاتورة خارج الإلغاء والردّ — مشترك بين الاثنين */
function assertVoidable(order: { status: string; channel: string; number: string }) {
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    throw new AppError(`الفاتورة ${order.number} ملغاة أو مرتجعة بالفعل`);
  }
  if (order.channel === 'SUBSCRIPTION') {
    /*
      فاتورة الاشتراك تفتح شهر الغسيل وزياراته — إلغاؤها هنا يترك الشهر
      مفتوحاً بلا فاتورة. تُدار من صفحة الاشتراك.
    */
    throw new AppError('فاتورة اشتراك غسيل — تُدار من صفحة الاشتراك');
  }
}

/**
 * يحجز الفاتورة للإلغاء أو الردّ داخل المعاملة — أول ما فيها.
 *
 * الفحص قبل المعاملة يقرأ حالةً قد تتغيّر: ضغطتان متزامنتان على «مرتجع»
 * تمرّان كلتاهما فيُردّ المبلغ مرتين. والتحديث المشروط يقفل الصفّ، فتنتظر
 * الثانية ثم تجد الحالة تغيّرت فتُلغى معاملتها كلها.
 */
async function claimForVoid(
  tx: Prisma.TransactionClient,
  order: { id: string; number: string },
  data: Prisma.OrderUncheckedUpdateManyInput
) {
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    data,
  });
  if (claimed.count === 0) {
    throw new AppError(`الفاتورة ${order.number} ملغاة أو مرتجعة بالفعل`);
  }
}

/**
 * إلغاء فاتورة لم يُحصَّل منها شيء.
 *
 * لا تُحذف: رقمها يبقى في التسلسل وسببها شاهداً. وتنفكّ عن أمر شغلها
 * ليُصدر له غيرها — كانت فاتورة الأمر الخاطئة لا تُستبدل أبداً، ورسالة
 * التسليم تطلب «فاتورة سارية» لا سبيل إليها.
 */
export const cancelOrder = action({
  permission: 'pos:delete',
  schema: voidSchema,
  audit: { entity: 'Order', action: 'CANCEL' },
  handler: async ({ orderId, reason }, { userId }) => {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
        channel: true,
        paidAmount: true,
        jobOrderId: true,
        customerId: true,
      },
    });
    if (!order) throw new AppError('الفاتورة غير موجودة');
    assertVoidable(order);

    const paid = toNumber(order.paidAmount);
    if (paid > 0) {
      throw new AppError(`حُصِّل منها ${paid.toFixed(3)} د.ك — استعمل «مرتجع» ليُردّ المبلغ`);
    }

    await db.$transaction(async (tx) => {
      await claimForVoid(tx, order, {
        status: 'CANCELLED',
        voidedAt: new Date(),
        voidReason: reason,
        voidedById: userId,
        jobOrderId: null,
        formerJobOrderId: order.jobOrderId,
      });
      await returnOrderStock(tx, order.number, userId, `إلغاء الفاتورة ${order.number}`);
    });

    revalidateVoided(order);
    return { id: orderId, message: `أُلغيت الفاتورة ${order.number}` };
  },
});

/**
 * ردّ فاتورة حُصِّل منها — كاملةً.
 *
 * يُقيَّد ما رُدّ دفعاتٍ سالبة بطرق الدفع نفسها، في وردية من ردّها: نقدٌ
 * خرج من الدرج اليوم يُنقص متوقَّع درج اليوم، لا درجَ يوم البيع المغلق.
 * والآجل يُردّ آجلاً — لم يدخل مالاً فلا يخرج مالاً.
 */
export const refundOrder = action({
  permission: 'pos:delete',
  schema: voidSchema,
  audit: { entity: 'Order', action: 'REFUND' },
  handler: async ({ orderId, reason }, { userId }) => {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
        channel: true,
        paidAmount: true,
        jobOrderId: true,
        customerId: true,
      },
    });
    if (!order) throw new AppError('الفاتورة غير موجودة');
    assertVoidable(order);

    if (toNumber(order.paidAmount) <= 0) {
      throw new AppError('لم يُحصَّل من الفاتورة شيء — ألغِها بدل ردّها');
    }

    const session = await db.registerSession.findFirst({
      where: { openedById: userId, closedAt: null },
      orderBy: { openedAt: 'desc' },
    });

    const refunded = await db.$transaction(async (tx) => {
      await claimForVoid(tx, order, {
        status: 'REFUNDED',
        paidAmount: 0,
        voidedAt: new Date(),
        voidReason: reason,
        voidedById: userId,
        jobOrderId: null,
        formerJobOrderId: order.jobOrderId,
      });

      /*
        الصافي لكل طريقة يُقرأ بعد الحجز لا قبله: تحصيلٌ وقع بين القراءة
        والحجز كان سيبقى خارج الردّ. والحجز يقفل الصفّ، فلا دفعة تُضاف بعده.
      */
      const payments = await tx.payment.findMany({
        where: { orderId },
        select: { method: true, amount: true },
      });
      const net = new Map<(typeof payments)[number]['method'], number>();
      for (const p of payments) {
        net.set(p.method, fils((net.get(p.method) ?? 0) + toNumber(p.amount)));
      }
      const refunds = [...net].filter(([, amount]) => amount > 0);
      if (refunds.length === 0) {
        throw new AppError('لم يُحصَّل من الفاتورة شيء — ألغِها بدل ردّها');
      }

      await tx.payment.createMany({
        data: refunds.map(([method, amount]) => ({
          orderId,
          method,
          amount: -amount,
          reference: 'مرتجع',
          registerSessionId: session?.id ?? null,
        })),
      });
      await returnOrderStock(tx, order.number, userId, `مرتجع الفاتورة ${order.number}`);
      return refunds;
    });

    revalidateVoided(order);
    const total = refunded.reduce((sum, [, amount]) => sum + amount, 0);
    return { id: orderId, message: `رُدّت الفاتورة ${order.number} — ${total.toFixed(3)} د.ك` };
  },
});
