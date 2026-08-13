'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, moneySchema, optionalString } from '@/lib/action-utils';

/** المتجر العام يقرأ من نفس الجدول — أي تعديل منتج يجب أن يظهر فيه */
const SHOP_PATHS = ['/accessories.html', '/en/accessories.html'];

function revalidateShop() {
  for (const path of SHOP_PATHS) revalidatePath(path);
}

const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, 'رمز الصنف (SKU) مطلوب'),
  barcode: optionalString,
  nameAr: z.string().trim().min(2, 'اسم المنتج مطلوب'),
  nameEn: optionalString,
  type: z.enum(['GOOD', 'SERVICE']),
  categoryId: optionalString,
  serviceId: optionalString,
  description: optionalString,
  unit: z.string().trim().min(1, 'الوحدة مطلوبة'),
  cost: moneySchema,
  price: moneySchema,
  trackStock: z.boolean(),
  reorderLevel: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
  isActive: z.boolean(),
  showOnline: z.boolean(),
});

export const saveProduct = action({
  permission: 'inventory:write',
  schema: productSchema,
  audit: { entity: 'Product', action: 'SAVE' },
  handler: async (input) => {
    const { id, ...data } = input;

    // الخدمات لا تُتابَع مخزنياً
    if (data.type === 'SERVICE') data.trackStock = false;

    if (id) {
      const updated = await db.product.update({ where: { id }, data });
      revalidatePath('/dashboard/products');
      revalidateShop();
      return { id: updated.id, message: 'تم تحديث المنتج' };
    }

    const created = await db.product.create({ data });
    revalidatePath('/dashboard/products');
    revalidateShop();
    return { id: created.id, message: `تمت إضافة ${created.nameAr}` };
  },
});

export const toggleProductActive = action({
  permission: 'inventory:write',
  schema: z.object({ id: z.string(), isActive: z.boolean() }),
  audit: { entity: 'Product', action: 'TOGGLE' },
  handler: async ({ id, isActive }) => {
    await db.product.update({ where: { id }, data: { isActive } });
    revalidatePath('/dashboard/products');
    revalidateShop();
    return { id, message: isActive ? 'تم تفعيل المنتج' : 'تم إيقاف المنتج' };
  },
});

/**
 * يسجّل حركة مخزون ويحدّث الرصيد ذرّياً داخل معاملة واحدة،
 * حتى لا يختلّ الرصيد عند تسجيل حركتين في نفس اللحظة.
 */
export const recordStockMovement = action({
  permission: 'inventory:write',
  schema: z.object({
    productId: z.string().min(1, 'المنتج مطلوب'),
    type: z.enum(['IN', 'OUT', 'ADJUST', 'RETURN', 'DAMAGE']),
    qty: z
      .union([z.string(), z.number()])
      .transform(Number)
      .refine((n) => Number.isFinite(n) && n > 0, 'الكمية يجب أن تكون أكبر من صفر'),
    unitCost: optionalString,
    reference: optionalString,
    note: optionalString,
  }),
  audit: { entity: 'StockMovement', action: 'RECORD' },
  handler: async ({ productId, type, qty, unitCost, reference, note }, { userId }) => {
    const movement = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new AppError('المنتج غير موجود');
      if (!product.trackStock) throw new AppError('هذا الصنف غير خاضع لمتابعة المخزون');

      const current = Number(product.stockQty);
      // ADJUST يضبط الرصيد على القيمة المُدخلة بدل إضافتها
      const balance =
        type === 'ADJUST'
          ? qty
          : type === 'IN' || type === 'RETURN'
            ? current + qty
            : current - qty;

      if (balance < 0) {
        throw new AppError(`الرصيد الحالي ${current} ${product.unit} — لا يكفي لصرف ${qty}`);
      }

      await tx.product.update({ where: { id: productId }, data: { stockQty: balance } });

      return tx.stockMovement.create({
        data: {
          productId,
          type,
          qty,
          balance,
          unitCost: unitCost ? Number(unitCost) : null,
          reference,
          note,
          userId,
        },
      });
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/stock');
    return { id: movement.id, message: 'تم تسجيل حركة المخزون' };
  },
});
