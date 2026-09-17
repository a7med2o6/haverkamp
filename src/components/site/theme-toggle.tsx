'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Locale } from '@/lib/site-data';

/**
 * تبديل الوضع من الموقع نفسه.
 *
 * الوضع محفوظ بمفتاح اللوحة نفسه (`hk_theme`) ويُطبَّق على <html> قبل أول
 * رسم بسكربت التخطيط الجذري. وكان الزائر لا يجد ما يبدّله به: الزرّ في
 * لوحة التحكم وحدها، فمن لا يدخلها يبقى على الداكن مهما أراد غيره.
 */

/** المشتركون في تغيّر الوضع — التبديل يقع من زرّ واحد فنبلّغهم يدوياً */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * السمة على <html> هي مصدر الحقيقة لا حالة React: سكربت التخطيط الجذري
 * يضعها قبل أول رسم، فقراءتها منه تُبقي الأيقونة مطابقة للمعروض.
 */
function readTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function SiteThemeToggle({ locale }: { locale: Locale }) {
  // الخادم لا يعرف تفضيل الزائر — الداكن هو الافتراضي في التنسيقات
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as const);

  const toggle = useCallback(() => {
    const next = readTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('hk_theme', next);
    } catch {
      // التصفّح الخاص قد يمنع التخزين — التبديل يبقى فعّالاً لهذه الجلسة
    }
    for (const cb of listeners) cb();
  }, []);

  const label =
    theme === 'light'
      ? locale === 'en'
        ? 'Dark mode'
        : 'الوضع الداكن'
      : locale === 'en'
        ? 'Light mode'
        : 'الوضع الفاتح';

  return (
    <button
      type="button"
      className="lang-btn theme-btn"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {/* أيقونة مرسومة لا إيموجي: تأخذ لون الشريط وتستوي بجانب زرّ اللغة */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {theme === 'light' ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
    </button>
  );
}
