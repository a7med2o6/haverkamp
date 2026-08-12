/**
 * الجذر <html> مضبوط على العربية RTL في التخطيط الأعلى لأنها لغة اللوحة
 * وأغلب الموقع. صفحات /en تقلبه قبل الرسم لأن نظام التصميم يعتمد على
 * html[dir="ltr"]. يُستغنى عن هذا عند نقل كل الصفحات إلى مسارات باللغة.
 */
export function LtrBoot() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          "document.documentElement.setAttribute('dir','ltr');document.documentElement.setAttribute('lang','en');",
      }}
    />
  );
}
