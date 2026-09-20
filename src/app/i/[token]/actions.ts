'use server';

import { db } from '@/lib/db';
import {
  clearAttempts,
  grantInvoiceAccess,
  noteFailedAttempt,
  phoneLast4,
  tooManyAttempts,
} from '@/lib/invoice-access';

/**
 * التحقّق قبل عرض الفاتورة: آخر أربعة أرقام من جوّال صاحبها.
 *
 * ليس server action من `action()`: لا صلاحية هنا ولا تدقيق — العميل ليس
 * مستخدماً في النظام. والردّ لا يقول «الرقم غير مسجّل» ولا «الفاتورة غير
 * موجودة»: كلاهما يُعلّم المُجرِّب أين يُكمل.
 */
export async function verifyInvoiceAccess(
  _prev: { error: string | null },
  form: FormData
): Promise<{ error: string | null }> {
  const token = String(form.get('token') ?? '');
  const digits = String(form.get('digits') ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');

  if (!token) return { error: 'رابط غير صالح' };
  if (tooManyAttempts(token)) {
    return { error: 'محاولات كثيرة — انتظر ربع ساعة ثم أعد المحاولة' };
  }
  if (digits.length !== 4) return { error: 'اكتب آخر أربعة أرقام من رقمك' };

  const order = await db.order.findUnique({
    where: { shareToken: token },
    select: { customer: { select: { phone: true } } },
  });

  const expected = phoneLast4(order?.customer?.phone);
  if (!expected || expected !== digits) {
    noteFailedAttempt(token);
    return { error: 'الأرقام لا تطابق الرقم المسجّل على الفاتورة' };
  }

  clearAttempts(token);
  await grantInvoiceAccess(token);
  return { error: null };
}
