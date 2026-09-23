'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action } from '@/lib/action-utils';
import { ensureShareToken, invoiceShareUrl } from '@/lib/invoice-document';
import { waMeLink } from '@/lib/whatsapp';
import { formatKWD, toNumber } from '@/lib/utils';

import { sendInvoiceReceipt } from '@/lib/invoice-receipt';

/**
 * رابط نسخة العميل من الفاتورة، ورسالة واتساب جاهزة به.
 *
 * المفتاح يولد عند أول إرسال لا مع كل فاتورة: ما لم يُرسَل لا يُفتح من
 * خارج اللوحة. وإعادة الإرسال تعيد المفتاح نفسه — فالرابط الذي عند العميل
 * يبقى صالحاً، ويرى فيه الفاتورة كما هي اليوم (تحصيلٌ لاحق، أو إلغاء).
 */
export const shareInvoice = action({
  permission: 'pos:write',
  schema: z.object({ orderId: z.string() }),
  audit: { entity: 'Order', action: 'SHARE' },
  handler: async ({ orderId }) => {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        number: true,
        status: true,
        total: true,
        paidAmount: true,
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!order) throw new AppError('الفاتورة غير موجودة');

    const url = invoiceShareUrl(await ensureShareToken(orderId));
    const total = toNumber(order.total);
    const paid = toNumber(order.paidAmount);
    const voided = order.status === 'CANCELLED' || order.status === 'REFUNDED';
    const remaining = voided ? 0 : Math.round((total - paid) * 1000) / 1000;

    const text = [
      `مرحباً ${order.customer?.name ?? 'عميلنا العزيز'}،`,
      '',
      'فاتورتك من هافركامب الكويت:',
      `🧾 ${order.number}`,
      voided
        ? `⚠️ ${order.status === 'REFUNDED' ? 'مرتجعة' : 'ملغاة'}`
        : `💰 الإجمالي ${formatKWD(total)}`,
      !voided && paid > 0 ? `✅ المدفوع ${formatKWD(paid)}` : null,
      remaining > 0 ? `⏳ المتبقي ${formatKWD(remaining)}` : null,
      '',
      'لعرض الفاتورة وطباعتها:',
      url,
    ]
      .filter((l) => l !== null)
      .join('\n');

    revalidatePath(`/dashboard/invoices/${orderId}`);
    return {
      id: orderId,
      data: {
        url,
        // عميلٌ نقدي أو رقمٌ غير مفهوم — يُنسخ الرابط بدل فتح محادثة
        whatsapp: order.customer?.phone ? waMeLink(order.customer.phone, text) : null,
      },
    };
  },
});

/**
 * إعادة إرسال إيصال السداد على الواتساب يدوياً.
 *
 * يُنفَّذ متزامناً بناءً على رغبة الموظف (force: true) ليتلقى نتيجة الإرسال
 * مباشرة في الشاشة سواء بالنجاح أو بتوضيح السبب عند الفشل.
 */
export const resendInvoiceReceipt = action({
  permission: 'pos:write',
  schema: z.object({ orderId: z.string() }),
  audit: { entity: 'Order', action: 'RECEIPT' },
  handler: async ({ orderId }) => {
    const res = await sendInvoiceReceipt(orderId, { force: true });
    if (!res.ok) {
      throw new AppError(res.error);
    }
    revalidatePath(`/dashboard/invoices/${orderId}`);
    return { id: orderId, message: 'تم إعادة إرسال إيصال السداد على واتساب' };
  },
});
