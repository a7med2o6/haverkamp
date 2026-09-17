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
    <button type="button" className="lang-btn" onClick={toggle} aria-label={label} title={label}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
