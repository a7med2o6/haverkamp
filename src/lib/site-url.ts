/**
 * أساس الروابط العامة — لا يصلح المسار النسبي في رسالة واتساب.
 * رابط تأكيد الموعد ونسخة العميل من الفاتورة يُبنيان منه.
 */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_URL ||
    'https://haverkampkw.com'
  ).replace(/\/$/, '');
}
