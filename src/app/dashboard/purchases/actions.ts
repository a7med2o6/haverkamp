'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString } from '@/lib/action-utils';

/** تقريب لأقرب فلس */
function fils(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** يعيد حساب إجماليات أمر الشراء من بنوده */
async function recalcPurchase(tx: typeof db, purchaseOrderId: string) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (!po) return;

  const subtotal = fils(po.items.reduce((sum, i) => sum + Number(i.total), 0));
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { subtotal, total: fils(subtotal + Number(po.shipping)) },
  });
}

export const savePurchaseOrder = action({
  permission: 'inventory:write',
  schema: z.object({
    id: z.string().optional(),
    supplierId: optionalString,
    expectedAt: optionalString,
    shipping: z.union([z.string(), z.number()]).transform(Number),
    notes: optionalString,
  }),
  audit: { entity: 'PurchaseOrder', action: 'SAVE' },
  handler: async ({ id, supplierId, expectedAt, shipping, notes }) => {
    if (!Number.isFinite(shipping) || shipping < 0) throw new AppError('قيمة الشحن غير صالحة');

    const expected = expectedAt ? new Date(expectedAt) : null;
    if (expected && Number.isNaN(expected.getTime())) throw new AppError('التاريخ المتوقّع غير صالح');

    const data = {
      supplierId: supplierId || null,
      expectedAt: expected,
      shipping: fils(shipping),
      notes,
    };

    if (id) {
      const po = await db.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
      if (!po) throw new AppError('أمر الشراء غير موجود');
      if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
        throw new AppError('لا يمكن تعديل أمر شراء مستلَم أو ملغى');
      }

      await db.$transaction(async (tx) => {
        await tx.purchaseOrder.update({ where: { id }, data });
        await recalcPurchase(tx as typeof db, id);
      });

      revalidatePath(`/dashboard/purchases/${id}`);
      revalidatePath('/dashboard/purchases');
      return { id, message: 'تم حفظ أمر الشراء' };
    }

    const created = await db.purchaseOrder.create({
      data: { ...data, number: await nextNumber('purchase') },
    });

    revalidatePath('/dashboard/purchases');
    return { id: created.id, message: `تم إنشاء أمر الشراء ${created.number}` };
  },
});

export const savePurchaseItem = action({
  permission: 'inventory:write',
  schema: z.object({
    id: z.string().optional(),
    purchaseOrderId: z.string(),
    productId: z.string().min(1, 'الصنف مطلوب'),
    qty: z.union([z.string(), z.number()]).transform(Number),
    unitCost: z.union([z.string(), z.number()]).transform(Number),
  }),
  audit: { entity: 'PurchaseOrderItem', action: 'SAVE' },
  handler: async ({ id, purchaseOrderId, productId, qty, unitCost }) => {
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('الكمية غير صالحة');
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new AppError('التكلفة غير صالحة');

    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { status: true },
    });
    if (!po) throw new AppError('أمر الشراء غير موجود');
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new AppError('لا يمكن تعديل بنود أمر مستلَم أو ملغى');
    }

    if (id) {
      const item = await db.purchaseOrderItem.findUnique({
        where: { id },
        select: { receivedQty: true },
      });
      if (item && qty < Number(item.receivedQty)) {
        throw new AppError(`استُلم ${item.receivedQty} بالفعل — لا يمكن إنقاص الكمية دونها`);
      }
    }

    const data = { purchaseOrderId, productId, qty, unitCost, total: fils(qty * unitCost) };

    await db.$transaction(async (tx) => {
      if (id) await tx.purchaseOrderItem.update({ where: { id }, data });
      else await tx.purchaseOrderItem.create({ data });
      await recalcPurchase(tx as typeof db, purchaseOrderId);
    });

    revalidatePath(`/dashboard/purchases/${purchaseOrderId}`);
    return { id: purchaseOrderId, message: 'تم حفظ البند' };
  },
});

export const deletePurchaseItem = action({
  permission: 'inventory:write',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'PurchaseOrderItem', action: 'DELETE' },
  handler: async ({ id }) => {
    const item = await db.purchaseOrderItem.findUnique({
      where: { id },
      select: { purchaseOrderId: true, receivedQty: true },
    });
    if (!item) throw new AppError('البند غير موجود');
    if (Number(item.receivedQty) > 0) {
      throw new AppError('لا يمكن حذف بند استُلم جزء منه');
    }

    await db.$transaction(async (tx) => {
      await tx.purchaseOrderItem.delete({ where: { id } });
      await recalcPurchase(tx as typeof db, item.purchaseOrderId);
    });

    revalidatePath(`/dashboard/purchases/${item.purchaseOrderId}`);
    return { id: item.purchaseOrderId, message: 'تم حذف البند' };
  },
});

