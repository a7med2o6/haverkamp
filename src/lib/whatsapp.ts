/**
 * طبقة إرسال الواتساب.
 *
 * مساران لقناة واحدة:
 *  · Cloud API — إرسال تلقائي من الخادم، يعمل متى ضُبطت مفاتيح Meta.
 *  · wa.me — رابط يفتح الواتساب برسالة جاهزة، يضغطه الموظف.
 *
 * المسار الثاني ليس بديلاً مؤقتاً: Meta لا تسمح ببدء محادثة خارج نافذة
 * الأربع والعشرين ساعة إلا بقالب معتمد، فقد يُرفض القالب أو ينفد الرصيد
 * ويبقى الطابور اليدوي هو ما يُخرج التذكير. لذلك يظهر الطابور دائماً،
 * ويكتفي التلقائي بتفريغه قبل أن يصل إليه الموظف.
 */

import { normalizePhoneDigits } from '@/lib/utils';

const GRAPH_VERSION = 'v21.0';

/** هل مفاتيح Cloud API مضبوطة — يقرّر ظهور الإرسال التلقائي */
export function isCloudApiReady(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/**
 * يحوّل الرقم إلى صيغة E.164 بلا علامة زائد — ما يقبله واتساب.
 * التطبيع نفسه الذي يستعمله العرض، فلا يفترق ما يُرسَل عمّا يُقرأ.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  return normalizePhoneDigits(raw);
}

/** رابط يفتح محادثة واتساب برسالة جاهزة */
export function waMeLink(phone: string, text: string): string | null {
  const to = normalizePhone(phone);
  if (!to) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export type SendResult =
  | { ok: true }
  | { ok: false; error: string; /** المفاتيح غير مضبوطة — ليس عطلاً */ unconfigured?: boolean };

/**
 * يرسل رسالة عبر Cloud API.
 *
 * إن كان `WHATSAPP_TEMPLATE` مضبوطاً أرسلنا قالباً معتمداً — وهو الوحيد
 * المسموح لبدء محادثة. متغيّرات المتن تُمرَّر بترتيبها في القالب،
 * و`urlSuffix` يملأ ذيل زر الرابط الديناميكي إن كان القالب يحوي واحداً.
 * وإن لم يُضبط القالب أرسلنا نصاً حرّاً، وهو لا يصل إلا داخل نافذة
 * الأربع والعشرين ساعة من آخر رسالة للعميل.
 */
export async function sendWhatsApp(params: {
  to: string;
  /** نص الرسالة الكامل — للمسار الحرّ */
  body: string;
  /** متغيّرات متن القالب بالترتيب — للمسار المعتمد */
  templateVars?: string[];
  /** ذيل زر الرابط الديناميكي في القالب — التوكن وحده لا الرابط الكامل */
  urlSuffix?: string;
}): Promise<SendResult> {
  if (!isCloudApiReady()) {
    return { ok: false, error: 'مفاتيح واتساب غير مضبوطة', unconfigured: true };
  }

  const to = normalizePhone(params.to);
  if (!to) return { ok: false, error: 'رقم هاتف غير صالح' };

  const template = process.env.WHATSAPP_TEMPLATE;
  const payload = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'ar' },
          components: [
            {
              type: 'body',
              parameters: (params.templateVars ?? []).map((text) => ({
                type: 'text',
                text,
              })),
            },
            ...(params.urlSuffix
              ? [
                  {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: params.urlSuffix }],
                  },
                ]
              : []),
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: true, body: params.body },
      };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // التذكير ليس حرجاً — لا نُبقي الطلب معلّقاً يعطّل بقية الطابور
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (res.ok) return { ok: true };

    const detail = await res.text().catch(() => '');
    console.error('[whatsapp]', res.status, detail);
    return { ok: false, error: `فشل الإرسال (${res.status})` };
  } catch (e) {
    console.error('[whatsapp]', e);
    return { ok: false, error: 'تعذّر الاتصال بخدمة واتساب' };
  }
}
