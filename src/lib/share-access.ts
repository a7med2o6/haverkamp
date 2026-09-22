import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { normalizePhoneDigits } from '@/lib/utils';

/**
 * بوّابة الوصول بالمشاركة المحميّة برابط وخادم (الفواتير، كروت الغسيل...).
 *
 * الرابط يُشارك، لكن من وقع في يده الرابط يُسأل عن آخر 4 أرقام من رقم جوّال
 * صاحبه للتحقّق قبل العرض. وعند التثبّت يُختم جهازه بكعكة مشفّرة وموقّعة
 * بمفتاح الخادم تجنّباً للتزوير.
 */

const WEEK = 60 * 60 * 24 * 7;
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 5000;

/** آخر أربعة أرقام من رقمٍ مسجّل — أو null لمن لا رقم له */
export function phoneLast4(phone: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(phone);
  return digits && digits.length >= 4 ? digits.slice(-4) : null;
}

function sameString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // المقارنة بزمنٍ ثابت — الفروق في زمن الردّ تُسرّب الصواب حرفاً حرفاً
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface ShareGateOptions {
  scope: string;
  cookiePrefix: string;
  path: string;
}

/**
 * مصنع بوّابات الوصول بالرابط المحمي.
 *
 * كل بوّابة تُعطى مجالها وبادئة كعكتها ومسارها، وتدير خريطتها المستقلة
 * لمحاولات التحقّق حتى لا يُقفل كارت الغسيل عند قفل الفاتورة.
 */
export function createShareGate({ scope, cookiePrefix, path }: ShareGateOptions) {
  function sign(token: string) {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    /*
      بلا مفتاح لا توقيع: التوقيع بمفتاحٍ فارغ يحسبه أيٌّ كان ويصنع ختماً
      لأي مستند، فتنفتح كلها. والخطأ هنا يُغلق البوّابة لا يفتحها.
    */
    if (!secret) throw new Error(`AUTH_SECRET مفقود — لا يمكن توقيع ختم ${scope}`);
    return createHmac('sha256', secret).update(`${scope}:${token}`).digest('base64url');
  }

  const attempts = new Map<string, { count: number; until: number }>();

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

  async function hasAccess(token: string) {
    const jar = await cookies();
    const stamp = jar.get(`${cookiePrefix}_${token.slice(0, 8)}`)?.value;
    if (!stamp) return false;
    try {
      return sameString(stamp, sign(token));
    } catch {
      // مفتاحٌ مفقود — تبقى الصفحة مغلقة
      return false;
    }
  }

  async function grantAccess(token: string) {
    const jar = await cookies();
    jar.set(`${cookiePrefix}_${token.slice(0, 8)}`, sign(token), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: WEEK,
      path,
    });
  }

  function tooManyAttempts(token: string) {
    const entry = attempts.get(token);
    if (!entry) return false;
    if (Date.now() > entry.until) {
      attempts.delete(token);
      return false;
    }
    return entry.count >= MAX_TRIES;
  }

  function noteFailedAttempt(token: string) {
    prune();
    const entry = attempts.get(token);
    const count = entry && Date.now() <= entry.until ? entry.count + 1 : 1;
    attempts.set(token, { count, until: Date.now() + LOCK_MS });
  }

  function clearAttempts(token: string) {
    attempts.delete(token);
  }

  return {
    last4: phoneLast4,
    hasAccess,
    grantAccess,
    tooManyAttempts,
    noteFailedAttempt,
    clearAttempts,
  };
}
