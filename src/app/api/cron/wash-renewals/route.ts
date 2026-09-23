import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatDateOnly, formatNumber, todayDateOnly, toNumber } from '@/lib/utils';
import { siteUrl } from '@/lib/site-url';
import { isCloudApiReady, sendWhatsApp } from '@/lib/whatsapp';
import { ensureWashShareToken } from '@/lib/wash-card';
import { RENEWAL_NOTICE_DAYS, RENEWAL_REMINDER_DAYS } from '@/app/dashboard/wash/renewal-service';

export const dynamic = 'force-dynamic';

/**
 * crontab على VPS Hostinger (مرة أو مرتين يومياً):
 * 0 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://haverkampkw.com/api/cron/wash-renewals
 *
 * سبب إشعار التجديد القائم على التراضي (Consent-based):
 *  · لا يجدّد الاشتراك تلقائياً ودون إذن العميل لمنع إصدار فواتير وإلزام العميل بشهر جديد لا يريده.
 *  · المجدول (Cron) يكتفي بإرسال رسائل التذكير المعتمدة عبر الواتساب، ولا يفتح أي فاتورة تلقائياً.
 *  · عند عدم رد العميل بحلول تاريخ النهاية (toDate) لا يحدث أي إجراء آلي، بل يظهر العميل في اللوحة
 *    كـ «لم يردّ» ليتواصل معه الموظفون يدوياً.
 *  · كتابة تاريخ الإشعار (renewalNotifiedAt / renewalRemindedAt) تتم فقط بعد نجاح الإرسال الفعلي
 *    لضمان عدم تفويت الإشعار في حال فشل الاتصال بخدمة واتساب.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET غير مضبوط' },
      { status: 503 }
    );
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });
  }

  const templateName = process.env.WHATSAPP_RENEWAL_TEMPLATE;
  if (!isCloudApiReady() || !templateName) {
    // ليس عطلاً: الطابور اليدوي في لوحة الموظفين (wa.me) يغطّي الإرسال
    return NextResponse.json({
      ok: true,
      skipped: 'مفاتيح الواتساب أو قالب التجديد غير مضبوطة — التذكيرات تُرسل يدوياً من اللوحة',
      notified: 0,
      reminded: 0,
      failed: [],
    });
  }

  const today = todayDateOnly();

  // جلب العقود النشطة التي تكون فترتها الأخيرة مستحقة للتذكير الأول أو الثاني
  const subscriptions = await db.washSubscription.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      code: true,
      monthlyPrice: true,
      customer: { select: { name: true, phone: true } },
      vehicle: { select: { make: true, model: true, plateNo: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1,
        select: {
          id: true,
          toDate: true,
          renewalNotifiedAt: true,
          renewalRemindedAt: true,
          renewalDecision: true,
        },
      },
    },
  });

  let notified = 0;
  let reminded = 0;
  const failed: { code: string; error: string }[] = [];

  for (const sub of subscriptions) {
    if (sub.periods.length === 0) continue;
    const period = sub.periods[0];

    // إن حُسم القرار (RENEW أو DECLINE) لا يُرسل تذكير
    if (period.renewalDecision !== null) continue;

    // العقد الذي انتهت فترته الأخيرة بالفعل (toDate < today) لا يحصل على تذكير آلي
    if (period.toDate.getTime() < today.getTime()) continue;

    const msLeft = period.toDate.getTime() - today.getTime();
    const daysLeft = Math.round(msLeft / 86_400_000);

    // فحص ما إذا كان العقد مستحقاً للتذكير الأول أو الثاني
    const isFirstNotice =
      period.renewalNotifiedAt === null && daysLeft <= RENEWAL_NOTICE_DAYS;
    const isSecondReminder =
      period.renewalNotifiedAt !== null &&
      period.renewalRemindedAt === null &&
      daysLeft <= RENEWAL_REMINDER_DAYS;

    if (!isFirstNotice && !isSecondReminder) continue;

    if (!sub.customer?.phone) {
      failed.push({ code: sub.code, error: 'بلا رقم هاتف صالح' });
      continue;
    }

    const shareToken = await ensureWashShareToken(sub.id);
    const carText = [sub.vehicle.make, sub.vehicle.model, sub.vehicle.plateNo]
      .filter(Boolean)
      .join(' ');
    const formattedToDate = formatDateOnly(period.toDate);
    const formattedPrice = formatNumber(toNumber(sub.monthlyPrice), 3);
    const customerName = sub.customer.name;

    const cardUrl = `${siteUrl()}/w/${shareToken}`;
    const fallbackBody = `مرحباً ${customerName}، ينتهي اشتراك غسيل سيارتك ${carText} يوم ${formattedToDate}. لتجديده شهراً جديداً بقيمة ${formattedPrice} د.ك اضغط الزر أدناه: ${cardUrl}`;

    const res = await sendWhatsApp({
      to: sub.customer.phone,
      body: fallbackBody,
      templateVars: [customerName, carText, formattedToDate, formattedPrice],
      urlSuffix: shareToken,
      template: { name: templateName },
    });

    if (res.ok) {
      if (isFirstNotice) {
        await db.washSubscriptionPeriod.update({
          where: { id: period.id },
          // إشعارٌ أوّل وصل متأخّراً داخل نافذة التذكير يُغني عنه؛ لا رسالتان في يومين متتاليين
          data: {
            renewalNotifiedAt: new Date(),
            ...(daysLeft <= RENEWAL_REMINDER_DAYS ? { renewalRemindedAt: new Date() } : {}),
          },
        });
        notified++;
      } else if (isSecondReminder) {
        await db.washSubscriptionPeriod.update({
          where: { id: period.id },
          data: { renewalRemindedAt: new Date() },
        });
        reminded++;
      }
    } else {
      failed.push({ code: sub.code, error: res.error });
    }
  }

  return NextResponse.json({ ok: true, notified, reminded, failed });
}
