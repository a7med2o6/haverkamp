'use server';

import { db } from '@/lib/db';
import {
  clearWashAttempts,
  grantWashAccess,
  noteFailedWashAttempt,
  phoneLast4,
  tooManyWashAttempts,
} from '@/lib/wash-access';

/**
 * التحقّق قبل عرض كارت متابعة الغسيل: آخر أربعة أرقام من جوّال صاحب الاشتراك.
 *
 * ليس server action من `action()`: لا صلاحية هنا ولا تدقيق — العميل ليس
 * مستخدماً في النظام. والردّ لا يفرّق بين خطأ الرابط وخطأ الأرقام لعدم
 * تسريب البيانات للمُجرِّب.
 */
export async function verifyWashAccess(
  _prev: { error: string | null },
  form: FormData
): Promise<{ error: string | null }> {
  const token = String(form.get('token') ?? '');
  const digits = String(form.get('digits') ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');

  if (!token) return { error: 'رابط غير صالح' };
  if (tooManyWashAttempts(token)) {
    return { error: 'محاولات كثيرة — انتظر ربع ساعة ثم أعد المحاولة' };
  }
  if (digits.length !== 4) return { error: 'اكتب آخر أربعة أرقام من رقمك' };

  const subscription = await db.washSubscription.findUnique({
    where: { shareToken: token },
    select: { customer: { select: { phone: true } } },
  });

  const expected = phoneLast4(subscription?.customer?.phone);
  if (!expected || expected !== digits) {
    noteFailedWashAttempt(token);
    return { error: 'الأرقام لا تطابق الرقم المسجّل على الاشتراك' };
  }

  clearWashAttempts(token);
  await grantWashAccess(token);
  return { error: null };
}
