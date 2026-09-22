import { createShareGate, phoneLast4 } from '@/lib/share-access';

/**
 * بوّابة نسخة العميل من الفاتورة.
 *
 * الرابط وحده كان يفتحها، والرابط يُعاد توجيهه وتُصوَّر الورقة برمزها —
 * فتُقرأ فاتورةُ رجلٍ عند غيره. فيُسأل فاتحُها عن آخر أربعة أرقام من جوّال
 * صاحبها: يعرفها صاحبها ولا يعرفها من وقع الرابط في يده.
 *
 * ولا كلمة سرّ ولا حساب: أربعة أرقام تُكتب مرّة، ويُختم الجهاز أسبوعاً.
 */

const invoiceGate = createShareGate({
  scope: 'invoice',
  cookiePrefix: 'hk_inv',
  path: '/i',
});

export { phoneLast4 };

export const hasInvoiceAccess = invoiceGate.hasAccess;
export const grantInvoiceAccess = invoiceGate.grantAccess;
export const tooManyAttempts = invoiceGate.tooManyAttempts;
export const noteFailedAttempt = invoiceGate.noteFailedAttempt;
export const clearAttempts = invoiceGate.clearAttempts;
