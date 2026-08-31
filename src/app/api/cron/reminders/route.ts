import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  buildReminderMessage,
  confirmUrl,
  dueWhere,
  reminderInclude,
  reminderPhone,
  reminderTemplateVars,
  tomorrowKey,
} from '@/lib/reminders';
import { isCloudApiReady, sendWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * إرسال تذكيرات الغد تلقائياً.
 *
 * يُستدعى من مجدول خارجي مرة يومياً (مساءً بتوقيت الكويت مثلاً):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/reminders
 *
 * المسار خارج حارس اللوحة لأن المجدول ليس مستخدماً، فيحرسه سرّ مشترك.
 * وبلا `CRON_SECRET` يُرفض الطلب رفضاً تامّاً: مسار مفتوح يستنزف رصيد
 * الرسائل ويُغرق العملاء بتذكيرات مكرّرة.
 *
 * التشغيل مرّتين في اليوم لا يُكرّر الرسائل: `reminderSentAt` يُكتب بعد
 * كل إرسال ناجح ويخرج الحجز من شرط الاستحقاق.
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

  if (!isCloudApiReady()) {
    // ليس عطلاً: الطابور اليدوي في اللوحة يغطّي الإرسال
    return NextResponse.json({
      ok: true,
      skipped: 'مفاتيح واتساب غير مضبوطة — التذكيرات تُرسل يدوياً من اللوحة',
      sent: 0,
    });
  }

  const day = tomorrowKey();
  const due = await db.booking.findMany({
    where: dueWhere(day),
    orderBy: { scheduledAt: 'asc' },
    include: reminderInclude,
  });

  let sent = 0;
  const failed: { code: string; error: string }[] = [];

  for (const booking of due) {
    const phone = reminderPhone(booking);
    if (!phone) {
      failed.push({ code: booking.code, error: 'بلا رقم هاتف صالح' });
      continue;
    }

    const url = confirmUrl(booking.confirmToken);

    const res = await sendWhatsApp({
      to: phone,
      body: buildReminderMessage(booking, url),
      templateVars: reminderTemplateVars(booking),
      urlSuffix: booking.confirmToken,
    });

    if (res.ok) {
      await db.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } else {
      // لا نُعلّم الفاشل كمُرسَل — يبقى في طابور اللوحة ليُرسل يدوياً
      failed.push({ code: booking.code, error: res.error });
    }
  }

  return NextResponse.json({ ok: true, day, due: due.length, sent, failed });
}
