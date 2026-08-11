import Script from 'next/script';

/**
 * تخطيط الموقع العام.
 * يستعير نظام التصميم من ملفات الموقع الثابت التي ينسخها
 * scripts/sync-legacy.mjs إلى public/ — حتى لا تتفرّع نسختان من التنسيقات
 * أثناء النقل التدريجي.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/styles.css" />
      <link rel="stylesheet" href="/css/ds.css" />

      {children}

      {/* سكربتات التفاعل والحركة من الموقع الثابت — بلا i18n لأن الترجمة تُصيَّر على الخادم */}
      <Script src="/js/nav.js" strategy="afterInteractive" />
      <Script src="/js/scroll-anim.js" strategy="afterInteractive" />
      <Script src="/js/counters.js" strategy="afterInteractive" />
      <Script src="/js/whatsapp-float.js" strategy="afterInteractive" />
    </>
  );
}
