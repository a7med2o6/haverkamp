import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { normalizePhoneDigits } from '@/lib/utils';

/**
 * بوّابة نسخة العميل من الفاتورة.
 *
 * الرابط وحده كان يفتحها، والرابط يُعاد توجيهه وتُصوَّر الورقة برمزها —
 * فتُقرأ فاتورةُ رجلٍ عند غيره. فيُسأل فاتحُها عن آخر أربعة أرقام من جوّال
 * صاحبها: يعرفها صاحبها ولا يعرفها من وقع الرابط في يده.
 *
 * ولا كلمة سرّ ولا حساب: أربعة أرقام تُكتب مرّة، ويُختم الجهاز أسبوعاً.
 */

const COOKIE = 'hk_inv';
const WEEK = 60 * 60 * 24 * 7;

/** آخر أربعة أرقام من رقمٍ مسجّل — أو null لمن لا رقم له */
export function phoneLast4(phone: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(phone);
  return digits && digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * ختم الجهاز موقَّعٌ بمفتاح الخادم لا مجرّد «فتحتُها»: الكعكة تُكتب من
 * المتصفّح، فبلا توقيع يفتح أيٌّ كان أيّ فاتورة بكعكةٍ يخترعها.
 */
function sign(token: string) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  /*
    بلا مفتاح لا توقيع: التوقيع بمفتاحٍ فارغ يحسبه أيٌّ كان ويصنع ختماً
    لأي فاتورة، فتنفتح كلها. والخطأ هنا يُغلق البوّابة لا يفتحها.
  */
  if (!secret) throw new Error('AUTH_SECRET مفقود — لا يمكن توقيع ختم الفاتورة');
  return createHmac('sha256', secret).update(`invoice:${token}`).digest('base64url');
}

function sameString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // المقارنة بزمنٍ ثابت — الفروق في زمن الردّ تُسرّب الصواب حرفاً حرفاً
  return left.length === right.length && timingSafeEqual(left, right);
}

/** هل خُتم هذا الجهاز لهذه الفاتورة؟ */
export async function hasInvoiceAccess(token: string) {
  const jar = await cookies();
  const stamp = jar.get(`${COOKIE}_${token.slice(0, 8)}`)?.value;
  if (!stamp) return false;
  try {
    return sameString(stamp, sign(token));
  } catch {
    // مفتاحٌ مفقود — تبقى الفاتورة مغلقة
    return false;
  }
}

/** يختم الجهاز بعد إجابةٍ صحيحة */
export async function grantInvoiceAccess(token: string) {
  const jar = await cookies();
  jar.set(`${COOKIE}_${token.slice(0, 8)}`, sign(token), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: WEEK,
    path: '/i',
  });
}

/*
  حدّ المحاولات: أربعة أرقام عشرة آلاف احتمال، تُجرَّب آلياً في دقائق بلا
  حدّ. خمس محاولات لكل فاتورة ثم انتظار ربع ساعة. والعدّ في ذاكرة الخادم:
  يسقط مع إعادة تشغيله، وهو حاجزٌ أمام الآلة لا سجلٌّ محاسبي.
*/
const attempts = new Map<string, { count: number; until: number }>();
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60 * 1000;
/*
  سقفٌ للخريطة: المحاولة تُسجَّل ولو على مفتاحٍ مخترع، فبلا سقفٍ تنمو
  الخريطة بما يُرسله المُجرِّب. تُكنس المنتهية أولاً، ثم يُسقَط أقدمها.
*/
const MAX_TRACKED = 5000;

function prune() {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now > entry.until) attempts.delete(key);
  }
  while (attempts.size > MAX_TRACKED) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

export function tooManyAttempts(token: string) {
  const entry = attempts.get(token);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    attempts.delete(token);
    return false;
  }
  return entry.count >= MAX_TRIES;
}

export function noteFailedAttempt(token: string) {
  prune();
  const entry = attempts.get(token);
  const count = entry && Date.now() <= entry.until ? entry.count + 1 : 1;
  attempts.set(token, { count, until: Date.now() + LOCK_MS });
}

export function clearAttempts(token: string) {
  attempts.delete(token);
}
