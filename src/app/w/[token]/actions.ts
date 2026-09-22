'use server';

import { db } from '@/lib/db';
import {
  clearWashAttempts,
  grantWashAccess,
  hasWashAccess,
  noteFailedWashAttempt,
  phoneLast4,
  tooManyWashAttempts,
} from '@/lib/wash-access';
import { checkLatLng, roundPoint } from '@/lib/geo';

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

/**
 * حفظ أو تحديث موقع السيارة بطلب من العميل عبر الكارت العام (/w/[token]).
 *
 * دالة خادم مباشرة (ليست action()): العميل ليس مستخدماً مسجلاً في النظام.
 * لا يُسمح بتعديل الموقع إلا إذا مرّ الزائر من بوابة الأرقام الأربعة أو لم
 * يكن للعميل رقم هاتف مسجل، وكان الاشتراك غير منتهٍ. ولا تُكشف في رسالة
 * الخطأ تفاصيل وجود الرابط حمايةً للخصوصية.
 */
export async function saveWashCardLocation(
  token: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  if (!token || typeof lat !== 'number' || typeof lng !== 'number') {
    return { error: 'بيانات غير صالحة' };
  }

  const check = checkLatLng(lat, lng);
  if (check) {
    return { error: check.error };
  }

  const subscription = await db.washSubscription.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      status: true,
      customer: { select: { phone: true } },
    },
  });

  if (!subscription || subscription.status === 'ENDED') {
    return { error: 'تعذّر حفظ الموقع' };
  }

  const guarded = Boolean(phoneLast4(subscription.customer?.phone));
  const open = !guarded || (await hasWashAccess(token));

  if (!open) {
    return { error: 'تعذّر حفظ الموقع' };
  }

  const point = roundPoint(lat, lng);

  await db.washSubscription.update({
    where: { id: subscription.id },
    data: {
      lat: point.lat,
      lng: point.lng,
      locationSetAt: new Date(),
    },
  });

  return { error: null };
}
