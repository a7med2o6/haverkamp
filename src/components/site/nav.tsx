import Link from 'next/link';
import Image from 'next/image';
import type { Dictionary, Locale } from '@/lib/site-data';
import { SiteThemeToggle } from './theme-toggle';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * شريط التنقّل العلوي — نفس بنية الموقع الثابت ليعمل معه nav.js.
 *
 * كل صفحة تمرّر روابط أقسامها: في الموقع الثابت كان لكل صفحة شريطها
 * الخاص، فروابط الرئيسية على صفحة خدمة تُخرج الزائر منها بدل أن تنقّله
 * داخلها. الافتراضي روابط الرئيسية.
 */
export function SiteNav({
  t,
  locale,
  links,
  contextLabel,
  alternateHref,
}: {
  t: Dictionary;
  locale: Locale;
  links?: NavLink[];
  contextLabel?: string;
  alternateHref?: string;
}) {
  const home = locale === 'en' ? '/en' : '/';
  const other = locale === 'en' ? '/' : '/en';

  const items: NavLink[] = links ?? [
    { href: `${home}#services`, label: t('nav.services') },
    { href: `${home}#gallery`, label: t('nav.gallery') },
    { href: '/contactus.html', label: t('nav.contact') },
    { href: `${home}#testimonials`, label: t('nav.testimonials') },
    { href: `${home}#why`, label: t('nav.why') },
    { href: '/terms.html', label: t('nav.terms') },
  ];

  return (
    <div className="nav-wrap">
      <nav className={`nav glass${contextLabel ? ' nav-contextual' : ''}`}>
        <div className="nav-brand">
          <Link href={home}>
            <Image
              src="/assets/logo.png"
              alt="هافركامب — HAVERKAMP"
              width={132}
              height={38}
              priority
              className="brand-mark"
            />
          </Link>
        </div>

        {contextLabel ? (
          <p className="nav-context">{contextLabel}</p>
        ) : (
          <div className="nav-links">
            {items
              .filter((l) => l.label)
              .map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label}
                </a>
              ))}
          </div>
        )}

        {!contextLabel && (
          <a href="/contactus.html" className="nav-cta">
            {t('nav.cta')}
          </a>
        )}

        {/*
          أزرار الشريط عنقودٌ واحد في طرفه: الشريط يوزّع أبناءه
          بـ space-between، فزرّ الوضع وحده كان يطفو في فراغٍ بين
          «تواصل معنا» وزرّ اللغة.
        */}
        <div className="nav-actions">
          {/* الوضع يُبدَّل من الموقع لا من لوحة التحكم وحدها */}
          <SiteThemeToggle locale={locale} />

          {/* تبديل اللغة صار تنقّلاً بين مسارين ليُفهرَس كلٌّ منهما */}
          <Link
            href={alternateHref ?? other}
            className="lang-btn"
            aria-label={locale === 'ar' ? 'English' : 'العربية'}
            title={locale === 'ar' ? 'English' : 'العربية'}
          >
            {locale === 'ar' ? '🇬🇧' : '🇰🇼'}
          </Link>

          {!contextLabel && (
            <button
              className="nav-burger"
              id="nav-burger"
              aria-label="القائمة"
              aria-expanded="false"
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>
      </nav>
      {!contextLabel && <div className="nav-drawer" id="nav-drawer" />}
    </div>
  );
}