export const setPurchaseStatus = action({
  permission: 'inventory:write',
  schema: z.object({
    id: z.string(),
    status: z.enum(['DRAFT', 'ORDERED', 'CANCELLED']),
  }),
  audit: { entity: 'PurchaseOrder', action: 'STATUS' },
  handler: async ({ id, status }) => {
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!po) throw new AppError('أمر الشراء غير موجود');
    if (po.status === 'RECEIVED') throw new AppError('أمر الشراء مستلَم بالكامل');
    if (status === 'ORDERED' && po.items.length === 0) {
      throw new AppError('لا يمكن إرسال أمر شراء بلا بنود');
    }
    if (status === 'CANCELLED' && po.items.some((i) => Number(i.receivedQty) > 0)) {
      throw new AppError('استُلم جزء من هذا الأمر — لا يمكن إلغاؤه');
    }

    await db.purchaseOrder.update({ where: { id }, data: { status } });
    revalidatePath(`/dashboard/purchases/${id}`);
    revalidatePath('/dashboard/purchases');
    return { id, message: 'تم تحديث حالة أمر الشراء' };
  },
});

/**
 * استلام بضاعة من أمر شراء.
 *
 * التكلفة المحمّلة = تكلفة الوحدة + نصيبها من الشحن، والشحن يُوزَّع على
 * البنود بنسبة قيمة كل بند — فتكلفة الصنف تعكس ثمنه واصلاً إلى الكويت.
 *
 * ثم تُحدَّث تكلفة الصنف بالمتوسط المرجّح:
 *   (قيمة الرصيد القديم + قيمة الوارد) ÷ الكمية الإجمالية
 * فلا يقفز هامش الربح المحسوب على المخزون القديم بتغيّر سعر شحنة جديدة.
 */
export const receivePurchase = action({
  permission: 'inventory:write',
  schema: z.object({
    purchaseOrderId: z.string(),
    lines: z
      .array(z.object({ itemId: z.string(), qty: z.union([z.string(), z.number()]).transform(Number) }))
      .min(1, 'حدّد كمية واحدة على الأقل'),
    note: optionalString,
  }),
  audit: { entity: 'PurchaseOrder', action: 'RECEIVE' },
  handler: async ({ purchaseOrderId, lines, note }, { userId }) => {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: { include: { product: true } } },
    });
    if (!po) throw new AppError('أمر الشراء غير موجود');
    if (po.status === 'CANCELLED') throw new AppError('أمر الشراء ملغى');
    if (po.status === 'RECEIVED') throw new AppError('أمر الشراء مستلَم بالكامل');

    const subtotal = po.items.reduce((sum, i) => sum + Number(i.total), 0);
    const shipping = Number(po.shipping);

    const received = lines
      .map((l) => ({ ...l, item: po.items.find((i) => i.id === l.itemId) }))
      .filter((l) => l.item && Number.isFinite(l.qty) && l.qty > 0);

    if (received.length === 0) throw new AppError('لا توجد كميات صالحة للاستلام');

    for (const line of received) {
      const item = line.item!;
      const outstanding = Number(item.qty) - Number(item.receivedQty);
      if (line.qty > outstanding) {
        throw new AppError(
          `${item.product.nameAr}: المتبقي للاستلام ${outstanding} ${item.product.unit} فقط`
        );
      }
    }

    await db.$transaction(async (tx) => {
      for (const line of received) {
        const item = line.item!;
        const product = item.product;

        // نصيب البند من الشحن موزّعاً بقيمته، ثم على وحداته
        const shareOfShipping =
          subtotal > 0 ? (shipping * Number(item.total)) / subtotal : 0;
        const shippingPerUnit = Number(item.qty) > 0 ? shareOfShipping / Number(item.qty) : 0;
        const landedUnitCost = fils(Number(item.unitCost) + shippingPerUnit);

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: Number(item.receivedQty) + line.qty },
        });

        if (!product.trackStock) continue;

        const oldQty = Number(product.stockQty);
        const oldCost = Number(product.cost);
        const newQty = oldQty + line.qty;
        // الرصيد السالب لا يصلح وزناً في المتوسط
        const weighted =
          newQty > 0 && oldQty > 0
            ? fils((oldQty * oldCost + line.qty * landedUnitCost) / newQty)
            : landedUnitCost;

        await tx.product.update({
          where: { id: product.id },
          data: { stockQty: newQty, cost: weighted },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'IN',
            qty: line.qty,
            balance: newQty,
            unitCost: landedUnitCost,
            reference: po.number,
            note: note ?? `استلام من أمر الشراء ${po.number}`,
            userId,
          },
        });
      }

      // الحالة من واقع البنود بعد التحديث لا من نيّة المستخدم
      const items = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId },
        select: { qty: true, receivedQty: true },
      });
      const complete = items.every((i) => Number(i.receivedQty) >= Number(i.qty));
      const started = items.some((i) => Number(i.receivedQty) > 0);

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: complete ? 'RECEIVED' : started ? 'PARTIAL' : po.status,
          receivedAt: complete ? new Date() : po.receivedAt,
        },
      });
    });

    revalidatePath(`/dashboard/purchases/${purchaseOrderId}`);
    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/stock');
    return { id: purchaseOrderId, message: 'تم تسجيل الاستلام وتحديث المخزون' };
  },
});
