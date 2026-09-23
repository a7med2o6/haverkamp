import { db } from '@/lib/db';
import { isCloudApiReady, normalizePhone, sendWhatsApp } from '@/lib/whatsapp';
import { ensureShareToken, invoiceShareUrl } from '@/lib/invoice-document';
import { toNumber } from '@/lib/utils';

/**
 * إرسال إيصال سداد الفاتورة على الواتساب عند اكتمال سدادها.
 *
 * يُرسَل تلقائياً فقط لفواتير أمر الشغل (Order.channel === 'INVOICE')
 * المدفوعة بالكامل (status === 'COMPLETED') وبقيمة أكبر من صفر.
 *
 * الحجز (Claim) يقع كتابةً في قاعدة البيانات قبل الطلب عبر الشبكة،
 * حتى لا يتسبب تحصيلان متزامنان في إرسال رسالتين مزدوجتين للعميل.
 */
export async function sendInvoiceReceipt(
  orderId: string,
  opts?: { force?: boolean }
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        channel: true,
        status: true,
        total: true,
        receiptSentAt: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!order) {
      return { ok: false, error: 'الفاتورة غير موجودة', skipped: true };
    }

    // الإيصال التلقائي مخصص لفواتير أمر الشغل فقط (ليس نقطة بيع ولا اشتراك)
    if (order.channel !== 'INVOICE') {
      return { ok: false, error: 'الإيصال التلقائي مخصص لفواتير أمر الشغل فقط', skipped: true };
    }

    // يُرسل عند التسديد الكامل فقط
    if (order.status !== 'COMPLETED') {
      return { ok: false, error: 'الفاتورة غير مسددة بالكامل', skipped: true };
    }

    // الفاتورة المجانية أو الكفالة بمبلغ صفر لا تحصل على إيصال
    const totalNum = toNumber(order.total);
    if (totalNum <= 0) {
      return { ok: false, error: 'فاتورة مجانية أو كفالة بمبلغ صفر', skipped: true };
    }

    const phone = normalizePhone(order.customer?.phone);
    if (!phone) {
      return { ok: false, error: 'رقم هاتف العميل غير صالح أو غير موجود', skipped: true };
    }

    // منع الإرسال المكرر إلا في حالة إعادة الإرسال اليدوي (force)
    if (!opts?.force && order.receiptSentAt !== null) {
      return { ok: false, error: 'تم إرسال الإيصال من قبل', skipped: true };
    }

    const templateName = process.env.WHATSAPP_RECEIPT_TEMPLATE;
    if (!isCloudApiReady() || !templateName) {
      return { ok: false, error: 'خدمة واتساب أو قالب الإيصال غير مضبوط', skipped: true };
    }

    /*
      الحجز المسبق قبل طلب الشبكة:
      نقوم بتحديث receiptSentAt أولاً لمنع السباق والتكرار عند تحصيلين متزامنين.
      وفي حال الفشل نلغي الحجز بإعادة receiptSentAt إلى null وتدوين السبب في receiptError.
    */
    if (opts?.force) {
      await db.order.update({
        where: { id: orderId },
        data: { receiptSentAt: new Date(), receiptError: null },
      });
    } else {
      const claimed = await db.order.updateMany({
        where: { id: orderId, receiptSentAt: null },
        data: { receiptSentAt: new Date(), receiptError: null },
      });
      if (claimed.count === 0) {
        return { ok: false, error: 'تم إرسال الإيصال من قبل', skipped: true };
      }
    }

    const shareToken = await ensureShareToken(orderId);
    const customerName = order.customer?.name?.trim() || 'عميلنا العزيز';
    const totalFormatted = totalNum.toFixed(3);

    const cardUrl = invoiceShareUrl(shareToken);
    const fallbackBody = `مرحباً ${customerName}، تم سداد فاتورتك رقم ${order.number} بقيمة ${totalFormatted} د.ك بالكامل. شكراً لتعاملك مع هافركامب، ويمكنك عرض الفاتورة وطباعتها من الرابط أدناه: ${cardUrl}`;

    const res = await sendWhatsApp({
      to: phone,
      body: fallbackBody,
      templateVars: [customerName, order.number, totalFormatted],
      urlSuffix: shareToken,
      template: { name: templateName },
    });

    if (!res.ok) {
      // عند فشل الإرسال نلغي الحجز ليتسنى إعادة الإرسال يدوياً ونحفظ سبب الخطأ
      await db.order.update({
        where: { id: orderId },
        data: { receiptSentAt: null, receiptError: res.error },
      });
      return { ok: false, error: res.error };
    }

    // عند النجاح نضمن مسح أي خطأ سابق
    await db.order.update({
      where: { id: orderId },
      data: { receiptError: null },
    });

    return { ok: true };
  } catch (error) {
    console.error('[invoice-receipt]', error);
    const errStr = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    try {
      await db.order.update({
        where: { id: orderId },
        data: { receiptSentAt: null, receiptError: errStr },
      });
    } catch {
      // سجلّ الخطأ نفسه تعذّر — الإيصال يبقى قابلاً لإعادة الإرسال يدوياً
    }
    return { ok: false, error: errStr };
  }
}
