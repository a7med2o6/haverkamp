'use server';

import { revalidatePath } from 'next/cache';
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
import { todayDateOnly } from '@/lib/utils';
import { isRenewalOpen, openNextPeriod, recordDecline, splitEndingPeriod } from '@/app/dashboard/wash/renewal-service';

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

async function findAndGateSubscription(token: string) {
  if (!token) return null;

  const subscription = await db.washSubscription.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      status: true,
      customer: { select: { phone: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 2,
        select: {
          id: true,
          fromDate: true,
          toDate: true,
          renewalDecision: true,
        },
      },
    },
  });

  if (!subscription || subscription.status === 'ENDED') return null;

  const guarded = Boolean(phoneLast4(subscription.customer?.phone));
  const open = !guarded || (await hasWashAccess(token));
  if (!open) return null;

  return subscription;
}

/**
 * تجديد الاشتراك بطلب من العميل عبر الكارت العام (/w/[token]).
 */
export async function renewFromCard(
  token: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const subscription = await findAndGateSubscription(token);
  if (!subscription) {
    return { ok: false, error: 'تعذّر إكمال الطلب' };
  }

  const today = todayDateOnly();
  const { ending, next } = splitEndingPeriod(subscription.periods, today);
  if (next || ending?.renewalDecision === 'RENEW') {
    return { ok: true, message: 'سبق تجديد اشتراكك' };
  }

  if (!isRenewalOpen(subscription, today)) {
    return { ok: false, error: 'تجديد الاشتراك غير متاح حالياً' };
  }

  try {
    await db.$transaction(async (tx) => {
      await openNextPeriod(tx, subscription.id);
    });

    await db.auditLog.create({
      data: {
        userId: null,
        action: 'RENEW',
        entity: 'WashSubscription',
        entityId: subscription.id,
      },
    });

    revalidatePath(`/w/${token}`);
    return { ok: true, message: 'تم تجديد اشتراكك بنجاح' };
  } catch {
    return { ok: false, error: 'تعذّر تجديد الاشتراك' };
  }
}

/**
 * تسجيل عدم رغبة العميل في التجديد عبر الكارت العام (/w/[token]).
 */
export async function declineFromCard(
  token: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const subscription = await findAndGateSubscription(token);
  if (!subscription) {
    return { ok: false, error: 'تعذّر إكمال الطلب' };
  }

  const today = todayDateOnly();
  const { ending, next } = splitEndingPeriod(subscription.periods, today);
  if (ending?.renewalDecision === 'DECLINE') {
    return { ok: true, message: 'تم تسجيل عدم رغبتك في التجديد' };
  }
  // من جدّد ثم عدل يكلّمنا: إلغاء شهرٍ فُتحت فاتورته قرارُ موظف لا زرٌّ في رابط
  if (next) {
    return { ok: false, error: 'سبق تجديد اشتراكك — تواصل معنا لإلغاء التجديد' };
  }

  if (!isRenewalOpen(subscription, today)) {
    return { ok: false, error: 'تعديل الاشتراك غير متاح حالياً' };
  }

  try {
    await db.$transaction(async (tx) => {
      await recordDecline(tx, subscription.id, today);
    });

    await db.auditLog.create({
      data: {
        userId: null,
        action: 'DECLINE',
        entity: 'WashSubscription',
        entityId: subscription.id,
      },
    });

    revalidatePath(`/w/${token}`);
    return { ok: true, message: 'تم تسجيل طلب عدم التجديد' };
  } catch {
    return { ok: false, error: 'تعذّر تسجيل طلب عدم التجديد' };
  }
}
