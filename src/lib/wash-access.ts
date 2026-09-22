import { createShareGate, phoneLast4 } from '@/lib/share-access';

/**
 * بوّابة كارت متابعة اشتراك الغسيل للعميل (/w/[token]).
 *
 * الرابط يُرسل للعميل عبر الواتساب أو يُمسح من الرمز، وتُطلب آخر أربعة أرقام
 * من جوّال صاحب الاشتراك للتحقّق قبل عرض حالة غسلاته ورصيده.
 */

const washGate = createShareGate({
  scope: 'wash',
  cookiePrefix: 'hk_ws',
  path: '/w',
});

export { phoneLast4 };

export const hasWashAccess = washGate.hasAccess;
export const grantWashAccess = washGate.grantAccess;
export const tooManyWashAttempts = washGate.tooManyAttempts;
export const noteFailedWashAttempt = washGate.noteFailedAttempt;
export const clearWashAttempts = washGate.clearAttempts;
