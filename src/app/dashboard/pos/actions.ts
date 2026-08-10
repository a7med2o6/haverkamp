'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { action, optionalString } from '@/lib/action-utils';

/** يقرّب إلى 3 خانات عشرية (فلس) لتفادي أخطاء الفاصلة العائمة */
function fils(n: number) {
  return Math.round(n * 1000) / 1000;
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

    if (total < 0) throw new Error('قيمة الخصم أكبر من إجمالي الفاتورة');

    const paidAmount = fils(payments.reduce((sum, p) => sum + p.amount, 0));
    if (!park && paidAmount > total) {
      throw new Error('المبلغ المدفوع أكبر من إجمالي الفاتورة');
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
            })),
          },
        },
      });

      // خصم المخزون للأصناف الملموسة فقط
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product?.trackStock) continue;

        const balance = Number(product.stockQty) - item.qty;
        if (balance < 0) {
          throw new Error(
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
    if (open) throw new Error('لديك وردية مفتوحة بالفعل — أغلقها أولاً');

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
      include: { orders: { include: { payments: true } } },
    });
    if (!session) throw new Error('الوردية غير موجودة');
    if (session.closedAt) throw new Error('الوردية مغلقة بالفعل');

    // المتوقع = رصيد البداية + كل المقبوضات النقدية خلال الوردية
    const cashReceived = session.orders
      .flatMap((o) => o.payments)
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);

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
